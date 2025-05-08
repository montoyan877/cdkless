import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import {
  SnsOptions,
  SqsOptions,
  S3Options,
  EventBridgeRuleOptions
} from './lambda-options';
import { PolicyOptions } from './lambda-props';
import { AuthenticationMethod } from 'aws-cdk-lib/aws-lambda-event-sources';

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
}