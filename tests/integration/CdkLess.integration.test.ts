import { Template } from "aws-cdk-lib/assertions";
import { Duration } from "aws-cdk-lib";
import { CdkLess } from "../../src";

const originalProcessOn = process.on;
process.on = function mockProcessOn(
  event: string,
  listener: (...args: any[]) => void
) {
  if (event === "beforeExit") {
    return process;
  }
  return originalProcessOn.call(process, event, listener);
} as any;

beforeAll(() => {
  process.env.NODE_ENV = "test";
});

afterAll(() => {
  process.on = originalProcessOn;
});

describe("CdkLess Integration Tests", () => {
  beforeEach(() => {
    process.env.STAGE = "test";
  });

  test("Simple Lambda stack is created correctly", () => {
    const cdkless = new CdkLess("test-app");

    cdkless.lambda("tests/handlers/test-handler").build();
    
    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.handler",
      Runtime: "nodejs22.x",
    });
  });

  test("API Gateway with Lambda integration is created correctly", () => {
    const cdkless = new CdkLess("test-api-app");

    cdkless
      .lambda("tests/handlers/test-handler")
      .get("/test-path")
      .build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::Lambda::Function", 2);

    template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);

    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /test-path",
    });

    template.hasResourceProperties("AWS::ApiGatewayV2::Integration", {
      IntegrationType: "AWS_PROXY",
      PayloadFormatVersion: "2.0",
    });
  });

  test("Lambda with custom configuration is created correctly", () => {
    const cdkless = new CdkLess("custom-lambda-app");

    cdkless
      .lambda("tests/handlers/test-handler")
      .memory(512)
      .timeout(Duration.seconds(120))
      .environment({
        TEST_ENV_VAR: "test-value",
      })
      .build();
    
    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);
    
    template.hasResourceProperties("AWS::Lambda::Function", {
      MemorySize: 512,
      Timeout: 120,
      Environment: {
        Variables: {
          TEST_ENV_VAR: "test-value",
        },
      },
    });
  });
});
