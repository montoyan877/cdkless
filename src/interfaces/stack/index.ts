import { BundlingOptions } from "aws-cdk-lib/aws-lambda-nodejs";
import { AwsResourceTags } from "../tags";

export interface IStackSettings {
  /**
   * When enabled, Lambda functions written in TypeScript will be bundled directly from .ts files.
   * This allows you to write your Lambda functions in TypeScript without a separate build step.
   * The bundling process includes:
   * - TypeScript compilation
   * - Dependencies bundling
   * - Code optimization
   * @default true
   */
  bundleLambdasFromTypeScript?: boolean;

  /**
   * Default bundling options for all Lambda functions in the stack
   */
  defaultBundlingOptions?: BundlingOptions;
}

/**
 * Interface for stack operations
 */
export interface IStack {
  /**
   * Get the resource tags from the stack
   */
  getResourceTags(): AwsResourceTags;
}
