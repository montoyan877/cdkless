# CDKless API Reference

This document provides detailed information about the CDKless API, showing various ways to interact with the framework.

## Table of Contents

- [Core Classes](#core-classes)
  - [CdkLess](#cdkless)
  - [LambdaBuilder](#lambdabuilder)
  - [ApiBuilder](#apibuilder)
- [Lambda Configuration](#lambda-configuration)
- [Lambda Layers](#lambda-layers)
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
import { CdkLess } from "cdkless";

// Basic usage with automatic stage detection
const app = new CdkLess({ appName: "user-services" });

// Explicit stage specification
const prodApp = new CdkLess({ appName: "user-services", stage: "prod" });

// Additional settings
const prodApp = new CdkLess({
  appName: "user-services",
  settings: {
    bundleLambdasFromTypeScript: true,
    defaultBundlingOptions: {
      minify: false,
      sourceMap: false,
      externalModules: ["aws-sdk", "@aws-sdk/*", "/opt/*"],
    },
  },
});

// With additional stack properties
const customApp = new CdkLess({
  appName: "user-services",
  stage: "prod",
  stackProps: {
    env: {
      account: "123456789012",
      region: "us-east-1",
    },
    description: "User service for customer management",
  },
});
```

#### Properties

- `stage`: The current deployment stage (e.g., 'dev', 'prod')
- `stackProps`: The CDK Stack props options.
- `settings`: The Cdkless settings options:
  - `settings.bundleLambdasFromTypeScript`: (Default: true) Controls TypeScript bundling behavior for Lambda functions:
    - When true (default): Pass TypeScript handlers directly. Cdkless will handle the bundling process automatically.
    - When false: You need to precompile your TypeScript code and pass JavaScript handlers instead.
  - `settings.defaultBundlingOptions`: Configure bundling options for TypeScript Lambda functions. Options include:
    - `minify`: (boolean) Enable/disable code minification
    - `sourceMap`: (boolean) Generate source maps
    - `externalModules`: (string[]) Modules to exclude from bundling (e.g., ['aws-sdk'])
    - And other esbuild options
  - `settings.defaultTags`: (Default: {}) Default tags that will be applied to both the stack and all resources:
    - By default, a `ProjectName` tag is automatically added with the value of your stack ID
    - Additional default tags can be specified here and will be merged with the `ProjectName` tag
    - These tags will be applied to both the stack and all resources
    - You can still add more tags later using `addStackTags()` or `addResourceTags()`
  - `settings.defaultLambdaOptions`: (Default: {}) Default configuration options for all Lambda functions:
    - `memorySize`: (number) Default memory size in MB
    - `timeout`: (cdk.Duration) Default timeout duration
    - `runtime`: (lambda.Runtime) Default runtime
    - `architecture`: (lambda.Architecture) Default architecture (x86_64 or arm64)
    - `environment`: ({ [key: string]: string }) Default environment variables
    - `logRetention`: (logs.RetentionDays) Default log retention period
    - These defaults can be overridden at the function level using the corresponding methods

**Example with Default Lambda Options:**

```typescript
const app = new CdkLess({
  appName: "user-services",
  stage: "prod",
  settings: {
    defaultLambdaOptions: {
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        NODE_ENV: "production",
        LOG_LEVEL: "info"
      },
      logRetention: logs.RetentionDays.ONE_WEEK
    }
  }
});

// All Lambda functions will inherit these defaults
app.lambda("src/handlers/users/get-users").get("/users");

// You can still override defaults for specific functions
app.lambda("src/handlers/image/process")
  .post("/images/process")
  .memory(1024)  // Override default memory
  .timeout(cdk.Duration.minutes(5));  // Override default timeout
```

**Example with Default Tags:**

```typescript
const app = new CdkLess({
  appName: "user-services",
  stage: "prod",
  settings: {
    defaultTags: {
      Environment: "production",
      Owner: "team-a",
      CostCenter: "123456"
    }
  }
});

// The stack and all resources will automatically have these tags:
// - ProjectName: user-services-prod
// - Environment: production
// - Owner: team-a
// - CostCenter: 123456

// You can still add more tags later
app.addStackTags({
  Critical: "true"
});
```

#### Methods

##### lambda(handler: string): LambdaBuilder

Creates a new Lambda function with the specified handler path.

**Parameters:**

- `handler`: Path to the Lambda function handler file (without extension)

**Returns:** LambdaBuilder instance for fluent configuration

**Example:**

```typescript
// Create a simple Lambda function
app.lambda("src/handlers/users/get-users").get("/users");

// Multiple functions with different configurations
app
  .lambda("src/handlers/users/create-user")
  .post("/users")
  .memory(512)
  .timeout(cdk.Duration.seconds(10))
  .environment({
    TABLE_NAME: "users-table",
  });
```

> **Note:** The handler path provided to `.lambda()` should be relative to the location of your `cdk.json` file, which should be placed at the root of your project.

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
app.lambda("src/handlers/users/get-users").get("/users");

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
new cdk.CfnOutput(stack, "ApiUrl", {
  value: app.getSharedApi()?.getApiUrl() || "",
});
```

### LambdaBuilder

A builder class for configuring Lambda functions with a fluent interface.

#### Constructor

Not typically called directly. Use `CdkLess.lambda()` instead.

```typescript
constructor(props: LambdaBuilderProps)
```

#### Naming Lambda Functions

##### name(functionName: string): LambdaBuilder

Sets a custom name for the Lambda function.

**Parameters:**

- `functionName`: The custom name for the Lambda function

**Returns:** The LambdaBuilder instance for method chaining

**Example:**

```typescript
// Set a custom Lambda function name
app
  .lambda("src/handlers/users/create-user")
  .name(`${APP_NAME}-create-user-lambda`)
  .post("/users");

// Multiple configurations can be chained
app
  .lambda("src/handlers/orders/process-order")
  .name(`${APP_NAME}-process-order-lambda`)
  .post("/orders")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/orders-table");
```

> By default, CdkLess assigns a name to each Lambda function based on the filename containing the handler. However, it's recommended to specify custom names for better clarity and to avoid duplication errors when deploying.

#### HTTP Methods

##### get(path: string): LambdaBuilder

Adds a GET endpoint to the function.

**Parameters:**

- `path`: API endpoint path (can include path parameters like `:id`)

**Returns:** The LambdaBuilder instance for method chaining

**Example:**

```typescript
// Basic GET endpoint
app.lambda("src/handlers/users/get-users").get("/users");

// GET endpoint with path parameter
app.lambda("src/handlers/users/get-user-by-id").get("/users/:id");
```

##### post(path: string): LambdaBuilder

Adds a POST endpoint to the function.

**Parameters:**

- `path`: API endpoint path

**Returns:** The LambdaBuilder instance for method chaining

**Example:**

```typescript
// Create a POST endpoint for creating users
app.lambda("src/handlers/users/create-user").post("/users");
```

##### put(path: string): LambdaBuilder

Adds a PUT endpoint to the function.

**Parameters:**

- `path`: API endpoint path (can include path parameters like `:id`)

**Returns:** The LambdaBuilder instance for method chaining

**Example:**

```typescript
// Create a PUT endpoint for updating a user
app.lambda("src/handlers/users/update-user").put("/users/:id");
```

##### delete(path: string): LambdaBuilder

Adds a DELETE endpoint to the function.

**Parameters:**

- `path`: API endpoint path (can include path parameters like `:id`)

**Returns:** The LambdaBuilder instance for method chaining

**Example:**

```typescript
// Create a DELETE endpoint
app.lambda("src/handlers/users/delete-user").delete("/users/:id");
```

##### patch(path: string): LambdaBuilder

Adds a PATCH endpoint to the function.

**Parameters:**

- `path`: API endpoint path

**Returns:** The LambdaBuilder instance for method chaining

**Example:**

```typescript
// Create a PATCH endpoint for partial updates
app.lambda("src/handlers/users/patch-user").patch("/users/:id");
```

#### Event Source Integrations

##### addEventBridgeRuleTrigger(options: EventBridgeRuleOptions): LambdaBuilder

Creates an EventBridge rule that triggers the Lambda function.

**Parameters:**

- `options`: Configuration for the EventBridge rule

**Returns:** The LambdaBuilder instance for method chaining

**Example:**

```typescript
// Create a scheduled rule
app.lambda("src/handlers/scheduled/daily-report").addEventBridgeRuleTrigger({
  scheduleExpression: "cron(0 12 * * ? *)", // Run daily at 12:00 PM UTC
  description: "Trigger daily report generation",
});

// Create an event pattern rule
app
  .lambda("src/handlers/events/process-state-change")
  .addEventBridgeRuleTrigger({
    eventPattern: {
      source: ["aws.ec2"],
      detailType: ["EC2 Instance State-change Notification"],
    },
    description: "Process EC2 state changes",
  });
```

##### addSnsTrigger(topicArn: string, options?: SnsOptions): LambdaBuilder

Subscribes the function to an SNS topic.

**Parameters:**

- `topicArn`: ARN of the SNS topic
- `options`: Optional configuration for the SNS subscription

**Returns:** The LambdaBuilder instance for method chaining

**Example:**

```typescript
// Subscribe to an SNS topic
app
  .lambda("src/handlers/notifications/process-event")
  .addSnsTrigger("arn:aws:sns:region:account:topic/notifications-topic", {
    filterPolicy: {
      eventType: sns.SubscriptionFilter.stringFilter({
        allowlist: ["USER_CREATED", "USER_UPDATED"],
      }),
    },
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
app
  .lambda("src/handlers/orders/process-order")
  .addSqsTrigger("arn:aws:sqs:region:account:queue/orders-queue", {
    batchSize: 10,
    maxBatchingWindow: cdk.Duration.seconds(30),
    reportBatchItemFailures: true,
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
app
  .lambda("src/handlers/documents/process-upload")
  .addS3Trigger("arn:aws:s3:region:account:bucket/documents-bucket", {
    events: [s3.EventType.OBJECT_CREATED_PUT],
    prefix: "uploads/",
    suffix: ".pdf",
  });
```

#### Resource Permissions

##### addTablePermissions(tableArn: string): LambdaBuilder

Adds permissions for the function to access a DynamoDB table.

**Parameters:**

- `tableArn`: ARN of the DynamoDB table

**Returns:** The LambdaBuilder instance for method chaining

**Example:**

```typescript
// Grant access to a DynamoDB table
app
  .lambda("src/handlers/users/get-users")
  .get("/users")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/users-table");
```

##### addPolicy(resourceArn: string, actions: string[]): LambdaBuilder

Adds a custom policy with specific actions for a resource.

**Parameters:**

- `resourceArn`: ARN of the resource
- `actions`: List of IAM actions to allow

**Returns:** The LambdaBuilder instance for method chaining

**Example:**

```typescript
// Add a custom policy with specific actions
app
  .lambda("src/handlers/files/upload")
  .post("/files")
  .addPolicy("arn:aws:s3:region:account:bucket/uploads-bucket", [
    "s3:GetObject",
    "s3:PutObject",
  ])
  .addPolicy("arn:aws:sns:us-east-1:123456789012:mi-topic", ["SNS:Publish"]);
```

##### addRole(options: RoleOptions): LambdaBuilder

Adds a pre-existing IAM role to the Lambda function, overriding the default execution role.

**Parameters:**

- `options`: Role configuration options containing either a role construct or role ARN

**Returns:** The LambdaBuilder instance for method chaining

**Example:**

```typescript
// Method 1: Using role ARN
app
  .lambda("src/handlers/admin/dashboard")
  .get("/admin/dashboard")
  .addRole({
    roleArn: "arn:aws:iam::123456789012:role/my-existing-lambda-role"
  });

// Method 2: Using an IRole construct
import * as iam from "aws-cdk-lib/aws-iam";

const existingRole = iam.Role.fromRoleArn(
  app,
  "ImportedRole",
  "arn:aws:iam::123456789012:role/another-existing-role"
);

app
  .lambda("src/handlers/orders/process")
  .post("/orders")
  .addRole({
    role: existingRole
  });
```

**Key Points:**

- **Optional Feature**: You only need to use `.addRole()` if you want to use a specific, pre-existing role. If you don't call it, a default role will be created and managed automatically.
- **Role Must Exist**: The role you specify must already exist in your AWS account. CDKless does not create new roles with this method.
- **Permissions**: Ensure the role you provide has the necessary permissions. At a minimum, it needs the `AWSLambdaBasicExecutionRole` managed policy (or equivalent permissions) to allow the function to write logs.

**Default Behavior:**

By default, CDKless automatically creates a basic execution role for each Lambda function. This role grants permissions to write logs to Amazon CloudWatch, which is sufficient for many use cases.

#### Configuration

##### environment(env: Record<string, string>): LambdaBuilder

Adds environment variables to the function.

**Parameters:**

- `env`: Object containing key-value pairs for environment variables

**Returns:** The LambdaBuilder instance for method chaining

**Example:**

```typescript
// Add environment variables
app.lambda("src/handlers/payment/process").post("/payments").environment({
  PAYMENT_API_KEY: "secret-key",
  STAGE: "prod",
  LOG_LEVEL: "INFO",
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
app.lambda("src/handlers/image/resize").post("/images/resize").memory(512);
```

##### timeout(duration: cdk.Duration): LambdaBuilder

Sets the timeout for the function.

**Parameters:**

- `duration`: Function timeout duration

**Returns:** The LambdaBuilder instance for method chaining

**Example:**

```typescript
// Set timeout to 60 seconds
import * as cdk from "aws-cdk-lib";

app
  .lambda("src/handlers/long-running/process")
  .post("/process")
  .timeout(cdk.Duration.seconds(60));
```

##### architecture(arch: lambda.Architecture): LambdaBuilder

Sets the architecture for the Lambda function.

**Parameters:**

- `arch`: Architecture for the Lambda function (`x86_64` or `arm64`). The default is `x86_64`.

**Returns:** The LambdaBuilder instance for method chaining

**Example:**

```typescript
// Set the architecture to ARM64 for better performance and cost
app
  .lambda("src/handlers/compute-intensive/process-data")
  .post("/process-data")
  .architecture(lambda.Architecture.ARM_64);
```

##### addAuthorizer(authorizer: apigatewayv2.HttpRouteAuthorizer, scopes?: string[]): LambdaBuilder

Adds an authorizer to all API endpoints for this Lambda.

**Parameters:**

- `authorizer`: HTTP route authorizer
- `scopes`: Optional authorization scopes

**Returns:** The LambdaBuilder instance for method chaining

**Example:**

```typescript
// Add a JWT authorizer
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";

const jwtAuthorizer = new HttpJwtAuthorizer(
  "UserAuthorizer",
  "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_poolId",
  {
    jwtAudience: ["client-id"],
  }
);

app
  .lambda("src/handlers/protected/resource")
  .get("/protected")
  .addAuthorizer(jwtAuthorizer, ["profile:read"]);
```

#### Access Methods

##### getLambda(): lambda.Function

Returns the underlying Lambda function instance.

**Returns:** The CDK Lambda Function instance

**Example:**

```typescript
// Get the underlying Lambda function
const fn = app.lambda("src/handlers/test").get("/test").getLambda();

// Now you can use the function with other CDK constructs
new cdk.CfnOutput(app, "LambdaArn", {
  value: fn.functionArn,
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
  const userEndpoint = api.getEndpoint("/users");
  console.log(`Users endpoint: ${userEndpoint}`);
}
```

## Lambda Configuration

Here are more complete examples of configuring Lambda functions with CDKless:

### Default Lambda Configuration

CDKless allows you to set default configuration options for all Lambda functions in your stack using the `DefaultLambdaOptions` interface:

```typescript
interface DefaultLambdaOptions {
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
}
```

You can set these defaults when creating your CDKless instance:

```typescript
import { CdkLess } from "cdkless";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";

const app = new CdkLess({
  appName: "my-service",
  settings: {
    defaultLambdaOptions: {
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        NODE_ENV: "production",
        LOG_LEVEL: "info"
      },
      logRetention: logs.RetentionDays.ONE_WEEK
    }
  }
});

// All Lambda functions will inherit these defaults
app.lambda("src/handlers/users/get-users").get("/users");

// You can still override defaults for specific functions
app.lambda("src/handlers/image/process")
  .post("/images/process")
  .memory(1024)  // Override default memory
  .timeout(cdk.Duration.minutes(5));  // Override default timeout
```

These default options will be applied to all Lambda functions in your stack unless explicitly overridden at the function level.

### Basic Lambda with API Endpoint

```typescript
app.lambda("src/handlers/users/get-users").get("/users");
```

### Lambda with Multiple Endpoints

```typescript
const userLambda = app.lambda("src/handlers/users/user-operations");
userLambda.get("/users");
userLambda.post("/users");
userLambda.get("/users/:id");
userLambda.put("/users/:id");
userLambda.delete("/users/:id");
```

### Lambda with Advanced Configuration

```typescript
app
  .lambda("src/handlers/image/process")
  .name("my-service-image-processor")
  .post("/images/process")
  .memory(1024)
  .timeout(cdk.Duration.seconds(30))
  .environment({
    BUCKET_NAME: "images-bucket",
    THUMBNAIL_SIZE: "200x200",
    API_KEY: "secret-api-key",
  })
  .architecture(lambda.Architecture.ARM_64) // Example of setting architecture
  .addS3Permissions("arn:aws:s3:region:account:bucket/images-bucket");
```

## Lambda Layers

CDKless provides comprehensive support for Lambda layers, including both shared layers that are automatically applied to all functions and individual layers that can be selectively added to specific functions.

### Shared Layer Configuration

Configure a shared layer that will be automatically attached to all Lambda functions in your stack:

```typescript
import * as lambda from "aws-cdk-lib/aws-lambda";

const app = new CdkLess({ appName: "my-service" });

// Basic shared layer
app.setSharedLayer("../layers/common-utilities");

// Advanced shared layer with full configuration
app.setSharedLayer("../layers/shared-dependencies", {
  description: "Common utilities and dependencies for all Lambda functions",
  compatibleRuntimes: [
    lambda.Runtime.NODEJS_18_X,
    lambda.Runtime.NODEJS_20_X,
    lambda.Runtime.NODEJS_22_X,
  ],
  layerVersionName: "shared-dependencies-layer",
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});

// All subsequent Lambda functions will automatically include the shared layer
app.lambda("src/handlers/users/get-user").get("/users/:id");
app.lambda("src/handlers/orders/create-order").post("/orders");
```

> **Note:** When using TypeScript for layers, you need to compile your code first and structure the output following AWS Lambda layer standards (i.e., place your compiled files in a `/nodejs` folder). For example:
> ```
> /dist/layers/common-utilities/
> └── nodejs/
>     ├── node_modules/
>     └── your-compiled-code.js
> ```

### Individual Layer Configuration

Add specific layers to individual Lambda functions:

```typescript
// Create specialized layers
const databaseLayer = new lambda.LayerVersion(app, "database-layer", {
  code: lambda.Code.fromAsset("../layers/database-utilities"),
  description: "Database connection and ORM utilities",
  compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
});

const imageProcessingLayer = new lambda.LayerVersion(
  app,
  "image-processing-layer",
  {
    code: lambda.Code.fromAsset("../layers/image-processing"),
    description: "Image processing and manipulation tools",
    compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
  }
);

// Apply layers selectively
app
  .lambda("src/handlers/users/create-user")
  .post("/users")
  .addLayers([databaseLayer]); // Only database utilities

app
  .lambda("src/handlers/images/resize")
  .post("/images/resize")
  .addLayers([imageProcessingLayer]); // Only image processing

app
  .lambda("src/handlers/users/upload-avatar")
  .post("/users/:id/avatar")
  .addLayers([databaseLayer, imageProcessingLayer]); // Both layers
```

## API Gateway Integration

Examples of API Gateway integration:

### Multiple HTTP Methods

```typescript
// Define multiple endpoints with different HTTP methods
app.lambda("src/handlers/users/get-users").get("/users");
app.lambda("src/handlers/users/create-user").post("/users");
app.lambda("src/handlers/users/get-user-by-id").get("/users/:id");
app.lambda("src/handlers/users/update-user").put("/users/:id");
app.lambda("src/handlers/users/delete-user").delete("/users/:id");
```

### With Authorization

```typescript
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";

// Create a JWT authorizer for your Cognito User Pool
const jwtAuthorizer = new HttpJwtAuthorizer(
  "CognitoAuthorizer",
  "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_poolId",
  {
    jwtAudience: ["client-id"],
  }
);

// Apply the authorizer to endpoints
app
  .lambda("src/handlers/users/get-me")
  .get("/users/me")
  .addAuthorizer(jwtAuthorizer, ["profile:read"]);

app
  .lambda("src/handlers/admin/dashboard")
  .get("/admin/dashboard")
  .addAuthorizer(jwtAuthorizer, ["admin:read"]);
```

## Event Sources

Examples of configuring event sources:

### EventBridge Rule

```typescript
// Scheduled EventBridge rule
app.lambda("src/handlers/scheduled/daily-report").addEventBridgeRuleTrigger({
  scheduleExpression: "cron(0 12 * * ? *)", // Run daily at 12:00 PM UTC
  description: "Trigger daily report generation",
  ruleName: "daily-report-rule",
});

// Event pattern EventBridge rule
app
  .lambda("src/handlers/events/process-state-change")
  .addEventBridgeRuleTrigger({
    eventPattern: {
      source: ["aws.ec2"],
      detailType: ["EC2 Instance State-change Notification"],
    },
    description: "Process EC2 state changes",
    enabled: true,
  });
```

### SNS Topic

```typescript
// Process events from an SNS topic
app
  .lambda("src/handlers/notifications/process-event")
  .addSnsTrigger("arn:aws:sns:region:account:topic/notifications-topic", {
    filterPolicy: {
      eventType: sns.SubscriptionFilter.stringFilter({
        allowlist: ["USER_CREATED", "USER_UPDATED"],
      }),
    },
  });
```

### Amazon MSK (Managed Streaming for Apache Kafka)

```typescript
// Basic MSK trigger
app
  .lambda("src/handlers/orders/process-msk-order")
  .addMSKTrigger({
    clusterArn: "arn:aws:kafka:us-east-1:123456789012:cluster/your-cluster",
    topic: "orders-topic",
    secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
  });

// MSK trigger with custom configuration
app
  .lambda("src/handlers/orders/process-msk-order")
  .addMSKTrigger({
    clusterArn: "arn:aws:kafka:us-east-1:123456789012:cluster/your-cluster",
    topic: "orders-topic",
    secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
    batchSize: 100,
    maximumBatchingWindow: 5,
    startingPosition: StartingPosition.TRIM_HORIZON,
    consumerGroupId: "orders-consumer-group",
  });

// MSK trigger with timestamp starting position
app
  .lambda("src/handlers/orders/process-msk-order")
  .addMSKTrigger({
    clusterArn: "arn:aws:kafka:us-east-1:123456789012:cluster/your-cluster",
    topic: "orders-topic",
    secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
    startingPosition: StartingPosition.AT_TIMESTAMP,
    startingPositionDate: "2024-01-01T00:00:00.000Z",
  });
```

### Self-Managed Kafka

```typescript
// Basic Self-Managed Kafka trigger (Confluent Cloud)
app
  .lambda("src/handlers/orders/process-kafka-order")
  .addSMKTrigger({
    bootstrapServers: ["pkc-p11xm.us-east-1.aws.confluent.cloud:9099"],
    topic: "orders-topic",
    secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
  });

// Self-Managed Kafka trigger with custom configuration
app
  .lambda("src/handlers/orders/process-kafka-order")
  .addSMKTrigger({
    bootstrapServers: ["kafka-broker-1:9092", "kafka-broker-2:9092"],
    topic: "orders-topic",
    secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
    authenticationMethod: AuthenticationMethod.SASL_SCRAM_256_AUTH,
    batchSize: 100,
    maximumBatchingWindow: 5,
    startingPosition: StartingPosition.TRIM_HORIZON,
    consumerGroupId: "orders-consumer-group",
  });

// Self-Managed Kafka trigger with timestamp starting position
app
  .lambda("src/handlers/orders/process-kafka-order")
  .addSMKTrigger({
    bootstrapServers: ["kafka-broker-1:9092"],
    topic: "orders-topic",
    secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
    startingPosition: StartingPosition.AT_TIMESTAMP,
    startingPositionDate: "2024-01-01T00:00:00.000Z",
  });

// Self-Managed Kafka trigger with SQS Dead Letter Queue
app
  .lambda("src/handlers/orders/process-kafka-order")
  .addSMKTrigger({
    bootstrapServers: ["kafka-broker-1:9092", "kafka-broker-2:9092"],
    topic: "orders-topic",
    secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
    batchSize: 100,
    maximumBatchingWindow: 10,
    onFailure: {
      destination: "arn:aws:sqs:us-east-1:123456789012:kafka-dlq",
      destinationType: 'sqs'
    }
  });

// Self-Managed Kafka trigger with S3 bucket for failed records
app
  .lambda("src/handlers/orders/process-kafka-order")
  .addSMKTrigger({
    bootstrapServers: ["kafka-broker-1:9092"],
    topic: "orders-topic",
    secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
    onFailure: {
      destination: "arn:aws:s3:::my-failed-kafka-records-bucket",
      destinationType: 's3'
    }
  });

// Self-Managed Kafka trigger with CloudFormation imported DLQ
app
  .lambda("src/handlers/orders/process-kafka-order")
  .addSMKTrigger({
    bootstrapServers: ["kafka-broker-1:9092"],
    topic: "orders-topic",
    secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
    onFailure: {
      destination: Fn.importValue('KafkaDLQ-Arn-prod'),
      destinationType: 'sqs'  // Required when using CloudFormation tokens
    }
  });
```

### SQS Queue

```typescript
// Process messages from an SQS queue
app
  .lambda("src/handlers/orders/process-order")
  .addSqsTrigger("arn:aws:sqs:region:account:queue/orders-queue", {
    batchSize: 10,
    maxBatchingWindow: cdk.Duration.seconds(30),
    reportBatchItemFailures: true,
  });
```

### S3 Events

```typescript
// Process S3 events
app
  .lambda("src/handlers/files/process-upload")
  .addS3Trigger("arn:aws:s3:region:account:bucket/files-bucket", {
    events: [s3.EventType.OBJECT_CREATED_PUT, s3.EventType.OBJECT_CREATED_POST],
    prefix: "uploads/",
    suffix: ".pdf",
  });
```

## Resource Permissions

Examples of adding resource permissions:

### DynamoDB Table

```typescript
// Grant permissions to a DynamoDB table
app
  .lambda("src/handlers/users/crud-operations")
  .get("/users")
  .post("/users")
  .put("/users/:id")
  .delete("/users/:id")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/users-table");
```

### Custom IAM Policy

```typescript
// Add a specific set of permissions using addPolicy
app
  .lambda("src/handlers/files/upload")
  .post("/files")
  .addPolicy("arn:aws:s3:region:account:bucket/uploads-bucket", [
    "s3:GetObject",
    "s3:PutObject",
  ])
  .addPolicy("arn:aws:sns:us-east-1:123456789012:mi-topic", ["SNS:Publish"]);
```

### Custom IAM Role

```typescript
// Using a pre-existing IAM role instead of the default role
app
  .lambda("src/handlers/admin/secure-operation")
  .post("/admin/secure")
  .addRole({
    roleArn: "arn:aws:iam::123456789012:role/high-privilege-lambda-role"
  })
  .addTablePermissions("arn:aws:dynamodb:region:account:table/sensitive-data");

// Combining custom role with additional policies
import * as iam from "aws-cdk-lib/aws-iam";

const customRole = iam.Role.fromRoleArn(
  app,
  "CustomExecutionRole",
  "arn:aws:iam::123456789012:role/my-custom-lambda-role"
);

app
  .lambda("src/handlers/reports/generate")
  .get("/reports/generate")
  .addRole({ role: customRole })
  .addPolicy("arn:aws:s3:region:account:bucket/reports-bucket", [
    "s3:GetObject",
    "s3:PutObject"
  ]);
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
  EventBridgeRuleOptions,
  RoleOptions,
  PolicyOptions,
  LambdaInfo,
  TriggerInfo,
  DefaultLambdaOptions,
} from "cdkless";
```

#### DefaultLambdaOptions

Default configuration options that can be applied to all Lambda functions in a stack.

```typescript
interface DefaultLambdaOptions {
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
}
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

#### EventBridgeRuleOptions

Options for EventBridge rule integration.

```typescript
interface EventBridgeRuleOptions {
  eventPattern?: events.EventPattern;
  scheduleExpression?: string;
  description?: string;
  enabled?: boolean;
  ruleName?: string;
}
```

#### RoleOptions

Options for specifying a pre-existing IAM role for Lambda functions.

```typescript
interface RoleOptions {
  /** An existing IAM role construct */
  role?: iam.IRole;
  /** The ARN of an existing IAM role to import and use */
  roleArn?: string;
}
```

### API Interfaces

```typescript
import { ApiBuilderProps, RouteOptions } from "cdkless";
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
