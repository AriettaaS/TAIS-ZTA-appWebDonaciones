import { createHash, randomUUID } from 'node:crypto'
import {
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda'
import {
  donationFingerprint,
  InputError,
  parseCampaignInput,
  parseCampaignPatch,
  parseDonationInput,
} from './domain'

interface CampaignRecord {
  campaignId: string
  organization: string
  title: string
  summary: string
  category: string
  goalInCents: number
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  createdAt: string
  updatedAt: string
}

interface DonationRecord {
  idempotencyKey: string
  donationId: string
  campaignId: string
  amountInCents: number
  isPublic: boolean
  donorName?: string
  status: 'SIMULATED_SUCCESS'
  simulation: true
  requestFingerprint: string
  createdAt: string
}

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}))

function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function response(
  statusCode: number,
  body: unknown,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
    body: JSON.stringify(body),
  }
}

function parseBody(event: APIGatewayProxyEventV2WithJWTAuthorizer): unknown {
  if (!event.body) {
    throw new InputError('Request body is required.')
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body

  if (Buffer.byteLength(rawBody, 'utf8') > 16_384) {
    throw new InputError('Request body is too large.')
  }

  try {
    return JSON.parse(rawBody) as unknown
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new InputError('Request body must be valid JSON.')
    }
    throw error
  }
}

function requireAdministrator(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): string {
  const claims = event.requestContext.authorizer.jwt.claims
  const groups = claims['cognito:groups']
  const groupNames = Array.isArray(groups)
    ? groups
    : typeof groups === 'string'
      ? groups.split(',')
      : []

  if (!groupNames.includes('Administrators')) {
    throw new HttpError(403, 'Administrator permission is required.')
  }

  const subject = claims.sub
  if (typeof subject !== 'string' || subject.length === 0) {
    throw new HttpError(403, 'Administrator identity is invalid.')
  }
  return subject
}

function audit(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  actorSub: string,
  action: string,
  resourceId: string,
): void {
  console.info(
    JSON.stringify({
      eventType: 'audit',
      action,
      actorSub,
      resourceId,
      requestId: event.requestContext.requestId,
      occurredAt: new Date().toISOString(),
    }),
  )
}

function logFailure(
  context: Context,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  error: unknown,
): APIGatewayProxyStructuredResultV2 {
  if (error instanceof InputError) {
    return response(400, { message: error.message })
  }
  if (error instanceof HttpError) {
    return response(error.statusCode, { message: error.message })
  }

  console.error(
    JSON.stringify({
      eventType: 'application-error',
      requestId: event.requestContext.requestId,
      lambdaRequestId: context.awsRequestId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    }),
  )
  return response(500, { message: 'An unexpected error occurred.' })
}

async function handle<T>(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  context: Context,
  operation: () => Promise<T>,
  statusCode = 200,
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    return response(statusCode, await operation())
  } catch (error) {
    return logFailure(context, event, error)
  }
}

function publicCampaign(item: CampaignRecord): Omit<CampaignRecord, 'status'> {
  const { status: _status, ...visibleFields } = item
  return visibleFields
}

function publicDonation(item: DonationRecord) {
  return {
    donationId: item.donationId,
    campaignId: item.campaignId,
    amountInCents: item.amountInCents,
    status: item.status,
    simulation: item.simulation,
    isPublic: item.isPublic,
    ...(item.isPublic && item.donorName
      ? { donorName: item.donorName }
      : {}),
    createdAt: item.createdAt,
  }
}

function existingDonationResponse(
  item: DonationRecord | undefined,
  fingerprint: string,
) {
  if (!item) {
    return undefined
  }
  if (item.requestFingerprint !== fingerprint) {
    throw new HttpError(
      409,
      'Idempotency key was already used for a different request.',
    )
  }
  return publicDonation(item)
}

export async function getActiveCampaigns(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  context: Context,
): Promise<APIGatewayProxyStructuredResultV2> {
  return handle(event, context, async () => {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: requiredEnvironment('CAMPAIGNS_TABLE'),
        IndexName: 'status-createdAt-index',
        KeyConditionExpression: '#status = :active',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':active': 'ACTIVE' },
        ScanIndexForward: false,
      }),
    )

    return {
      items: ((result.Items ?? []) as CampaignRecord[]).map(publicCampaign),
    }
  })
}

