import { CdkLess } from "cdkless";
import dotenv from "dotenv";

dotenv.config();

/**
 * Example microservice application for a simple order management system
 */
const app = new CdkLess("order-service");

// API Endpoints for order management
app
  .lambda("src/handlers/orders/get-orders")
  .name("get-orders-lambda")
  .get("/orders")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/orders-table");

app
  .lambda("src/handlers/orders/get-order")
  .name("get-order-lambda")
  .get("/orders/:id")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/orders-table");

app
  .lambda("src/handlers/orders/create-order")
  .name("create-order-lambda")
  .post("/orders")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/orders-table")
  .addSnsTrigger("arn:aws:sns:region:account:topic/new-order-topic")
  .environment({
    NOTIFICATION_EMAIL: "orders@example.com",
    SENTRY_DSN: process.env.SENTRY_DSN || "",
  });

// Background processors
app
  .lambda("src/handlers/orders/process-payment")
  .name("process-payment-lambda")
  .addSqsTrigger("arn:aws:sqs:region:account:queue/payment-queue")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/payments-table");

app
  .lambda("src/handlers/orders/send-confirmation")
  .name("send-confirmation-lambda")
  .addSnsTrigger("arn:aws:sns:region:account:topic/order-confirmed-topic")
  .addPolicy("arn:aws:sns:region:account:topic/order-confirmed-topic", [
    "SNS:Publish",
  ]);

// Secure admin endpoints with authorizer
app.lambda("src/handlers/admin/dashboard").get("/admin/dashboard");

app
  .lambda("src/handlers/admin/update-order-status")
  .put("/admin/orders/:id/status")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/orders-table");
