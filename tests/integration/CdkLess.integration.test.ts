import { Template } from "aws-cdk-lib/assertions";
import { Duration } from "aws-cdk-lib";
import { CdkLess } from "../../src";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";

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

    const authorizer = new HttpJwtAuthorizer(
      "CognitoAuthorizer",
      `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_8vpO1008U`,
      {
        jwtAudience: ["3lj77f5sm9avmarpperjpmgqrq"],
      }
    );

    cdkless
      .lambda("tests/handlers/test-handler")
      .name("test-lambda")
      .get("/test-path")
      .addAuthorizer(authorizer)
      .build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);
    console.log(template.toJSON());
    template.resourceCountIs("AWS::Lambda::Function", 1);
    template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);

    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /test-path",
    });

    template.hasResourceProperties("AWS::ApiGatewayV2::Integration", {
      IntegrationType: "AWS_PROXY",
      PayloadFormatVersion: "2.0",
    });

    template.hasResourceProperties("AWS::ApiGatewayV2::Authorizer", {
      Name: "CognitoAuthorizer",
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

  test("Lambda with SNS trigger is created correctly", () => {
    const topicArn = "arn:aws:sns:us-east-1:123456789012:test-topic";

    const cdkless = new CdkLess("sns-lambda-app");
    cdkless
      .lambda("tests/handlers/test-handler")
      .name("sns-lambda")
      .addSnsTrigger(topicArn)
      .build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::SNS::Subscription", {
      TopicArn: topicArn,
    });
  });

  test("Lambda with SQS trigger is created correctly", () => {
    const queueArn = "arn:aws:sqs:us-east-1:123456789012:test-queue";
    const cdkless = new CdkLess("sqs-lambda-app");

    cdkless
      .lambda("tests/handlers/test-handler")
      .name("sqs-lambda")
      .addSqsTrigger(queueArn)
      .build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      EventSourceArn: queueArn,
    });
  });

  test("Lambda with S3 trigger is created correctly", () => {
    const cdkless = new CdkLess("s3-lambda-app");

    cdkless
      .lambda("tests/handlers/test-handler")
      .name("s3-lambda")
      .addS3Trigger("arn:aws:s3:::test-bucket")
      .build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    template.hasResourceProperties("Custom::S3BucketNotifications", {
      BucketName: "test-bucket",
    });
  });
});
