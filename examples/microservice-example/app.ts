import { CdkLess } from "cdkless";

/**
 * Example microservice application for a simple order management system
 */
class OrderService extends CdkLess {
  constructor() {
    super("order-service");

    // API Endpoints for order management
    this.lambda("src/handlers/orders/get-orders")
      .get("/orders")
      .addTablePermissions(
        "arn:aws:dynamodb:region:account:table/orders-table"
      );

    this.lambda("src/handlers/orders/get-order")
      .get("/orders/:id")
      .addTablePermissions(
        "arn:aws:dynamodb:region:account:table/orders-table"
      );

    this.lambda("src/handlers/orders/create-order")
      .post("/orders")
      .addTablePermissions("arn:aws:dynamodb:region:account:table/orders-table")
      .addSnsTrigger("arn:aws:sns:region:account:topic/new-order-topic")
      .environment({
        NOTIFICATION_EMAIL: "orders@example.com",
        STAGE: this.stage,
      });

    // Background processors
    this.lambda("src/handlers/orders/process-payment")
      .addSqsTrigger("arn:aws:sqs:region:account:queue/payment-queue")
      .addTablePermissions(
        "arn:aws:dynamodb:region:account:table/payments-table"
      );

    this.lambda("src/handlers/orders/send-confirmation").addSnsTrigger(
      "arn:aws:sns:region:account:topic/order-confirmed-topic"
    );

    // Secure admin endpoints with authorizer
    this.lambda("src/handlers/admin/dashboard").get("/admin/dashboard");

    this.lambda("src/handlers/admin/update-order-status")
      .put("/admin/orders/:id/status")
      .addTablePermissions(
        "arn:aws:dynamodb:region:account:table/orders-table"
      );
  }
}

// Create and deploy the service
new OrderService();
