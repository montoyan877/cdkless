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

| Standard CDK | CdkLess |
|--------------|---------|
| ~200 lines of code | ~15 lines of code |
| 4+ files per service | 1 file per service |
| Steep learning curve | Minutes to learn |
| Complex to maintain | Simple maintenance |
| Requires deep AWS knowledge | Minimal AWS knowledge required |

## 📋 Quick Start

Create a fully functional serverless microservice in **just one file**:

```typescript
// src/app.ts
import { CdkLess } from 'cdkless';

class MyMicroservice extends CdkLess {
  constructor() {
    super('user-service');
    
    // Create a Lambda function with a GET endpoint
    this.lambda('src/handlers/users/get-users')
      .get('/users');
      
    // Create a Lambda function with a POST endpoint and environment variables
    this.lambda('src/handlers/users/create-user')
      .post('/users')
      .environment({
        TABLE_NAME: 'users-table',
        STAGE: this.stage
      });
  }
}

// That's it! Just instantiate your microservice
new MyMicroservice();
```

## 🔍 Key Features

### 🌐 API Gateway Integration

Create REST API endpoints with a fluent interface:

```typescript
// GET endpoint
this.lambda('src/handlers/products/get-product')
  .get('/products/:id');

// POST endpoint
this.lambda('src/handlers/products/create-product')
  .post('/products');

// PUT endpoint
this.lambda('src/handlers/products/update-product')
  .put('/products/:id');

// DELETE endpoint
this.lambda('src/handlers/products/delete-product')
  .delete('/products/:id');
```

### 🔐 API Authorization

Secure your endpoints with custom authorizers:

```typescript
this.lambda('src/handlers/admin/dashboard')
  .get('/admin/dashboard')
  .addAuthorizer('arn:aws:lambda:region:account:function:authorizer');
```

### 📊 Database Integration

Connect to DynamoDB tables using ARNs:

```typescript
this.lambda('src/handlers/orders/create-order')
  .post('/orders')
  .addTable('arn:aws:dynamodb:region:account:table/orders-table');
```

### 📨 Event-Driven Architecture

Create event-driven microservices with SQS, SNS, and S3 triggers:

```typescript
// SQS Queue consumer
this.lambda('src/handlers/orders/process-order')
  .addQueue('arn:aws:sqs:region:account:queue/orders-queue');

// SNS Topic subscriber
this.lambda('src/handlers/notifications/send-email')
  .addTrigger('arn:aws:sns:region:account:topic/notifications-topic');

// S3 event handler
this.lambda('src/handlers/documents/process-upload')
  .addS3Bucket('arn:aws:s3:region:account:bucket/documents-bucket');
```

### ⚙️ Environment Configuration

Add environment variables to your Lambda functions:

```typescript
this.lambda('src/handlers/payment/process')
  .post('/payments')
  .environment({
    PAYMENT_API_KEY: 'secret-key',
    STAGE: this.stage,
    LOG_LEVEL: 'INFO'
  });
```

By default, CdkLess uses the `STAGE` environment variable to determine the deployment stage (e.g., 'dev', 'staging', 'prod'). If not set, it defaults to 'dev'.

## 🏗️ Microservice Architecture Best Practices

CdkLess encourages microservice best practices:

### 1. Single Responsibility Principle

Each Lambda function should handle a specific task. For example:

```typescript
// User service
this.lambda('src/handlers/users/get-user').get('/users/:id');
this.lambda('src/handlers/users/create-user').post('/users');
this.lambda('src/handlers/users/update-user').put('/users/:id');
this.lambda('src/handlers/users/delete-user').delete('/users/:id');

// Order service
this.lambda('src/handlers/orders/get-order').get('/orders/:id');
this.lambda('src/handlers/orders/create-order').post('/orders');
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

## 📄 API Reference

For detailed API documentation, please visit our [API Reference](https://github.com/yourusername/cdkless/blob/main/docs/API.md) page.

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

CdkLess handles the CDK synthesis process automatically when your application runs. Just execute your application with `npm start` and it will deploy to AWS.

## 📋 Requirements

- Node.js 20+
- AWS CLI configured
- AWS CDK CLI (`npm install -g aws-cdk`)

## 🙏 Contributing

We welcome contributions! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 