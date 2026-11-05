import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { InfrastructureStack } from '../lib/infrastructure-stack'

describe('InfrastructureStack', () => {
  const app = new cdk.App()
  const stack = new InfrastructureStack(app, 'TestStack')
  const template = Template.fromStack(stack)

  test('creates encrypted, retained on-demand data tables', () => {
    template.resourceCountIs('AWS::DynamoDB::Table', 2)
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      SSESpecification: { SSEEnabled: true },
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    })
  })

  test('requires MFA and disables public user registration', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
      MfaConfiguration: 'ON',
      EnabledMfas: ['SOFTWARE_TOKEN_MFA'],
    })
    template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
      GroupName: 'Administrators',
    })
  })

  test('keeps S3 private and serves it through CloudFront', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    })
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultRootObject: 'index.html',
        DefaultCacheBehavior: {
          ViewerProtocolPolicy: 'redirect-to-https',
        },
      },
    })
  })

  test('protects administrator API routes with a JWT authorizer', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'JWT',
    })
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /admin/campaigns',
      AuthorizationType: 'JWT',
    })
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'POST /donations',
      AuthorizationType: 'NONE',
    })
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'POST /admin/campaigns/{campaignId}/archive',
      AuthorizationType: 'JWT',
    })
  })
})
