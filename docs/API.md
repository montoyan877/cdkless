# CDKless API Reference

This document provides detailed information about the CDKless API, showing various ways to interact with the framework.

## Table of Contents

- [Core Classes](#core-classes)
  - [CdkLess](#cdkless)
  - [LambdaBuilder](#lambdabuilder)
  - [ApiBuilder](#apibuilder)
- [Lambda Configuration](#lambda-configuration)
- [API Gateway Integration](#api-gateway-integration)
- [Event Sources](#event-sources)
- [Resource Permissions](#resource-permissions)
- [Interfaces Reference](#interfaces-reference)

## Core Classes

### CdkLess

The main class that extends AWS CDK's Stack class and provides simplified methods for defining serverless microservices.

#### Constructor

```typescript
constructor(appName: string, stage?: string, props?: cdk.StackProps)
```

**Parameters:**
- `appName`: Name of the application (used to construct the stack name)
- `stage`: Deployment environment (default: process.env.STAGE || 'dev')
- `props`: Additional Stack properties (optional)

**Example:**
```typescript
import { CdkLess } from 'cdkless';

// Basic usage with automatic stage detection
const app = new CdkLess("user-service");

// Explicit stage specification
const prodApp = new CdkLess("user-service", "prod");

// With additional stack properties
const customApp = new CdkLess("user-service", "dev", {
  env: { 
    account: '123456789012', 
    region: 'us-east-1' 
  },
  description: 'User service for customer management'
});
```

#### Properties

- `stage`: The current deployment stage (e.g., 'dev', 'prod')

#### Methods

##### lambda(handler: string): LambdaBuilder

Creates a new Lambda function with the specified handler path.

**Parameters:**
- `handler`: Path to the Lambda function handler file (without extension)

**Returns:** LambdaBuilder instance for fluent configuration

**Example:**
```typescript
// Create a simple Lambda function
app.lambda('src/handlers/users/get-users')
   .get('/users');

// Multiple functions with different configurations
app.lambda('src/handlers/users/create-user')
    .post('/users')
    .memory(512)
    .timeout(cdk.Duration.seconds(10))
    .environment({
      TABLE_NAME: 'users-table'
    });
```

##### getSharedApi(): ApiBuilder | undefined

Returns the shared API Gateway instance, if one has been created.

**Returns:** The shared ApiBuilder instance or undefined if none exists

**Example:**
```typescript
// Get the shared API Gateway
const api = app.getSharedApi();
if (api) {
  console.log(`API URL: ${api.getApiUrl()}`);
  
  // You can also access the underlying CDK construct
  const httpApi = api.getApi();
}
```

##### synth(): void

Synthesizes the CDK application into CloudFormation templates. This is called automatically when the application terminates, but can be called manually if needed.

**Example:**
```typescript
// Set up your lambdas and other resources
app.lambda('src/handlers/users/get-users').get('/users');

// Manually synthesize the application
app.synth();
```

##### getStack(): cdk.Stack

Returns the underlying CDK Stack instance.

**Returns:** The CDK Stack instance

**Example:**
```typescript
// Get the underlying CDK Stack
const stack = app.getStack();

// Now you can use it with other CDK constructs
new cdk.CfnOutput(stack, 'ApiUrl', {
  value: app.getSharedApi()?.getApiUrl() || ''
});
```

### LambdaBuilder

A builder class for configuring Lambda functions with a fluent interface.

#### Constructor

Not typically called directly. Use `CdkLess.lambda()` instead.

```typescript
constructor(props: LambdaBuilderProps)
```

#### HTTP Methods

##### get(path: string, options?: RouteOptions): LambdaBuilder

Adds a GET endpoint to the function.

**Parameters:**
- `path`: API endpoint path (can include path parameters like `:id`)
- `options`: Optional route configuration

**Returns:** The LambdaBuilder instance for method chaining

**Example:**
```typescript
// Basic GET endpoint
app.lambda('src/handlers/users/get-users')
   .get('/users');

// GET endpoint with path parameter
app.lambda('src/handlers/users/get-user-by-id')
   .get('/users/:id');
```

##### post(path: string, options?: RouteOptions): LambdaBuilder

Adds a POST endpoint to the function.

**Parameters:**
- `path`: API endpoint path
- `options`: Optional route configuration

**Returns:** The LambdaBuilder instance for method chaining

**Example:**
```typescript
// Create a POST endpoint for creating users
app.lambda('src/handlers/users/create-user')
   .post('/users');
```

##### put(path: string, options?: RouteOptions): LambdaBuilder

Adds a PUT endpoint to the function.

**Parameters:**
- `path`: API endpoint path (can include path parameters like `:id`)
- `options`: Optional route configuration

**Returns:** The LambdaBuilder instance for method chaining

**Example:**
```typescript
// Create a PUT endpoint for updating a user
app.lambda('src/handlers/users/update-user')
   .put('/users/:id');
```

##### delete(path: string, options?: RouteOptions): LambdaBuilder

Adds a DELETE endpoint to the function.

**Parameters:**
- `path`: API endpoint path (can include path parameters like `:id`)
- `options`: Optional route configuration

**Returns:** The LambdaBuilder instance for method chaining

**Example:**
```typescript
// Create a DELETE endpoint
app.lambda('src/handlers/users/delete-user')
   .delete('/users/:id');
```

##### patch(path: string, options?: RouteOptions): LambdaBuilder

Adds a PATCH endpoint to the function.

**Parameters:**
- `path`: API endpoint path
- `options`: Optional route configuration

**Returns:** The LambdaBuilder instance for method chaining

**Example:**
```typescript
// Create a PATCH endpoint for partial updates
app.lambda('src/handlers/users/patch-user')
   .patch('/users/:id');
```

#### Event Source Integrations

##### addSnsTrigger(topicArn: string, options?: SnsOptions): LambdaBuilder

Subscribes the function to an SNS topic.

**Parameters:**
- `topicArn`: ARN of the SNS topic
- `options`: Optional configuration for the SNS subscription

**Returns:** The LambdaBuilder instance for method chaining

**Example:**
```typescript
// Subscribe to an SNS topic
app.lambda('src/handlers/notifications/process-event')
   .addSnsTrigger('arn:aws:sns:region:account:topic/notifications-topic', {
     filterPolicy: {
       eventType: sns.SubscriptionFilter.stringFilter({
         allowlist: ['USER_CREATED', 'USER_UPDATED']
       })
     }
   });
```

##### addSqsTrigger(queueArn: string, options?: SqsOptions): LambdaBuilder

Configures the function to consume messages from an SQS queue.

**Parameters:**
- `queueArn`: ARN of the SQS queue
- `options`: Optional configuration for the SQS event source

**Returns:** The LambdaBuilder instance for method chaining

**Example:**
```typescript
// Process messages from an SQS queue
app.lambda('src/handlers/orders/process-order')
   .addSqsTrigger('arn:aws:sqs:region:account:queue/orders-queue', {
     batchSize: 10,
     maxBatchingWindow: cdk.Duration.seconds(30),
     reportBatchItemFailures: true
   });
```

##### addS3Trigger(bucketArn: string, options?: S3Options): LambdaBuilder

Configures the function to react to S3 events.

**Parameters:**
- `bucketArn`: ARN of the S3 bucket
- `options`: Optional configuration for the S3 event source

**Returns:** The LambdaBuilder instance for method chaining

**Example:**
```typescript
// Process file uploads in an S3 bucket
app.lambda('src/handlers/documents/process-upload')
   .addS3Trigger('arn:aws:s3:region:account:bucket/documents-bucket', {
     events: [s3.EventType.OBJECT_CREATED_PUT],
     prefix: 'uploads/',
     suffix: '.pdf'
   });
```

#### Resource Permissions

##### addTablePermissions(tableArn: string, options?: PolicyOptions): LambdaBuilder

Adds permissions for the function to access a DynamoDB table.

**Parameters:**
- `tableArn`: ARN of the DynamoDB table
- `options`: Optional IAM policy configuration

**Returns:** The LambdaBuilder instance for method chaining

**Example:**
```typescript
// Grant access to a DynamoDB table
app.lambda('src/handlers/users/get-users')
   .get('/users')
   .addTablePermissions('arn:aws:dynamodb:region:account:table/users-table', {
     includeSubResources: true // Includes {tableArn}/* for indexes
   });
```

##### addS3BucketPermissions(bucketArn: string, options?: PolicyOptions): LambdaBuilder

Adds permissions for the function to access an S3 bucket.

**Parameters:**
- `bucketArn`: ARN of the S3 bucket
- `options`: Optional IAM policy configuration

**Returns:** The LambdaBuilder instance for method chaining

**Example:**
```typescript
// Grant access to an S3 bucket
app.lambda('src/handlers/files/list-files')
   .get('/files')
   .addS3BucketPermissions('arn:aws:s3:region:account:bucket/files-bucket');
```

##### addCustomPolicy(policyStatement: iam.PolicyStatement): LambdaBuilder

Adds a custom IAM policy statement to the Lambda function.

**Parameters:**
- `policyStatement`: IAM policy statement

**Returns:** The LambdaBuilder instance for method chaining

**Example:**
```typescript
// Add a custom policy
import * as iam from 'aws-cdk-lib/aws-iam';

const customPolicy = new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['ses:SendEmail', 'ses:SendRawEmail'],
  resources: ['*']
});

app.lambda('src/handlers/emails/send-email')
   .post('/emails/send')
   .addCustomPolicy(customPolicy);
```

#### Configuration

##### environment(env: Record<string, string>): LambdaBuilder

Adds environment variables to the function.

**Parameters:**
- `env`: Object containing key-value pairs for environment variables

**Returns:** The LambdaBuilder instance for method chaining

**Example:**
```typescript
// Add environment variables
app.lambda('src/handlers/payment/process')
   .post('/payments')
   .environment({
     PAYMENT_API_KEY: 'secret-key',
     STAGE: 'prod',
     LOG_LEVEL: 'INFO'
   });
```

##### memory(size: number): LambdaBuilder

Sets the memory size for the function in MB.

**Parameters:**
- `size`: Memory size in MB (default: 256)

**Returns:** The LambdaBuilder instance for method chaining

**Example:**
```typescript
// Set memory to 512 MB
app.lambda('src/handlers/image/resize')
   .post('/images/resize')
   .memory(512);
```

##### timeout(duration: cdk.Duration): LambdaBuilder

Sets the timeout for the function.

**Parameters:**
- `duration`: Function timeout duration

**Returns:** The LambdaBuilder instance for method chaining

**Example:**
```typescript
// Set timeout to 60 seconds
import * as cdk from 'aws-cdk-lib';

app.lambda('src/handlers/long-running/process')
   .post('/process')
   .timeout(cdk.Duration.seconds(60));
```

##### authorizer(authorizer: apigatewayv2.HttpRouteAuthorizer, scopes?: string[]): LambdaBuilder

Adds an authorizer to all API endpoints for this Lambda.

**Parameters:**
- `authorizer`: HTTP route authorizer
- `scopes`: Optional authorization scopes

**Returns:** The LambdaBuilder instance for method chaining

**Example:**
```typescript
// Add a JWT authorizer
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';

const jwtAuthorizer = new HttpJwtAuthorizer(
  'UserAuthorizer',
  'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_poolId',
  {
    jwtAudience: ['client-id']
  }
);

app.lambda('src/handlers/protected/resource')
   .get('/protected')
   .authorizer(jwtAuthorizer, ['profile:read']);
```

#### Access Methods

##### getLambda(): lambda.Function

Returns the underlying Lambda function instance.

**Returns:** The CDK Lambda Function instance

**Example:**
```typescript
// Get the underlying Lambda function
const fn = app.lambda('src/handlers/test')
  .get('/test')
  .getLambda();
  
// Now you can use the function with other CDK constructs
new cdk.CfnOutput(app, 'LambdaArn', {
  value: fn.functionArn
});
```

### ApiBuilder

A utility class for building HTTP APIs. Typically used internally by LambdaBuilder, but can be accessed via `getSharedApi()`.

#### Methods

##### getApi(): apigateway.HttpApi

Returns the underlying API Gateway HTTP API instance.

**Returns:** The CDK HTTP API instance

**Example:**
```typescript
const api = app.getSharedApi()?.getApi();
if (api) {
  // Access the underlying API Gateway
  console.log(api.httpApiId);
}
```

##### getApiUrl(): string

Returns the base URL of the API.

**Returns:** The API Gateway URL

**Example:**
```typescript
const apiUrl = app.getSharedApi()?.getApiUrl();
console.log(`API URL: ${apiUrl}`);
```

##### getEndpoint(path: string, stage?: string): string

Returns the full URL for a specific endpoint.

**Parameters:**
- `path`: The endpoint path
- `stage`: Optional stage name (defaults to the current stage)

**Returns:** The full endpoint URL

**Example:**
```typescript
const api = app.getSharedApi();
if (api) {
  const userEndpoint = api.getEndpoint('/users');
  console.log(`Users endpoint: ${userEndpoint}`);
}
```

## Lambda Configuration

Here are more complete examples of configuring Lambda functions with CDKless:

### Basic Lambda with API Endpoint

```typescript
app.lambda('src/handlers/users/get-users')
   .get('/users');
```

### Lambda with Multiple Endpoints

```typescript
const userLambda = app.lambda('src/handlers/users/user-operations');
userLambda.get('/users');
userLambda.post('/users');
userLambda.get('/users/:id');
userLambda.put('/users/:id');
userLambda.delete('/users/:id');
```

### Lambda with Advanced Configuration

```typescript
app.lambda('src/handlers/image/process')
   .post('/images/process')
   .memory(1024)
   .timeout(cdk.Duration.seconds(30))
   .environment({
     BUCKET_NAME: 'images-bucket',
     THUMBNAIL_SIZE: '200x200',
     API_KEY: 'secret-api-key'
   })
   .addS3BucketPermissions('arn:aws:s3:region:account:bucket/images-bucket');
```

## API Gateway Integration

Examples of API Gateway integration:

### Multiple HTTP Methods

```typescript
// Define multiple endpoints with different HTTP methods
app.lambda('src/handlers/users/get-users').get('/users');
app.lambda('src/handlers/users/create-user').post('/users');
app.lambda('src/handlers/users/get-user-by-id').get('/users/:id');
app.lambda('src/handlers/users/update-user').put('/users/:id');
app.lambda('src/handlers/users/delete-user').delete('/users/:id');
```

### With Authorization

```typescript
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';

// Create a JWT authorizer for your Cognito User Pool
const jwtAuthorizer = new HttpJwtAuthorizer(
  'CognitoAuthorizer',
  'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_poolId',
  {
    jwtAudience: ['client-id']
  }
);

// Apply the authorizer to endpoints
app.lambda('src/handlers/users/get-me')
   .get('/users/me')
   .authorizer(jwtAuthorizer, ['profile:read']);

app.lambda('src/handlers/admin/dashboard')
   .get('/admin/dashboard')
   .authorizer(jwtAuthorizer, ['admin:read']);
```

## Event Sources

Examples of configuring event sources:

### SNS Topic

```typescript
// Process events from an SNS topic
app.lambda('src/handlers/notifications/process-event')
   .addSnsTrigger('arn:aws:sns:region:account:topic/notifications-topic', {
     filterPolicy: {
       eventType: sns.SubscriptionFilter.stringFilter({
         allowlist: ['USER_CREATED', 'USER_UPDATED']
       })
     }
   });
```

### SQS Queue

```typescript
// Process messages from an SQS queue
app.lambda('src/handlers/orders/process-order')
   .addSqsTrigger('arn:aws:sqs:region:account:queue/orders-queue', {
     batchSize: 10,
     maxBatchingWindow: cdk.Duration.seconds(30),
     reportBatchItemFailures: true
   });
```

### S3 Events

```typescript
// Process S3 events
app.lambda('src/handlers/files/process-upload')
   .addS3Trigger('arn:aws:s3:region:account:bucket/files-bucket', {
     events: [s3.EventType.OBJECT_CREATED_PUT, s3.EventType.OBJECT_CREATED_POST],
     prefix: 'uploads/',
     suffix: '.pdf'
   });
```

## Resource Permissions

Examples of adding resource permissions:

### DynamoDB Table

```typescript
// Grant permissions to a DynamoDB table
app.lambda('src/handlers/users/crud-operations')
   .get('/users')
   .post('/users')
   .put('/users/:id')
   .delete('/users/:id')
   .addTablePermissions('arn:aws:dynamodb:region:account:table/users-table', {
     includeSubResources: true
   });
```

### S3 Bucket

```typescript
// Grant permissions to an S3 bucket
app.lambda('src/handlers/files/file-operations')
   .get('/files')
   .post('/files')
   .delete('/files/:id')
   .addS3BucketPermissions('arn:aws:s3:region:account:bucket/files-bucket');
```

### Custom IAM Policy

```typescript
// Add a custom IAM policy
import * as iam from 'aws-cdk-lib/aws-iam';

const sesPolicy = new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['ses:SendEmail', 'ses:SendRawEmail'],
  resources: ['*']
});

app.lambda('src/handlers/notifications/send-email')
   .post('/send-email')
   .addCustomPolicy(sesPolicy);
```

## Interfaces Reference

CDKless has a well-organized set of TypeScript interfaces that you can use when extending the library or creating advanced configurations.

### Lambda Interfaces

```typescript
import { 
  LambdaBuilderProps, 
  SnsOptions, 
  SqsOptions, 
  S3Options,
  PolicyOptions,
  LambdaInfo,
  TriggerInfo
} from 'cdkless';
```

#### LambdaBuilderProps

Properties required to create a LambdaBuilder.

```typescript
interface LambdaBuilderProps {
  scope: Construct; 
  handler: string;
}
```

#### SnsOptions

Options for SNS topic integration.

```typescript
interface SnsOptions {
  filterPolicy?: { [key: string]: sns.SubscriptionFilter };
  deadLetterQueue?: sqs.IQueue;
}
```

#### SqsOptions

Options for SQS queue integration.

```typescript
interface SqsOptions {
  batchSize?: number;
  maxBatchingWindow?: cdk.Duration;
  enabled?: boolean;
  reportBatchItemFailures?: boolean;
  maxConcurrency?: number;
}
```

#### S3Options

Options for S3 bucket integration.

```typescript
interface S3Options {
  events?: s3.EventType[];
  filters?: s3.NotificationKeyFilter[];
  prefix?: string;
  suffix?: string;
}
```

### API Interfaces

```typescript
import { ApiBuilderProps, RouteOptions } from 'cdkless';
```

#### ApiBuilderProps

Properties for creating an ApiBuilder.

```typescript
interface ApiBuilderProps {
  scope: Construct;
  id: string;
  apiName?: string;
  description?: string;
  stageName?: string;
  useDefaultCors?: boolean;
  binaryMediaTypes?: string[];
  disableExecuteApiEndpoint?: boolean;
}
```

#### RouteOptions

Options for configuring API routes.

```typescript
interface RouteOptions {
  authorizer?: apigatewayv2.IHttpRouteAuthorizer;
  [key: string]: any;
}
```

This comprehensive API documentation should provide you with all the information you need to effectively use CDKless for building serverless applications. 