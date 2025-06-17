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

  /**
   * Default tags that will be applied to both the stack and all resources.
   * If provided, these tags will REPLACE the automatic ProjectName tag.
   * If not provided, an automatic ProjectName tag will be used instead.
   * Additional tags can be added later via addStackTags() or addResourceTags().
   * 
   * Tag inheritance order:
   * 1. Either these defaultTags OR automatic ProjectName tag
   * 2. Tags added via addStackTags() and addResourceTags()
   * 3. Lambda-specific tags added via addTags()
   * 
   * @default undefined (uses automatic ProjectName tag)
   */
  defaultTags?: AwsResourceTags;
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
