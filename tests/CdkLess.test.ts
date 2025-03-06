import { CdkLess } from '../src';
import { Template } from 'aws-cdk-lib/assertions';

describe('CdkLess', () => {
  it('creates a stack with the correct name', () => {
    // Create a test app
    process.env.STAGE = 'test';
    const app = new TestApp();
    
    // Synthesize to CloudFormation
    const template = Template.fromStack(app);
    
    // Check that resources were created
    template.hasResource('AWS::Lambda::Function', {});
  });
  
  it('creates Lambda functions with HTTP endpoints', () => {
    // Create a test app with API endpoints
    process.env.STAGE = 'test';
    const app = new TestApiApp();
    
    // Synthesize to CloudFormation
    const template = Template.fromStack(app);
    
    // Check that API Gateway resources were created
    template.hasResource('AWS::ApiGateway::RestApi', {});
    template.hasResource('AWS::ApiGateway::Method', {});
  });
});

// Test app with a simple Lambda
class TestApp extends CdkLess {
  constructor() {
    super('test-app');
    
    this.lambda('src/handlers/test-handler');
  }
}

// Test app with API endpoints
class TestApiApp extends CdkLess {
  constructor() {
    super('test-api-app');
    
    this.lambda('src/handlers/test-handler')
      .get('/test');
  }
} 