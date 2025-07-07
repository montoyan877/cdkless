# CdkLess: Ultra-Simplified Serverless Microservices Framework

[![npm version](https://badge.fury.io/js/cdkless.svg)](https://badge.fury.io/js/cdkless)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> The simplest way to build serverless microservices with AWS CDK

CdkLess dramatically simplifies the development of serverless microservices on AWS by providing a clean, intuitive API that abstracts away the complexities of the AWS Cloud Development Kit (CDK).

## 🚀 Installation

```bash
npm install cdkless aws-cdk-lib constructs
```

## 🎯 Why CdkLess?

CdkLess was created for development teams that need to:

- Build and deploy microservices quickly without deep AWS expertise
- Maintain consistent infrastructure patterns across multiple services
- Focus on business logic rather than infrastructure code
- Follow best practices without having to reinvent them each time

## 📊 Comparison with Standard CDK

| Standard CDK                | CdkLess                        |
| --------------------------- | ------------------------------ |
| ~200 lines of code          | ~15 lines of code              |
| 4+ files per service        | 1 file per service             |
| Steep learning curve        | Minutes to learn               |
| Complex to maintain         | Simple maintenance             |
| Requires deep AWS knowledge | Minimal AWS knowledge required |

## 📋 Quick Start

1. Create a fully functional serverless microservice in **just one file**:

```typescript
// src/app.ts
import { CdkLess } from "cdkless";

const app = new CdkLess({ appName: "user-services" });

app.lambda("src/handlers/users/get-users").get("/users");
app.lambda("src/handlers/users/create-user").post("/users");
app.lambda("src/handlers/users/delete-user").delete("/users");
app.lambda("src/handlers/users/update-user").put("/users");
```

> **Note:** The handler path provided to `.lambda()` should be relative to the location of your `cdk.json` file, which should be placed at the root of your project. If you have any questions, please review the example folder in this repository.

2. Create a `cdk.json` file in your project root with the following content:

```json
{
  "app": "npx ts-node src/app.ts"
}
```

3. Deploy your service by running:

```bash
cdk bootstrap  # Only needed once per AWS account/region
cdk deploy
```

Your Lambda functions, triggers, API Gateway, and necessary permissions will be automatically deployed to AWS.

## 🏛️ Architectural Approach

CdkLess follows a specific architectural pattern:

- **Infrastructure Separation**: The library is designed with the convention that infrastructure (databases, queues, topics, etc.) is managed in a separate CDK project. This separation of concerns allows infrastructure teams to maintain core resources independently.

- **Service Integration**: CdkLess focuses specifically on mounting API Gateway endpoints, Lambda functions, and their triggers by importing existing resources via ARNs. This approach encourages a clean separation between infrastructure and application code.

- **ARN-Based Integration**: Instead of creating infrastructure resources directly, CdkLess connects to existing resources using their ARNs. This pattern promotes infrastructure reuse and better governance of cloud resources.

```typescript
// Example of connecting to existing infrastructure via ARNs
app
  .lambda("src/handlers/orders/process")
  .post("/orders")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/orders-table") // Connect to existing DynamoDB table
  .addSnsTrigger("arn:aws:sns:region:account:topic/order-events"); // Connect to existing SNS topic
```

## 🔍 Key Features

### 🔧 TypeScript Support

Cdkless provides first-class TypeScript support with automatic bundling:

```typescript
const app = new CdkLess({
  appName: "my-service",
  settings: {
    // Use TypeScript handlers directly (default)
    bundleLambdasFromTypeScript: true,

    // Configure bundling options
    defaultBundlingOptions: {
      minify: true,
      sourceMap: true,
      externalModules: ["aws-sdk", "@aws-sdk/*"],
    },
  },
});

// Use TypeScript handlers directly
app.lambda("src/handlers/users/get-users.ts").get("/users");
```

You can also opt out of automatic bundling and handle TypeScript compilation yourself by setting `bundleLambdasFromTypeScript: false`.

### 🌐 API Gateway Integration

Create HTTP API endpoints with a fluent interface:

```typescript
// GET endpoint
app.lambda("src/handlers/products/get-product").get("/products/:id");

// POST endpoint
app.lambda("src/handlers/products/create-product").post("/products");

// PUT endpoint
app.lambda("src/handlers/products/update-product").put("/products/:id");

// DELETE endpoint
app.lambda("src/handlers/products/delete-product").delete("/products/:id");
```

### 🔐 API Authorization

Secure your endpoints with various types of authorizers:

```typescript
import {
  HttpJwtAuthorizer,
  HttpLambdaAuthorizer,
} from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { Function } from "aws-cdk-lib/aws-lambda";

// Creating a Lambda authorizer
const authorizerFunction = new Function(this, "AuthorizerFunction", {
  // function configuration
});

const lambdaAuthorizer = new HttpLambdaAuthorizer(
  "my-lambda-authorizer",
  authorizerFunction,
  {
    authorizerName: "my-lambda-authorizer",
    identitySource: ["$request.header.Authorization"],
  }
);

// Creating a JWT authorizer
const jwtAuthorizer = new HttpJwtAuthorizer(
  "my-jwt-authorizer",
  "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXXXX",
  {
    jwtAudience: ["my-app-client-id"],
  }
);

// Securing routes with authorizers
app
  .lambda("src/handlers/admin/dashboard")
  .get("/admin/dashboard")
  .addAuthorizer(lambdaAuthorizer);

app
  .lambda("src/handlers/users/profile")
  .get("/users/profile")
  .addAuthorizer(jwtAuthorizer, ["profile:read"]);
```

### 📊 Database Integration

Connect to DynamoDB tables using ARNs:

```typescript
app
  .lambda("src/handlers/orders/create-order")
  .post("/orders")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/orders-table");
```

### 🔄 Event Triggers and Integration

Create event-driven microservices with SQS, SNS, Dynamo Streams and S3:

```typescript
// SQS Queue consumer
app
  .lambda("src/handlers/orders/process-order")
  .addSqsTrigger("arn:aws:sqs:region:account:queue/orders-queue");

// SNS Topic subscriber
app
  .lambda("src/handlers/notifications/send-email")
  .addSnsTrigger("arn:aws:sns:region:account:topic/notifications-topic");

// S3 event handler
app
  .lambda("src/handlers/documents/process-upload")
  .addS3Trigger("arn:aws:s3:region:account:bucket/documents-bucket");

// DynamoDB Streams trigger
app
  .lambda("src/handlers/orders/process-order-changes")
  .addDynamoStreamsTrigger(
    "arn:aws:dynamodb:region:account:table/orders-table/stream/lastest",
    {
      batchSize: 10,
      maxBatchingWindow: 5,
      startingPosition: StartingPosition.TRIM_HORIZON,
      enabled: true,
      retryAttempts: 3,
      reportBatchItemFailures: true,
    }
  );

// EventBridge rule trigger
app.lambda("src/handlers/scheduled/daily-report").addEventBridgeRuleTrigger({
  scheduleExpression: "cron(0 12 * * ? *)", // Run daily at 12:00 PM UTC
  description: "Trigger daily report generation",
});

// EventBridge event pattern trigger
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

#### 📊 Kafka Integration

Connect your Lambda functions to Kafka topics using either Amazon MSK or Self-Managed Kafka:

```typescript
// Amazon MSK consumer
app.lambda("src/handlers/orders/process-msk-order").addMSKTrigger({
  clusterArn: "arn:aws:kafka:region:account:cluster/your-cluster",
  topic: "orders-topic",
  secretArn: "arn:aws:secretsmanager:region:account:secret/your-secret-name",
  batchSize: 100,
  maximumBatchingWindow: 5,
  consumerGroupId: "orders-consumer-group",
});

// Amazon MSK consumer with timestamp starting position
app.lambda("src/handlers/orders/process-msk-order").addMSKTrigger({
  clusterArn: "arn:aws:kafka:region:account:cluster/your-cluster",
  topic: "orders-topic",
  secretArn: "arn:aws:secretsmanager:region:account:secret/your-secret-name",
  startingPosition: StartingPosition.AT_TIMESTAMP,
  startingPositionDate: "2024-01-01T00:00:00.000Z",
});

// Self-Managed Kafka consumer (e.g., Confluent Cloud)
app.lambda("src/handlers/orders/process-kafka-order").addSMKTrigger({
  bootstrapServers: ["pkc-p11xm.us-east-1.aws.confluent.cloud:9099"],
  topic: "orders-topic",
  secretArn: "arn:aws:secretsmanager:region:account:secret/your-secret-name",
  authenticationMethod: AuthenticationMethod.SASL_SCRAM_512_AUTH,
  batchSize: 100,
  maximumBatchingWindow: 5,
  consumerGroupId: "orders-consumer-group",
});

// Self-Managed Kafka consumer with timestamp starting position
app.lambda("src/handlers/orders/process-kafka-order").addSMKTrigger({
  bootstrapServers: ["kafka-broker-1:9092"],
  topic: "orders-topic",
  secretArn: "arn:aws:secretsmanager:region:account:secret/your-secret-name",
  startingPosition: StartingPosition.AT_TIMESTAMP,
  startingPositionDate: "2024-01-01T00:00:00.000Z",
});
```

##### Amazon MSK Trigger Configuration

- `clusterArn`: ARN of your Amazon MSK cluster
- `topic`: Kafka topic to consume from
- `secretArn`: ARN of the AWS Secrets Manager secret containing Kafka credentials
- `batchSize`: Number of records to process in each batch (default: 10)
- `maximumBatchingWindow`: Maximum time to wait for records in seconds (default: 1)
- `startingPosition`: Where to start reading from (default: TRIM_HORIZON)
  - `TRIM_HORIZON`: Start from the beginning of the topic
  - `LATEST`: Start from the latest records
  - `AT_TIMESTAMP`: Start from a specific timestamp (requires `startingPositionDate`)
- `startingPositionDate`: ISO String date for AT_TIMESTAMP starting position (format: YYYY-MM-DDTHH:mm:ss.sssZ)
- `enabled`: Whether the trigger is enabled (default: true)
- `consumerGroupId`: Custom consumer group ID (default: auto-generated)

##### Self-Managed Kafka Trigger Configuration

- `bootstrapServers`: Array of Kafka broker URLs
- `topic`: Kafka topic to consume from
- `secretArn`: ARN of the AWS Secrets Manager secret containing Kafka credentials
- `authenticationMethod`: Authentication method for Kafka (default: SASL_SCRAM_512_AUTH)
  - `SASL_SCRAM_512_AUTH`: SASL/SCRAM authentication with SHA-512
  - `SASL_SCRAM_256_AUTH`: SASL/SCRAM authentication with SHA-256
  - `SASL_PLAIN_AUTH`: SASL/PLAIN authentication
  - `BASIC_AUTH`: Basic authentication
  - `CLIENT_CERTIFICATE_TLS_AUTH`: TLS certificate authentication
  - `OAUTHBEARER_AUTH`: OAuth Bearer authentication
- `batchSize`: Number of records to process in each batch (default: 10)
- `maximumBatchingWindow`: Maximum time to wait for records in seconds (default: 1)
- `startingPosition`: Where to start reading from (default: TRIM_HORIZON)
  - `TRIM_HORIZON`: Start from the beginning of the topic
  - `LATEST`: Start from the latest records
  - `AT_TIMESTAMP`: Start from a specific timestamp (requires `startingPositionDate`)
- `startingPositionDate`: ISO String date for AT_TIMESTAMP starting position (format: YYYY-MM-DDTHH:mm:ss.sssZ)
- `enabled`: Whether the trigger is enabled (default: true)
- `consumerGroupId`: Custom consumer group ID (default: auto-generated)

##### DynamoDB Streams Trigger Configuration

The DynamoDB Streams trigger allows processing real-time changes from a DynamoDB table. This enables your Lambda function to automatically respond to data changes (inserts, updates, deletes) in the DynamoDB table.

**Configuration Options:**

- `batchSize`: Number of records to process in each batch (1-10000, default: 10)
- `maxBatchingWindow`: Maximum time in seconds to wait for records before processing (0-300, default: 0)
- `startingPosition`: Starting position for reading from the stream
  - `TRIM_HORIZON`: Start from the beginning of the stream
  - `LATEST`: Start from the latest records
  - `AT_TIMESTAMP`: Start from a specific timestamp
- `enabled`: Whether the trigger is enabled (default: true)
- `retryAttempts`: Number of retry attempts for failed records (0-10000, default: -1 for infinite)
- `reportBatchItemFailures`: Whether to report individual batch item failures (default: false)
- `filters`: Array of FilterCriteria to filter events before processing
- `advancedOptions`: Advanced configuration options for performance tuning
  - `maxRecordAge`: Maximum age of records to process
  - `bisectBatchOnError`: Split batch in two and retry on error
  - `parallelizationFactor`: Number of concurrent batches per shard (1-10)
  - `tumblingWindow`: Size of tumbling windows to group records (0-15 minutes)
  - `filterEncryption`: KMS key for filter criteria encryption
  - `metricsConfig`: Enhanced monitoring metrics configuration
  - `provisionedPollerConfig`: Provisioned poller configuration

**Examples:**

Basic usage:

```typescript
app
  .lambda("src/handlers/users/process-user-changes")
  .addDynamoStreamsTrigger(
    "arn:aws:dynamodb:us-east-1:123456789012:table/Users/stream/2024-01-01T00:00:00.000"
  );
```

With custom configuration:

```typescript
app
  .lambda("src/handlers/orders/process-order-changes")
  .addDynamoStreamsTrigger(
    "arn:aws:dynamodb:us-east-1:123456789012:table/Orders/stream/2024-01-01T00:00:00.000",
    {
      batchSize: 50,
      maxBatchingWindow: 5,
      startingPosition: StartingPosition.TRIM_HORIZON,
      retryAttempts: 3,
      reportBatchItemFailures: true,
      filters: [
        {
          pattern: JSON.stringify({
            eventName: ["INSERT", "MODIFY"],
          }),
        },
      ],
    }
  );
```

High-performance configuration with advanced options:

```typescript
app
  .lambda("src/handlers/high-volume-processor")
  .addDynamoStreamsTrigger(
    "arn:aws:dynamodb:us-east-1:123456789012:table/HighVolumeTable/stream/2024-01-01T00:00:00.000",
    {
      batchSize: 100,
      maxBatchingWindow: 10,
      startingPosition: StartingPosition.LATEST,
      reportBatchItemFailures: true,
      advancedOptions: {
        parallelizationFactor: 5,
        maxRecordAge: Duration.hours(24),
        bisectBatchOnError: true,
        tumblingWindow: Duration.minutes(5),
      },
    }
  );
```

### ⚙️ Environment Configuration

Add environment variables to your Lambda functions:

```typescript
app.lambda("src/handlers/payment/process").post("/payments").environment({
  PAYMENT_API_KEY: "secret-key",
  STAGE: this.stage,
  LOG_LEVEL: "INFO",
});
```

By default, CdkLess uses the `STAGE` environment variable to determine the deployment stage (e.g., 'dev', 'staging', 'prod'). If not set, it defaults to 'dev'.

### 🌐 VPC Configuration

Configure your Lambda functions to run within a VPC:

```typescript
// Basic VPC configuration
app.lambda("src/handlers/users/get-user").addVpcConfig({
  vpcId: "vpc-1234567890abcdef0",
});

// Full VPC configuration with subnets and security groups
app.lambda("src/handlers/users/get-user").addVpcConfig({
  vpcId: "vpc-1234567890abcdef0",
  subnetIds: ["subnet-1234567890abcdef0", "subnet-0987654321fedcba0"],
  securityGroupIds: ["sg-1234567890abcdef0"],
});
```

The VPC configuration supports:

- `vpcId`: The ID of the VPC to place the Lambda function in
- `subnetIds`: Optional array of subnet IDs where the Lambda function will be placed
- `securityGroupIds`: Optional array of security group IDs to associate with the Lambda function

### 📦 Lambda Layers Configuration

CdkLess provides powerful options for managing Lambda layers, including shared layers for all functions and individual layers for specific functions.

#### Shared Layer for All Lambda Functions

Configure a shared layer that will be automatically attached to all Lambda functions in your stack. This is perfect for common dependencies, utilities, or shared libraries.

> **Note:** When using TypeScript for layers, you need to compile your code first and structure the output following AWS Lambda layer standards (i.e., place your compiled files in a `/nodejs` folder). For example:
>
> ```
> /dist/layers/common-utilities/
> └── nodejs/
>     ├── node_modules/
>     └── your-compiled-code.js
> ```

```typescript
import * as lambda from "aws-cdk-lib/aws-lambda";

// Create the stack
const app = new CdkLess({ appName: "user-services" });

// Set up a shared layer that all Lambda functions will automatically use
app.setSharedLayer("../dist/layers/common-utilities", {
  description: "Common utilities and dependencies for all Lambda functions",
  compatibleRuntimes: [
    lambda.Runtime.NODEJS_18_X,
    lambda.Runtime.NODEJS_20_X,
    lambda.Runtime.NODEJS_22_X,
  ],
  layerVersionName: "common-utilities-layer",
});

// All Lambda functions will automatically include the shared layer
app.lambda("src/handlers/users/get-user").get("/users/:id");
app.lambda("src/handlers/orders/create-order").post("/orders");
app.lambda("src/handlers/products/list-products").get("/products");
```

The `setSharedLayer` method accepts:

- `layerPath`: Relative path to the layer directory (from your current directory)
- `options`: Optional `LayerVersionProps` from AWS CDK for advanced configuration

**Key Benefits:**

- **Automatic**: Once configured, all Lambda functions automatically receive the shared layer
- **Efficient**: Single layer creation per stack, reducing deployment time and resources
- **Consistent**: Ensures all functions have access to the same version of shared dependencies

#### Individual Lambda Layers

Add specific layers to individual Lambda functions when you need specialized dependencies or libraries:

```typescript
import * as lambda from "aws-cdk-lib/aws-lambda";

// Get an existing layer for different purposes
const databaseLayer = LayerVersion.fromLayerVersionArn(
  app,
  "DatabaseHandlerLayer",
  "arn:aws:lambda:us-east-1:3123213123:layer:mysql-layer"
);

// Create a new layer for different purposes
const imageProcessingLayer = new lambda.LayerVersion(
  app,
  "image-processing-layer",
  {
    code: lambda.Code.fromAsset("../layers/image-processing"),
    description: "Image processing and manipulation tools",
    compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
  }
);

// Add specific layers to Lambda functions that need them
app
  .lambda("src/handlers/users/create-user")
  .post("/users")
  .addLayers([databaseLayer]); // Only needs database utilities

app
  .lambda("src/handlers/images/resize-image")
  .post("/images/resize")
  .addLayers([imageProcessingLayer]); // Only needs image processing

app
  .lambda("src/handlers/users/create-user-with-avatar")
  .post("/users/with-avatar")
  .addLayers([databaseLayer, imageProcessingLayer]); // Needs both layers
```

#### Layer Structure Best Practices

Organize your layers following AWS Lambda layer structure:

```
layers/
├── common-utilities/
│   └── nodejs/
│       ├── node_modules/     # npm dependencies
│       └── package.json
├── database-utilities/
│   └── nodejs/
│       ├── lib/
│       │   ├── db-connection.js
│       │   └── orm-helpers.js
│       └── package.json
└── image-processing/
    └── nodejs/
        ├── node_modules/     # Sharp, Jimp, etc.
        └── package.json
```

### 🏷️ Resource Tagging

CdkLess provides a simple way to manage tags for both your stack and individual resources. By default, all resources get a `ProjectName` tag, but you can override this with your own default tags:

```typescript
// Create a stack with default tags
const app = new CdkLess({
  appName: "user-services",
  stage: "prod",
  settings: {
    defaultTags: {
      Environment: "production",
      Owner: "team-a",
      Project: "custom-project-name", // Override default ProjectName
    },
  },
});

// Resources will have the defaultTags:
// - Environment: production
// - Owner: team-a
// - Project: custom-project-name

// Or create a stack without default tags
const app = new CdkLess({ appName: "user-services" });

// Resources will have the automatic tag:
// - ProjectName: user-services

// Add additional tags to all resources
app.addResourceTags({
  CostCenter: "123456",
  Environment: "staging", // This will be added/override existing
});

// Add specific tags to a Lambda function
app.lambda("src/handlers/users/create-user").post("/users").addTags({
  Service: "users",
  Environment: "custom", // Override for this Lambda only
});
```

#### Tag Inheritance Order

Tags are applied in the following order (later ones take precedence):

1. Either:
   - Default tags from `settings.defaultTags` if provided, OR
   - Automatic `ProjectName` tag if no default tags are provided
2. Tags added via `addStackTags()` and `addResourceTags()`
3. Lambda-specific tags added via `addTags()`

This ensures that:

- Resources always have a base set of tags (either custom or automatic)
- Additional tags can be added or override existing ones
- Lambda-specific tags have the highest priority for that resource

## 🔑 Adding Permissions to Lambda Functions

Grant your Lambda functions access to AWS resources with a simple, chainable API:

```typescript
// Add Grant DynamoDB table permissions
app
  .lambda("src/handlers/users/create-user")
  .post("/users")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/users-table");

// Add differents permissions
app
  .lambda("src/handlers/files/upload")
  .post("/files")
  .addPolicy("arn:aws:s3:region:account:bucket/uploads-bucket", [
    "s3:GetObject",
    "s3:PutObject",
  ])
  .addPolicy("arn:aws:sns:us-east-1:123456789012:mi-topic", ["SNS:Publish"]);
```

## ✏️ Naming Lambda Functions

By default, CdkLess assigns a name to each Lambda function based on the filename containing the handler. However, it's recommended to specify custom names for better clarity and to avoid duplication errors when deploying:

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

## 🏗️ Microservice Architecture Best Practices

CdkLess encourages microservice best practices:

### 1. Single Responsibility Principle

Each Lambda function should handle a specific task. For example:

```typescript
// User service
app.lambda("src/handlers/users/get-user").get("/users/:id");
app.lambda("src/handlers/users/create-user").post("/users");
app.lambda("src/handlers/users/update-user").put("/users/:id");
app.lambda("src/handlers/users/delete-user").delete("/users/:id");

// Order service
app.lambda("src/handlers/orders/get-order").get("/orders/:id");
app.lambda("src/handlers/orders/create-order").post("/orders");
```

### 2. Domain-Driven Design

Organize your handlers by domain:

```
src/
  handlers/
    users/
      get-user.ts
      create-user.ts
    orders/
      get-order.ts
      create-order.ts
    payments/
      process-payment.ts
```

### 3. Shared Resources

Resources are shared automatically. For example, all HTTP endpoints will share a single API Gateway.

## 🐞 Local Development and Testing

For local Lambda function testing, we recommend using [lambda-running](https://www.npmjs.com/package/lambda-running), a lightweight and easy-to-configure library:

```bash
# Install globally
npm install -g lambda-running

# Setting
lambda-run init

# Start UI mode with web interface
lambda-run ui

# Or use interactive CLI mode
lambda-run i

# Or run a specific handler directly
lambda-run run src/handlers/users/get-users.js handler --event '{"pathParameters": {"id": "123"}}'
```

Key features of lambda-running:

- 🎨 Modern web interface for testing Lambda functions
- 🔍 Real-time logs and execution results
- 💾 Save and reuse test events
- 🔄 Automatic .env file loading

## 📄 API Reference

For detailed API documentation, please visit our [API Reference](https://github.com/montoyan877/cdkless/blob/main/docs/API.md) page.

## 🌟 Core Principles

CdkLess is built on these core principles:

1. **Everything in One Place**: Define, configure, and deploy from a single file
2. **Fluent API**: Chain methods for intuitive Lambda configuration
3. **Convention Over Configuration**: Sensible defaults for everything
4. **Automatic Building**: No need to call `.build()` or `.synth()`
5. **Minimal Magic**: No hidden configuration
6. **Encapsulated Dependencies**: The framework handles all CDK dependencies

## 🤔 FAQ

### How does CdkLess compare to other frameworks like Serverless Framework?

CdkLess builds directly on top of AWS CDK, giving you the full power of CDK with a simplified interface. Unlike configuration-based frameworks, CdkLess uses a code-first approach, which provides greater flexibility and type safety.

### Can I access the underlying CDK constructs?

Yes, CdkLess doesn't hide the underlying CDK. You can always access the shared API or other resources.

### How does deployment work?

CdkLess handles the CDK synthesis process automatically when your application runs. Just execute your application with `cdk deploy` and it will deploy to AWS.

## 📋 Requirements

- Node.js 22+
- AWS CLI configured
- AWS CDK CLI (`npm install -g aws-cdk`)

## 🙏 Contributing

We welcome contributions! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
