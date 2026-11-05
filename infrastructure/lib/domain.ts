export const MAX_DONATION_CENTS = 500_000
export const MIN_DONATION_CENTS = 100
export const MAX_CAMPAIGN_AMOUNT_CENTS = 100_000_000

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

export interface CampaignInput {
  organization: string
  title: string
  summary: string
  category: string
  goalInCents: number
}

export interface CampaignPatch {
  organization?: string
  title?: string
  summary?: string
  category?: string
  goalInCents?: number
  status?: Exclude<CampaignStatus, 'ARCHIVED'>
}

export interface DonationInput {
  idempotencyKey: string
  campaignId: string
  amountInCents: number
  isPublic: boolean
  donorName?: string
}

export class InputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InputError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys)
  return Object.keys(value).every((key) => allowed.has(key))
}

function requiredText(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.trim().length > maxLength ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new InputError(`${field} is invalid.`)
  }

  return value.trim()
}

function validCampaignId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[a-z0-9][a-z0-9-]{2,63}$/u.test(value)
  )
}

function parseIntegerAmount(
  value: unknown,
  minimum: number,
  maximum: number,
  field: string,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new InputError(`${field} is outside the allowed range.`)
  }

  return value
}

export function parseDonationInput(value: unknown): DonationInput {
  if (!isRecord(value)) {
    throw new InputError('Request body must be an object.')
  }

  if (
    !hasOnlyKeys(value, [
      'idempotencyKey',
      'campaignId',
      'amountInCents',
      'isPublic',
      'donorName',
    ])
  ) {
    throw new InputError('Request contains unsupported fields.')
  }

  if (
    typeof value.idempotencyKey !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value.idempotencyKey,
    )
  ) {
    throw new InputError('Idempotency key must be a UUID v4.')
  }

  if (!validCampaignId(value.campaignId)) {
    throw new InputError('Campaign identifier is invalid.')
  }

  if (typeof value.isPublic !== 'boolean') {
    throw new InputError('Public display preference is required.')
  }

  const amountInCents = parseIntegerAmount(
    value.amountInCents,
    MIN_DONATION_CENTS,
    MAX_DONATION_CENTS,
    'Donation amount',
  )

  if (value.isPublic) {
    return {
      idempotencyKey: value.idempotencyKey.toLowerCase(),
      campaignId: value.campaignId,
      amountInCents,
      isPublic: true,
      donorName: requiredText(value.donorName, 'Donor name', 80),
    }
  }

  if (value.donorName !== undefined) {
    throw new InputError(
      'Donor name must not be sent without public display consent.',
    )
  }

  return {
    idempotencyKey: value.idempotencyKey.toLowerCase(),
    campaignId: value.campaignId,
    amountInCents,
    isPublic: false,
  }
}

export function parseCampaignInput(value: unknown): CampaignInput {
  if (!isRecord(value)) {
    throw new InputError('Request body must be an object.')
  }

  const allowedKeys = [
    'organization',
    'title',
    'summary',
    'category',
    'goalInCents',
  ] as const

  if (!hasOnlyKeys(value, allowedKeys)) {
    throw new InputError('Request contains unsupported fields.')
  }

  return {
    organization: requiredText(value.organization, 'Organization', 120),
    title: requiredText(value.title, 'Campaign title', 120),
    summary: requiredText(value.summary, 'Campaign summary', 500),
    category: requiredText(value.category, 'Campaign category', 60),
    goalInCents: parseIntegerAmount(
      value.goalInCents,
      MIN_DONATION_CENTS,
      MAX_CAMPAIGN_AMOUNT_CENTS,
      'Campaign goal',
    ),
  }
}

export function parseCampaignPatch(value: unknown): CampaignPatch {
  if (!isRecord(value)) {
    throw new InputError('Request body must be an object.')
  }

  const allowedKeys = [
    'organization',
    'title',
    'summary',
    'category',
    'goalInCents',
    'status',
  ] as const

  if (
    Object.keys(value).length === 0 ||
    !hasOnlyKeys(value, allowedKeys)
  ) {
    throw new InputError('Campaign update contains unsupported fields.')
  }

  const patch: CampaignPatch = {}

  if (value.organization !== undefined) {
    patch.organization = requiredText(
      value.organization,
      'Organization',
      120,
    )
  }
  if (value.title !== undefined) {
    patch.title = requiredText(value.title, 'Campaign title', 120)
  }
  if (value.summary !== undefined) {
    patch.summary = requiredText(value.summary, 'Campaign summary', 500)
  }
  if (value.category !== undefined) {
    patch.category = requiredText(value.category, 'Campaign category', 60)
  }
  if (value.goalInCents !== undefined) {
    patch.goalInCents = parseIntegerAmount(
      value.goalInCents,
      MIN_DONATION_CENTS,
      MAX_CAMPAIGN_AMOUNT_CENTS,
      'Campaign goal',
    )
  }
  if (value.status !== undefined) {
    if (value.status !== 'DRAFT' && value.status !== 'ACTIVE') {
      throw new InputError('Campaign status is invalid.')
    }
    patch.status = value.status
  }

  return patch
}

export function donationFingerprint(input: DonationInput): string {
  return JSON.stringify({
    campaignId: input.campaignId,
    amountInCents: input.amountInCents,
    isPublic: input.isPublic,
    donorName: input.donorName ?? null,
  })
}
