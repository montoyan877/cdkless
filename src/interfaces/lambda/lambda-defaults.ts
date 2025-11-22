import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import { AwsResourceTags } from "../tags";
import { IVpcConfig } from "./lambda-vpc";

/**
 * Default configuration options for Lambda functions
 */
export interface DefaultLambdaOptions {
  /** Default memory size in MB */
  memorySize?: number;
  /** Default timeout duration */
  timeout?: cdk.Duration;
  /** Default runtime */
  runtime?: lambda.Runtime;
  /** Default architecture (x86_64 or arm64) */
  architecture?: lambda.Architecture;
  /** Default environment variables */
  environment?: { [key: string]: string };
  /** Default log retention period */
  logRetention?: logs.RetentionDays;
  /** Default vpc config */
  vpc?: IVpcConfig;
}
