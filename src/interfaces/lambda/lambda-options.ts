import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as lambda from 'aws-cdk-lib/aws-lambda';
/**
 * Options for SNS integration
 */
export interface SnsOptions {
  /** Policy filter for SNS subscription */
  filterPolicy?: { [key: string]: sns.SubscriptionFilter };
  /** Dead letter queue */
  deadLetterQueue?: sqs.IQueue;
}

/**
 * Options for SQS integration
 */
export interface SqsOptions {
  /** Batch size for messages */
  batchSize?: number;
  /** Maximum waiting time to accumulate messages in a batch */
  maxBatchingWindow?: cdk.Duration;
  /** Indicates if the integration is enabled */
  enabled?: boolean;
  /** Indicates if individual batch item failures will be reported */
  reportBatchItemFailures?: boolean;
  /** Maximum number of concurrent function invocations */
  maxConcurrency?: number;
}

/**
 * Options for S3 integration
 */
export interface S3Options {
  /** Event types that will trigger the Lambda function */
  events?: s3.EventType[];
  /** Filters for events based on object keys */
  filters?: s3.NotificationKeyFilter[];
  /** Prefix for filtering objects */
  prefix?: string;
  /** Suffix for filtering objects */
  suffix?: string;
} 

/**
 * Options for EventBridge rule integration
 */
export interface EventBridgeRuleOptions {
  /** Event pattern for the rule */
  eventPattern?: events.EventPattern;
  /** Schedule expression for the rule */
  scheduleExpression?: string;
  /** Description for the rule */
  description?: string;
  /** Whether the rule is enabled */
  enabled?: boolean;
  /** Rule name */
  ruleName?: string;
}

export interface DynamoStreamsOptions {
  /** Batch size for messages */
  batchSize?: number;
  /** Maximum waiting time to accumulate messages in a batch */
  maxBatchingWindow?: number;
  /** Starting position for the stream consumer */
  startingPosition?: lambda.StartingPosition;
  /** Whether the integration is enabled */
  enabled?: boolean;
  /** Retry attempts for failed records */
  retryAttempts?: number;
  /** Whether to report batch item failures */
  reportBatchItemFailures?: boolean;
  /** Filters for the DynamoDB stream */
  filters?: lambda.FilterCriteria[];
}
