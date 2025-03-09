import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaInfo, TriggerInfo } from '../interfaces/lambda/lambda-info';
import { ApiBuilder } from '../api-builder';
import { ResourceSummary, LambdaDetail } from '../interfaces/outputs/cloud-formation';

/**
 * Creates formatted CloudFormation outputs with useful and structured information
 */
export function generateFormattedOutputs(
  scope: Construct,
  stack: cdk.Stack,
  lambdaInfos: LambdaInfo[],
  sharedApi: ApiBuilder | undefined,
  stage: string
): void {
  // Create resource summary
  const summary: ResourceSummary = {
    stackName: stack.stackName,
    stage: stage,
    lambdaCount: lambdaInfos.length,
    apiEndpoints: 0,
    snsTopics: 0,
    sqsQueues: 0,
    s3Buckets: 0
  };

  // Generate output for API Gateway if it exists
  if (sharedApi) {
    new cdk.CfnOutput(scope, `ApiSummary-${stage}`, {
      value: JSON.stringify({
        apiGatewayUrl: sharedApi.getApiUrl(),
        description: `API Gateway for ${stage}`
      }),
      description: `API_GATEWAY_INFO`
    });
  }

  // Prepare Lambda details for output
  const lambdaDetails: LambdaDetail[] = [];
  
  lambdaInfos.forEach((lambdaInfo) => {
    const id = lambdaInfo.id;
    const triggers = lambdaInfo.triggers;
    const lambda = lambdaInfo.lambda;
    
    const lambdaDetail: LambdaDetail = {
      name: id,
      memory: lambdaInfo.memory || 'default',
      timeout: lambdaInfo.timeout || 'default',
      environment: lambdaInfo.environment || {},
      triggers: []
    };

    // Collect trigger details with improved formatting
    triggers.forEach((trigger: TriggerInfo) => {
      switch (trigger.type) {
        case "api":
          summary.apiEndpoints++;
          lambdaDetail.triggers.push({
            type: "API Gateway",
            method: trigger.method,
            path: sharedApi ? sharedApi.getEndpoint(trigger.path || "") : trigger.path || ""
          });
          break;
        case "sns":
          summary.snsTopics++;
          lambdaDetail.triggers.push({
            type: "SNS Topic",
            name: trigger.resourceName
          });
          break;
        case "sqs":
          summary.sqsQueues++;
          lambdaDetail.triggers.push({
            type: "SQS Queue",
            name: trigger.resourceName
          });
          break;
        case "s3":
          summary.s3Buckets++;
          lambdaDetail.triggers.push({
            type: "S3 Bucket",
            name: trigger.resourceName
          });
          break;
      }
    });

    lambdaDetails.push(lambdaDetail);
    
    // Output for each Lambda
    new cdk.CfnOutput(scope, `Lambda${id}Details-${stage}`, {
      value: JSON.stringify(lambdaDetail),
      description: `LAMBDA_DETAILS`
    });
  });

  // Output for general summary
  new cdk.CfnOutput(scope, `ResourceSummary-${stage}`, {
    value: JSON.stringify(summary),
    description: `RESOURCE_SUMMARY`
  });
  
  // Generate an aggregated output for easier processing
  new cdk.CfnOutput(scope, `CompleteOutput-${stage}`, {
    value: JSON.stringify({
      summary,
      api: sharedApi ? { url: sharedApi.getApiUrl() } : null,
      lambdas: lambdaDetails
    }),
    description: `COMPLETE_DEPLOYMENT_INFO`
  });
} 