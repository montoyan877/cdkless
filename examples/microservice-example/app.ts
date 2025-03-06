import { CdkLess } from 'cdkless';

/**
 * Example microservice application for a simple order management system
 */
class OrderService extends CdkLess {
  constructor() {
    super('order-service');
    
    // API Endpoints for order management
    this.lambda('src/handlers/orders/get-orders')
      .get('/orders')
      .addTable('arn:aws:dynamodb:region:account:table/orders-table');
      
    this.lambda('src/handlers/orders/get-order')
      .get('/orders/:id')
      .addTable('arn:aws:dynamodb:region:account:table/orders-table');
      
    this.lambda('src/handlers/orders/create-order')
      .post('/orders')
      .addTable('arn:aws:dynamodb:region:account:table/orders-table')
      .addTrigger('arn:aws:sns:region:account:topic/new-order-topic')
      .environment({
        NOTIFICATION_EMAIL: 'orders@example.com',
        STAGE: this.stage
      });
      
    // Background processors
    this.lambda('src/handlers/orders/process-payment')
      .addQueue('arn:aws:sqs:region:account:queue/payment-queue')
      .addTable('arn:aws:dynamodb:region:account:table/payments-table');
      
    this.lambda('src/handlers/orders/send-confirmation')
      .addTrigger('arn:aws:sns:region:account:topic/order-confirmed-topic');
      
    // Secure admin endpoints with authorizer
    this.lambda('src/handlers/admin/dashboard')
      .get('/admin/dashboard')
      .addAuthorizer('arn:aws:lambda:region:account:function:admin-authorizer');
      
    this.lambda('src/handlers/admin/update-order-status')
      .put('/admin/orders/:id/status')
      .addAuthorizer('arn:aws:lambda:region:account:function:admin-authorizer')
      .addTable('arn:aws:dynamodb:region:account:table/orders-table');
  }
}

// Create and deploy the service
new OrderService(); 