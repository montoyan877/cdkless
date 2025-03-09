import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';

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