import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BundlingOptions } from 'aws-cdk-lib/aws-lambda-nodejs';

/**
 * Required properties to create a LambdaBuilder
 */
export interface LambdaBuilderProps {
  /** Scope is still required for CDK */
  scope: Construct; 
  /** Only required parameter - path to handler (without extension) */
  handler: string;
  /** Optional bundling configuration for the Lambda function */
  bundling?: BundlingOptions;
}

/**
 * Options for IAM policy
 */
export interface PolicyOptions {
  /** If true, also adds `${arn}/*` as a resource */
  includeSubResources?: boolean;
  /** Effect.ALLOW by default */
  effect?: cdk.aws_iam.Effect;
}

/**
 * Configuration for attaching an existing IAM role to a Lambda function
 */
export interface IamRoleConfig {
  /** Existing IAM role to attach */
  role?: cdk.aws_iam.IRole;
  /** ARN of an existing IAM role to attach */
  roleArn?: string;
} 