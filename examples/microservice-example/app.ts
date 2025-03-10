import { CdkLess } from "cdkless";

/**
 * Example microservice application for a simple order management system
 */
const app = new CdkLess("order-service");

// API Endpoints for order management
app
  .lambda("src/handlers/orders/get-orders")
  .get("/orders")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/orders-table");

app
  .lambda("src/handlers/orders/get-order")
  .get("/orders/:id")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/orders-table");

app
  .lambda("src/handlers/orders/create-order")
  .post("/orders")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/orders-table")
  .addSnsTrigger("arn:aws:sns:region:account:topic/new-order-topic")
  .environment({
    NOTIFICATION_EMAIL: "orders@example.com",
    STAGE: app.stage,
  });

// Background processors
app
  .lambda("src/handlers/orders/process-payment")
  .addSqsTrigger("arn:aws:sqs:region:account:queue/payment-queue")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/payments-table");

app
  .lambda("src/handlers/orders/send-confirmation")
  .addSnsTrigger("arn:aws:sns:region:account:topic/order-confirmed-topic");

// Secure admin endpoints with authorizer
app.lambda("src/handlers/admin/dashboard").get("/admin/dashboard");

app
  .lambda("src/handlers/admin/update-order-status")
  .put("/admin/orders/:id/status")
  .addTablePermissions("arn:aws:dynamodb:region:account:table/orders-table");
