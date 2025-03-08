# CdkLess API Reference

This document provides detailed information about the CdkLess API.

## CdkLess

The main class that extends AWS CDK's Stack class and provides simplified methods for defining serverless microservices.

### Constructor

```typescript
constructor(appName: string, stage?: string, props?: cdk.StackProps)
```

- `appName`: Name of the application
- `stage`: Deployment environment (default: process.env.STAGE || 'dev')
- `props`: Additional Stack properties (optional)

### Properties

- `stage`: The current deployment stage (e.g., 'dev', 'prod')

### Methods

#### lambda(handler: string): LambdaBuilder

Creates a new Lambda function with the specified handler path.

```typescript
// Example
this.lambda('src/handlers/users/get-users');
```

#### getSharedApi(): ApiBuilder | undefined

Returns the shared API Gateway instance, if one has been created.

```typescript
// Example
const api = this.getSharedApi();
if (api) {
  console.log(`API URL: ${api.getApiUrl()}`);
}
```

#### synth(): void

Synthesizes the CDK application into CloudFormation templates. 
This is called automatically when the application terminates.

## LambdaBuilder

A builder class for configuring Lambda functions with a fluent interface.

### HTTP Methods

#### get(path: string): LambdaBuilder

Adds a GET endpoint to the function.

```typescript
// Example
this.lambda('src/handlers/users/get-users')
  .get('/users');
```

#### post(path: string): LambdaBuilder

Adds a POST endpoint to the function.

```typescript
// Example
this.lambda('src/handlers/users/create-user')
  .post('/users');
```

#### put(path: string): LambdaBuilder

Adds a PUT endpoint to the function.

```typescript
// Example
this.lambda('src/handlers/users/update-user')
  .put('/users/:id');
```

#### delete(path: string): LambdaBuilder

Adds a DELETE endpoint to the function.

```typescript
// Example
this.lambda('src/handlers/users/delete-user')
  .delete('/users/:id');
```

### Resource Integration

#### addTablePermissions(tableArn: string): LambdaBuilder

Adds permissions for the function to access a DynamoDB table.

```typescript
// Example
this.lambda('src/handlers/orders/get-orders')
  .get('/orders')
  .addTablePermissions('arn:aws:dynamodb:region:account:table/orders-table');
```

#### addTrigger(topicArn: string, options?: SnsOptions): LambdaBuilder

Subscribes the function to an SNS topic.

```typescript
// Example
this.lambda('src/handlers/notifications/send-email')
  .addTrigger('arn:aws:sns:region:account:topic/notifications-topic');
```

#### addQueue(queueArn: string, options?: SqsOptions): LambdaBuilder

Configures the function to consume messages from an SQS queue.

```typescript
// Example
this.lambda('src/handlers/orders/process-order')
  .addQueue('arn:aws:sqs:region:account:queue/orders-queue');
```

#### addS3Bucket(bucketArn: string, options?: S3Options): LambdaBuilder

Configures the function to react to S3 events.

```typescript
// Example
this.lambda('src/handlers/documents/process-upload')
  .addS3Bucket('arn:aws:s3:region:account:bucket/documents-bucket');
```

### Configuration

#### environment(env: { [key: string]: string }): LambdaBuilder

Adds environment variables to the function.

```typescript
// Example
this.lambda('src/handlers/payment/process')
  .post('/payments')
  .environment({
    PAYMENT_API_KEY: 'secret-key',
    STAGE: this.stage,
    LOG_LEVEL: 'INFO'
  });
```

#### runtime(runtime: lambda.Runtime): LambdaBuilder

Sets the runtime for the function (default: NodejsFunction.NODEJS_20_X).

```typescript
// Example
this.lambda('src/handlers/legacy/process')
  .runtime(lambda.Runtime.NODEJS_16_X);
```

#### memory(size: number): LambdaBuilder

Sets the memory size for the function in MB (default: 256).

```typescript
// Example
this.lambda('src/handlers/data-processing/transform')
  .memory(512);
```

#### timeout(duration: cdk.Duration): LambdaBuilder

Sets the timeout for the function (default: 30 seconds).

```typescript
// Example
this.lambda('src/handlers/long-running/process')
  .timeout(cdk.Duration.seconds(60));
```

### Access Methods

#### getLambda(): lambda.Function

Returns the underlying Lambda function instance.

```typescript
// Example
const fn = this.lambda('src/handlers/test')
  .get('/test')
  .getLambda();
  
// Now you can use the function with other CDK constructs
new cdk.CfnOutput(this, 'LambdaArn', {
  value: fn.functionArn
});
```

## ApiBuilder

A utility class for building HTTP APIs. Typically used internally by LambdaBuilder, but can be accessed via `getSharedApi()`.

### Methods

#### getApi(): apigateway.HttpApi

Returns the underlying API Gateway HTTP API instance.

#### getApiUrl(): string

Returns the base URL of the API.

#### getEndpoint(path: string, stage?: string): string

Returns the full URL for a specific endpoint. 