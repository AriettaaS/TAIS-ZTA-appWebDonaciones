import * as path from 'node:path'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const campaignsTable = new dynamodb.Table(this, 'CampaignsTable', {
      partitionKey: { name: 'campaignId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    campaignsTable.addGlobalSecondaryIndex({
      indexName: 'status-createdAt-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    })

    const donationsTable = new dynamodb.Table(this, 'DonationsTable', {
      partitionKey: {
        name: 'idempotencyKey',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    donationsTable.addGlobalSecondaryIndex({
      indexName: 'campaign-createdAt-index',
      partitionKey: { name: 'campaignId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    })

    const userPool = new cognito.UserPool(this, 'AdminUserPool', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    new cognito.UserPoolGroup(this, 'AdministratorsGroup', {
      userPool,
      groupName: 'Administrators',
      description: 'Administrators authorized to manage campaigns.',
    })
    const userPoolClient = userPool.addClient('WebClient', {
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.minutes(15),
      idTokenValidity: cdk.Duration.minutes(15),
      refreshTokenValidity: cdk.Duration.days(1),
    })

    const siteBucket = new s3.Bucket(this, 'WebAssetsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })
    const distribution = new cloudfront.Distribution(this, 'WebDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: new cloudfront.ResponseHeadersPolicy(
          this,
          'WebSecurityHeaders',
          {
            securityHeadersBehavior: {
              contentTypeOptions: { override: true },
              frameOptions: {
                frameOption: cloudfront.HeadersFrameOption.DENY,
                override: true,
              },
              referrerPolicy: {
                referrerPolicy:
                  cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
                override: true,
              },
              strictTransportSecurity: {
                accessControlMaxAge: cdk.Duration.days(365),
                includeSubdomains: true,
                preload: true,
                override: true,
              },
            },
          },
        ),
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
    })
    new s3deploy.BucketDeployment(this, 'DeployWebAssets', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../apps/web/dist'))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    })

    const api = new apigatewayv2.HttpApi(this, 'DonationsApi', {
      apiName: 'tais-donations-api',
      corsPreflight: {
        allowOrigins: [
          `https://${distribution.distributionDomainName}`,
          'http://localhost:5173',
        ],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PATCH,
        ],
        allowHeaders: ['authorization', 'content-type'],
        maxAge: cdk.Duration.hours(1),
      },
      createDefaultStage: false,
    })
    const accessLogs = new apigatewayv2.LogGroupLogDestination(
      new logs.LogGroup(this, 'ApiAccessLogs', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    )
    new apigatewayv2.HttpStage(this, 'DefaultApiStage', {
      httpApi: api,
      stageName: '$default',
      autoDeploy: true,
      throttle: { rateLimit: 10, burstLimit: 20 },
      accessLogSettings: {
        destination: accessLogs,
        format: apigateway.AccessLogFormat.custom(
          JSON.stringify({
            requestId: apigateway.AccessLogField.contextRequestId(),
            routeKey: apigateway.AccessLogField.contextRouteKey(),
            status: apigateway.AccessLogField.contextStatus(),
            responseLength: apigateway.AccessLogField.contextResponseLength(),
          }),
        ),
      },
    })

    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      'CognitoJwtAuthorizer',
      `https://cognito-idp.${cdk.Stack.of(this).region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] },
    )
    const makeHandler = (
      constructId: string,
      handler: string,
      environment: Record<string, string>,
    ) => {
      const functionName = `tais-donations-${handler.toLowerCase()}`
      const logGroup = new logs.LogGroup(this, `${constructId}LogGroup`, {
        logGroupName: `/aws/lambda/${functionName}`,
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      })
      return new nodejs.NodejsFunction(this, constructId, {
        entry: path.join(__dirname, 'api-handlers.ts'),
        handler,
        functionName,
        runtime: lambda.Runtime.NODEJS_22_X,
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
        logGroup,
        environment,
      })
    }

    const tableEnvironment = {
      CAMPAIGNS_TABLE: campaignsTable.tableName,
      DONATIONS_TABLE: donationsTable.tableName,
    }
    const getCampaigns = makeHandler(
      'GetActiveCampaignsHandler',
      'getActiveCampaigns',
      tableEnvironment,
    )
    const createDonation = makeHandler(
      'CreateDonationHandler',
      'createDonation',
      tableEnvironment,
    )
    const getAdminCampaigns = makeHandler(
      'GetAdminCampaignsHandler',
      'getAdminCampaigns',
      tableEnvironment,
    )
    const createCampaign = makeHandler(
      'CreateCampaignHandler',
      'createCampaign',
      tableEnvironment,
    )
    const updateCampaign = makeHandler(
      'UpdateCampaignHandler',
      'updateCampaign',
      tableEnvironment,
    )
    const archiveCampaign = makeHandler(
      'ArchiveCampaignHandler',
      'archiveCampaign',
      tableEnvironment,
    )

    const campaignReadResources = [
      campaignsTable.tableArn,
      `${campaignsTable.tableArn}/index/*`,
    ]
    getCampaigns.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:Query'],
        resources: campaignReadResources,
      }),
    )
    createDonation.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'dynamodb:GetItem',
          'dynamodb:ConditionCheckItem',
          'dynamodb:TransactWriteItems',
          'dynamodb:PutItem',
        ],
        resources: [campaignsTable.tableArn, donationsTable.tableArn],
      }),
    )
    getAdminCampaigns.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:Query'],
        resources: campaignReadResources,
      }),
    )
    createCampaign.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:PutItem'],
        resources: [campaignsTable.tableArn],
      }),
    )
    updateCampaign.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:UpdateItem'],
        resources: [campaignsTable.tableArn],
      }),
    )
    archiveCampaign.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:UpdateItem'],
        resources: [campaignsTable.tableArn],
      }),
    )

    api.addRoutes({
      path: '/campaigns',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'GetActiveCampaignsIntegration',
        getCampaigns,
      ),
    })
    api.addRoutes({
      path: '/donations',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        'CreateDonationIntegration',
        createDonation,
      ),
    })
    api.addRoutes({
      path: '/admin/campaigns',
      methods: [apigatewayv2.HttpMethod.GET],
      authorizer: jwtAuthorizer,
      integration: new integrations.HttpLambdaIntegration(
        'GetAdminCampaignsIntegration',
        getAdminCampaigns,
      ),
    })
    api.addRoutes({
      path: '/admin/campaigns',
      methods: [apigatewayv2.HttpMethod.POST],
      authorizer: jwtAuthorizer,
      integration: new integrations.HttpLambdaIntegration(
        'CreateCampaignIntegration',
        createCampaign,
      ),
    })
    api.addRoutes({
      path: '/admin/campaigns/{campaignId}',
      methods: [apigatewayv2.HttpMethod.PATCH],
      authorizer: jwtAuthorizer,
      integration: new integrations.HttpLambdaIntegration(
        'UpdateCampaignIntegration',
        updateCampaign,
      ),
    })
    api.addRoutes({
      path: '/admin/campaigns/{campaignId}/archive',
      methods: [apigatewayv2.HttpMethod.POST],
      authorizer: jwtAuthorizer,
      integration: new integrations.HttpLambdaIntegration(
        'ArchiveCampaignIntegration',
        archiveCampaign,
      ),
    })

    new cloudwatch.Alarm(this, 'ApiServerErrorAlarm', {
      metric: api.metricServerError({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription:
        'An API request returned a server-side error in the last five minutes.',
    })

    new cdk.CfnOutput(this, 'WebUrl', {
      value: `https://${distribution.distributionDomainName}`,
    })
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint })
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId })
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    })
  }
}
