/**
 * Structure for resource summary
 */
export interface ResourceSummary {
  /** CloudFormation stack name */
  stackName: string;
  /** Deployment stage (dev, prod, etc.) */
  stage: string;
  /** Total number of Lambda functions */
  lambdaCount: number;
  /** Total number of API Gateway endpoints */
  apiEndpoints: number;
  /** Total number of SNS topics */
  snsTopics: number;
  /** Total number of SQS queues */
  sqsQueues: number;
  /** Total number of S3 buckets */
  s3Buckets: number;
}

/**
 * Structure for trigger details
 */
export interface TriggerDetail {
  /** Trigger type (API Gateway, SNS, SQS, S3) */
  type: string;
  /** HTTP method for API Gateway triggers */
  method?: string;
  /** Path for API Gateway triggers */
  path?: string;
  /** Resource name for other trigger types */
  name?: string;
}

/**
 * Structure for Lambda details
 */
export interface LambdaDetail {
  /** Lambda function name */
  name: string;
  /** Configured memory (in MB) */
  memory: number | string;
  /** Configured timeout (in seconds) */
  timeout: string | number;
  /** Environment variables */
  environment: Record<string, string>;
  /** List of configured triggers */
  triggers: TriggerDetail[];
}

/**
 * Complete structure for CloudFormation output
 */
export interface CompleteOutput {
  /** Summary of deployed resources */
  summary: ResourceSummary;
  /** API Gateway information (if exists) */
  api: {
    url: string;
  } | null;
  /** Details of all Lambda functions */
  lambdas: LambdaDetail[];
} 