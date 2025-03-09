import * as lambda from 'aws-cdk-lib/aws-lambda';

/**
 * Information about a trigger for a Lambda function
 */
export interface TriggerInfo {
  /** Trigger type: sns, sqs, s3 or api */
  type: "sns" | "sqs" | "s3" | "api";
  /** ARN of the resource associated with the trigger */
  resourceArn?: string;
  /** Name of the resource associated with the trigger */
  resourceName?: string;
  /** HTTP method for API type triggers */
  method?: string;
  /** Path for API type triggers */
  path?: string;
}

/**
 * Information about a Lambda function
 */
export interface LambdaInfo {
  /** Lambda function identifier */
  id: string;
  /** Reference to the CDK Lambda function */
  lambda: lambda.Function;
  /** List of triggers configured for the Lambda */
  triggers: TriggerInfo[];
  /** Memory configured for the Lambda (in MB) */
  memory?: number;
  /** Timeout configured for the Lambda (in seconds) */
  timeout?: number;
  /** Environment variables configured for the Lambda */
  environment?: Record<string, string>;
} 