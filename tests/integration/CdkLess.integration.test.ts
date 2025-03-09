import { Template } from "aws-cdk-lib/assertions";
import { Duration } from "aws-cdk-lib";
import { CdkLess } from "../../src";

describe("CdkLess Integration Tests", () => {
  beforeEach(() => {
    process.env.STAGE = "test";
    process.env.NODE_ENV = "cdk-less-test";
  });

  test("Simple Lambda stack is created correctly", () => {
    const cdkless = new CdkLess("test-app");

    cdkless.lambda("tests/handlers/test-handler").name("test-lambda").build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "test-lambda-test",
      Handler: "index.handler",
      Runtime: "nodejs22.x",
    });
  });

  test("API Gateway with Lambda integration is created correctly", () => {
    const cdkless = new CdkLess("test-api-app");

    cdkless
      .lambda("tests/handlers/test-handler")
      .name("test-lambda")
      .get("/test-path")
      .build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::Lambda::Function", 1);
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
      .name("custom-lambda")
      .memory(512)
      .timeout(Duration.seconds(120))
      .environment({
        TEST_ENV_VAR: "test-value",
      })
      .build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "custom-lambda-test",
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