export async function createDonation(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  context: Context,
): Promise<APIGatewayProxyStructuredResultV2> {
  return handle(
    event,
    context,
    async () => {
      const input = parseDonationInput(parseBody(event))
      const campaignsTable = requiredEnvironment('CAMPAIGNS_TABLE')
      const donationsTable = requiredEnvironment('DONATIONS_TABLE')
      const fingerprint = createHash('sha256')
        .update(donationFingerprint(input))
        .digest('hex')
      const existingResult = await dynamo.send(
        new GetCommand({
          TableName: donationsTable,
          Key: { idempotencyKey: input.idempotencyKey },
          ConsistentRead: true,
        }),
      )
      const existingResponse = existingDonationResponse(
        existingResult.Item as DonationRecord | undefined,
        fingerprint,
      )
      if (existingResponse) {
        return existingResponse
      }

      const campaignResult = await dynamo.send(
        new GetCommand({
          TableName: campaignsTable,
          Key: { campaignId: input.campaignId },
          ConsistentRead: true,
        }),
      )
      const campaign = campaignResult.Item as CampaignRecord | undefined

      if (!campaign || campaign.status !== 'ACTIVE') {
        throw new HttpError(409, 'Campaign is not available for donations.')
      }

      const now = new Date().toISOString()
      const item: DonationRecord = {
        idempotencyKey: input.idempotencyKey,
        donationId: randomUUID(),
        campaignId: input.campaignId,
        amountInCents: input.amountInCents,
        isPublic: input.isPublic,
        ...(input.isPublic && input.donorName
          ? { donorName: input.donorName }
          : {}),
        status: 'SIMULATED_SUCCESS',
        simulation: true,
        requestFingerprint: fingerprint,
        createdAt: now,
      }

      try {
        await dynamo.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                ConditionCheck: {
                  TableName: campaignsTable,
                  Key: { campaignId: input.campaignId },
                  ConditionExpression: '#status = :active',
                  ExpressionAttributeNames: { '#status': 'status' },
                  ExpressionAttributeValues: { ':active': 'ACTIVE' },
                },
              },
              {
                Put: {
                  TableName: donationsTable,
                  Item: item,
                  ConditionExpression: 'attribute_not_exists(idempotencyKey)',
                },
              },
            ],
          }),
        )
      } catch (error) {
        const duplicateResult = await dynamo.send(
          new GetCommand({
            TableName: donationsTable,
            Key: { idempotencyKey: input.idempotencyKey },
            ConsistentRead: true,
          }),
        )
        const duplicateResponse = existingDonationResponse(
          duplicateResult.Item as DonationRecord | undefined,
          fingerprint,
        )
        if (duplicateResponse) {
          return duplicateResponse
        }

        if (
          error instanceof Error &&
          error.name === 'TransactionCanceledException'
        ) {
          const currentCampaign = await dynamo.send(
            new GetCommand({
              TableName: campaignsTable,
              Key: { campaignId: input.campaignId },
              ConsistentRead: true,
            }),
          )
          const current = currentCampaign.Item as CampaignRecord | undefined
          if (!current || current.status !== 'ACTIVE') {
            throw new HttpError(
              409,
              'Campaign is no longer available for donations.',
            )
          }
        }
        throw error
      }

      console.info(
        JSON.stringify({
          eventType: 'simulated-donation',
          donationId: item.donationId,
          campaignId: item.campaignId,
          status: item.status,
          simulation: item.simulation,
          requestId: event.requestContext.requestId,
          occurredAt: now,
        }),
      )

      return publicDonation(item)
    },
    201,
  )
}

