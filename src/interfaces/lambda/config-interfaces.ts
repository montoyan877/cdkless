import {
  SnsOptions,
  SqsOptions,
  S3Options,
  EventBridgeRuleOptions,
  DynamoStreamsOptions
} from './lambda-options';
import { PolicyOptions } from './lambda-props';
import { AuthenticationMethod } from 'aws-cdk-lib/aws-lambda-event-sources';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';

/**
 * Configuration for SNS triggers
 */
export interface SnsConfig {
  /** ARN of the SNS topic */
  topicArn: string;
  /** Additional options for the SNS subscription */
  options?: SnsOptions;
}

/**
 * Configuration for SQS triggers
 */
export interface SqsConfig {
  /** ARN of the SQS queue */
  queueArn: string;
  /** Additional options for the SQS event source */
  options?: SqsOptions;
}

/**
 * Configuration for S3 triggers
 */
export interface S3Config {
  /** ARN of the S3 bucket */
  bucketArn: string;
  /** Additional options for the S3 event source */
  options?: S3Options;
}

/**
 * Configuration for IAM policies
 */
export interface PolicyConfig {
  /** ARN of the resource */
  arn: string;
  /** List of IAM actions to allow */
  actions: string[];
  /** Additional policy configuration options */
  options?: PolicyOptions;
} 

/**
 * Configuration for EventBridge rule triggers
 */
export interface EventBridgeRuleConfig {
  /** Options for the EventBridge rule */
  options: EventBridgeRuleOptions;
}

/**
 * Configuration for Kafka triggers
 */
export interface MSKConfig {
  /** ARN of the MSK cluster */
  clusterArn: string;
  /** Topic name */
  topic: string;
  /** ARN of the secret containing Kafka credentials */
  secretArn: string;
  /** Batch size for messages */
  batchSize?: number;
  /** Maximum waiting time to accumulate messages in a batch */
  maximumBatchingWindow?: number;
  /** Starting position for the Kafka consumer */
  startingPosition?: StartingPosition;
  /** Whether the integration is enabled */
  enabled?: boolean;
  /** Consumer group ID */
  consumerGroupId?: string;
  /** Starting position date format ISO String */
  startingPositionDate?: string;
}

export interface SMKConfig {
  /** Bootstrap servers for Kafka */
  bootstrapServers: string[];
  /** Topic name */
  topic: string;
  /** ARN of the secret containing Kafka credentials */
  secretArn: string;
  /** Authentication method */
  authenticationMethod?: AuthenticationMethod;
  /** Batch size for messages */
  batchSize?: number;
  /** Maximum waiting time to accumulate messages in a batch */
  maximumBatchingWindow?: number;
  /** Starting position for the Kafka consumer */
  startingPosition?: StartingPosition;
  /** Whether the integration is enabled */
  enabled?: boolean;
  /** Consumer group ID */
  consumerGroupId?: string;
  /** Starting position date format ISO String */
  startingPositionDate?: string;
  
  // ===== ADVANCED OPTIONS =====
  
  /**
   * Destination configuration for failed records.
   * Supports SQS queues, SNS topics, or S3 buckets as Dead Letter Queue.
   * 
   * CloudFormation will validate the ARN at deployment time.
   * 
   * Examples:
   * ```typescript
   * // SQS Queue (literal ARN)
   * onFailure: {
   *   destination: 'arn:aws:sqs:us-east-1:123456789012:my-dlq',
   *   destinationType: 'sqs'
   * }
   * 
   * // SQS Queue (imported from CloudFormation)
   * onFailure: {
   *   destination: Fn.importValue('MyDLQArn'),
   *   destinationType: 'sqs'
   * }
   * 
   * // SNS Topic
   * onFailure: {
   *   destination: 'arn:aws:sns:us-east-1:123456789012:my-topic',
   *   destinationType: 'sns'
   * }
   * 
   * // S3 Bucket
   * onFailure: {
   *   destination: 'arn:aws:s3:::my-failed-records-bucket',
   *   destinationType: 's3'
   * }
   * ```
   * 
   * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html#invocation-async-destinations
   */
  onFailure?: {
    /**
     * ARN of the destination resource.
     * Can be a literal string or CloudFormation token (Fn.importValue, Ref, etc.)
     */
    destination: string;
    
    /**
     * Type of the destination resource: 'sqs', 'sns', or 's3'
     */
    destinationType: 'sqs' | 'sns' | 's3';
  };
}

/**
 * Configuration for DynamoDB Streams triggers
 */
export interface DynamoStreamsConfig {
  /** ARN of the DynamoDB table */
  streamArn: string;
  /** Additional options for the DynamoDB Streams event source */
  options?: DynamoStreamsOptions;
}