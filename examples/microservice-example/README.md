# Order Service Microservice Example

This example demonstrates how to build a complete order management microservice using CdkLess.

## Features

- REST API endpoints for CRUD operations on orders
- Event-driven architecture with SNS topics and SQS queues
- DynamoDB tables for persistence
- Secured admin endpoints with authorization
- Background processing of payments and confirmations

## Structure

The application is defined in a single `app.ts` file that creates:

- Public API endpoints for customers to interact with orders
- Admin endpoints secured with an authorizer
- Background processors for handling asynchronous tasks

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Deploy the microservice:

```bash
npm start
```

## How It Works

The microservice consists of multiple Lambda functions that handle different aspects of the order management process:

- `get-orders` - Returns a list of all orders
- `get-order` - Returns details for a specific order
- `create-order` - Creates a new order and publishes a notification
- `process-payment` - Processes payments from a queue
- `send-confirmation` - Sends order confirmations
- `dashboard` - Admin dashboard (secured)
- `update-order-status` - Updates order status (secured)

All of these functions are defined and configured in a single file, showing the power and simplicity of the CdkLess framework. 