export async function getAdminCampaigns(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  context: Context,
): Promise<APIGatewayProxyStructuredResultV2> {
  return handle(event, context, async () => {
    requireAdministrator(event)
    const tableName = requiredEnvironment('CAMPAIGNS_TABLE')
    const statuses: CampaignRecord['status'][] = [
      'DRAFT',
      'ACTIVE',
      'ARCHIVED',
    ]
    const results = await Promise.all(
      statuses.map((status) =>
        dynamo.send(
          new QueryCommand({
            TableName: tableName,
            IndexName: 'status-createdAt-index',
            KeyConditionExpression: '#status = :status',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':status': status },
            ScanIndexForward: false,
          }),
        ),
      ),
    )

    const items = results.flatMap(
      (result) => (result.Items ?? []) as CampaignRecord[],
    )
    return { items }
  })
}

export async function createCampaign(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  context: Context,
): Promise<APIGatewayProxyStructuredResultV2> {
  return handle(
    event,
    context,
    async () => {
      const actorSub = requireAdministrator(event)
      const input = parseCampaignInput(parseBody(event))
      const now = new Date().toISOString()
      const item: CampaignRecord = {
        campaignId: randomUUID(),
        ...input,
        status: 'DRAFT',
        createdAt: now,
        updatedAt: now,
      }

      await dynamo.send(
        new PutCommand({
          TableName: requiredEnvironment('CAMPAIGNS_TABLE'),
          Item: item,
          ConditionExpression: 'attribute_not_exists(campaignId)',
        }),
      )
      audit(event, actorSub, 'campaign.created', item.campaignId)
      return item
    },
    201,
  )
}

export async function updateCampaign(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  context: Context,
): Promise<APIGatewayProxyStructuredResultV2> {
  return handle(event, context, async () => {
    const actorSub = requireAdministrator(event)
    const campaignId = event.pathParameters?.campaignId
    if (!campaignId) {
      throw new InputError('Campaign identifier is required.')
    }
    const patch = parseCampaignPatch(parseBody(event))
    const now = new Date().toISOString()
    const names: Record<string, string> = { '#updatedAt': 'updatedAt' }
    const values: Record<string, unknown> = { ':updatedAt': now }
    const assignments = ['#updatedAt = :updatedAt']

    for (const [field, value] of Object.entries(patch)) {
      const nameToken = `#${field}`
      const valueToken = `:${field}`
      names[nameToken] = field
      values[valueToken] = value
      assignments.push(`${nameToken} = ${valueToken}`)
    }

    let result
    try {
      result = await dynamo.send(
        new UpdateCommand({
          TableName: requiredEnvironment('CAMPAIGNS_TABLE'),
          Key: { campaignId },
          UpdateExpression: `SET ${assignments.join(', ')}`,
          ConditionExpression:
            'attribute_exists(campaignId) AND #status <> :archived',
          ExpressionAttributeNames: {
            ...names,
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ...values,
            ':archived': 'ARCHIVED',
          },
          ReturnValues: 'ALL_NEW',
        }),
      )
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        throw new HttpError(404, 'Campaign was not found or is archived.')
      }
      throw error
    }

    audit(event, actorSub, 'campaign.updated', campaignId)
    return result.Attributes as CampaignRecord
  })
}

export async function archiveCampaign(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  context: Context,
): Promise<APIGatewayProxyStructuredResultV2> {
  return handle(event, context, async () => {
    const actorSub = requireAdministrator(event)
    const campaignId = event.pathParameters?.campaignId
    if (!campaignId) {
      throw new InputError('Campaign identifier is required.')
    }
    const now = new Date().toISOString()
    let result
    try {
      result = await dynamo.send(
        new UpdateCommand({
          TableName: requiredEnvironment('CAMPAIGNS_TABLE'),
          Key: { campaignId },
          UpdateExpression: 'SET #status = :archived, #updatedAt = :updatedAt',
          ConditionExpression:
            'attribute_exists(campaignId) AND #status <> :archived',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':archived': 'ARCHIVED',
            ':updatedAt': now,
          },
          ReturnValues: 'ALL_NEW',
        }),
      )
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        throw new HttpError(404, 'Campaign was not found or is already archived.')
      }
      throw error
    }

    audit(event, actorSub, 'campaign.archived', campaignId)
    return result.Attributes as CampaignRecord
  })
}
