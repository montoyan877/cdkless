/**
 * CdkLess - Ultra-simplified AWS CDK Framework
 * 
 * A framework for building serverless microservices with AWS CDK
 * using an intuitive, fluent API.
 * 
 * @packageDocumentation
 */

export { CdkLess } from './base-stack';
export { LambdaBuilder } from './lambda-builder';
export { ApiBuilder } from './api-builder';

// Export interfaces for public use
export type { 
  LambdaBuilderProps,
  SnsOptions,
  SqsOptions,
  S3Options,
  PolicyOptions
} from './interfaces/lambda';

export type {
  ApiBuilderProps
} from './interfaces/api';

// No exportamos las interfaces de formateo ya que son de uso interno 