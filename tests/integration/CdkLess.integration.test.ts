import { Template, Match } from "aws-cdk-lib/assertions";
import { Duration } from "aws-cdk-lib";
import { Architecture } from "aws-cdk-lib/aws-lambda";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { CdkLess } from "../../src";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";

describe("CdkLess Integration Tests", () => {
  beforeEach(() => {
    process.env.STAGE = "test";
    process.env.NODE_ENV = "cdk-less-test";
  });

  test("Simple Lambda stack is created correctly", () => {
    const cdkless = new CdkLess({ appName: "test-app" });

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
    const cdkless = new CdkLess({ appName: "test-api-app" });

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
    const cdkless = new CdkLess({ appName: "custom-lambda-app" });

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

    const cdkless = new CdkLess({ appName: "sns-lambda-app" });
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
    const cdkless = new CdkLess({ appName: "sqs-lambda-app" });

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
    const cdkless = new CdkLess({ appName: "s3-lambda-app" });

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

  test("Lambda with EventBridge schedule rule is created correctly", () => {
    const cdkless = new CdkLess({ appName: "eventbridge-schedule-app" });

    cdkless
      .lambda("tests/handlers/test-handler")
      .name("eventbridge-schedule-lambda")
      .addEventBridgeRuleTrigger({
        scheduleExpression: "rate(1 hour)",
        description: "Trigger lambda every hour",
        ruleName: "hourly-schedule-rule"
      })
      .build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Events::Rule", {
      Name: "hourly-schedule-rule",
      Description: "Trigger lambda every hour",
      ScheduleExpression: "rate(1 hour)",
      State: "ENABLED"
    });

    template.hasResourceProperties("AWS::Lambda::Permission", {
      Action: "lambda:InvokeFunction",
      Principal: "events.amazonaws.com"
    });
  });

  test("Lambda with EventBridge event pattern rule is created correctly", () => {
    const cdkless = new CdkLess({ appName: "eventbridge-pattern-app" });

    cdkless
      .lambda("tests/handlers/test-handler")
      .name("eventbridge-pattern-lambda")
      .addEventBridgeRuleTrigger({
        eventPattern: {
          source: ["aws.ec2"],
          detailType: ["EC2 Instance State-change Notification"]
        },
        description: "Trigger lambda on EC2 state changes"
      })
      .build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Events::Rule", {
      Description: "Trigger lambda on EC2 state changes",
      EventPattern: {
        source: ["aws.ec2"],
        "detail-type": ["EC2 Instance State-change Notification"]
      },
      State: "ENABLED"
    });

    template.hasResourceProperties("AWS::Lambda::Permission", {
      Action: "lambda:InvokeFunction",
      Principal: "events.amazonaws.com"
    });
  });

  test("Lambda with x86_64 architecture (default) is created correctly", () => {
    const cdkless = new CdkLess({ appName: "x86-arch-app" });

    cdkless
      .lambda("tests/handlers/test-handler")
      .name("x86-lambda")
      .build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "x86-lambda-test",
      Architectures: [Architecture.X86_64]
    });
  });

  test("Lambda with ARM64 architecture is created correctly", () => {
    const cdkless = new CdkLess({ appName: "arm-arch-app" });

    cdkless
      .lambda("tests/handlers/test-handler")
      .name("arm-lambda")
      .architecture(Architecture.ARM_64)
      .build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "arm-lambda-test",
      Architectures: ["arm64"]
    });
  });

  test("Default Lambda options are applied correctly to all functions", () => {
    const cdkless = new CdkLess({ 
      appName: "default-options-app",
      settings: {
        defaultLambdaOptions: {
          memorySize: 512,
          timeout: Duration.seconds(30),
          architecture: Architecture.ARM_64,
          environment: {
            DEFAULT_ENV: "test-value"
          }
        }
      }
    });

    // Create two Lambda functions that should inherit the default options
    cdkless
      .lambda("tests/handlers/test-handler")
      .name("lambda-1")
      .build();

    cdkless
      .lambda("tests/handlers/test-handler")
      .name("lambda-2")
      .build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    // Verify both functions have the default options
    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "lambda-1-test",
      MemorySize: 512,
      Timeout: 30,
      Architectures: ["arm64"],
      Environment: {
        Variables: {
          DEFAULT_ENV: "test-value"
        }
      }
    });

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "lambda-2-test",
      MemorySize: 512,
      Timeout: 30,
      Architectures: ["arm64"],
      Environment: {
        Variables: {
          DEFAULT_ENV: "test-value"
        }
      }
    });
  });

  test("Default Lambda options can be overridden at function level", () => {
    const cdkless = new CdkLess({ 
      appName: "override-defaults-app",
      settings: {
        defaultLambdaOptions: {
          memorySize: 512,
          timeout: Duration.seconds(30),
          architecture: Architecture.ARM_64,
          environment: {
            DEFAULT_ENV: "test-value"
          }
        }
      }
    });

    // Create a function that overrides some default options
    cdkless
      .lambda("tests/handlers/test-handler")
      .name("override-lambda")
      .memory(1024)  // Override default memory
      .timeout(Duration.seconds(60))  // Override default timeout
      .environment({  // Merge with default environment
        CUSTOM_ENV: "custom-value"
      })
      .build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    // Verify the function has the overridden values while keeping other defaults
    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "override-lambda-test",
      MemorySize: 1024,  // Overridden value
      Timeout: 60,  // Overridden value
      Architectures: ["arm64"],  // Default value
      Environment: {
        Variables: {
          DEFAULT_ENV: "test-value",  // Default value
          CUSTOM_ENV: "custom-value"  // Added value
        }
      }
    });
  });

  test("Lambda with existing role ARN is created correctly", () => {
    const cdkless = new CdkLess({ appName: "role-arn-app" });
    const roleArn = "arn:aws:iam::123456789012:role/existing-role";

    cdkless
      .lambda("tests/handlers/test-handler")
      .name("role-arn-lambda")
      .addRole({ roleArn })
      .build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "role-arn-lambda-test",
      Role: roleArn,
    });
  });

  test("Lambda with existing role construct is created correctly", () => {
    const cdkless = new CdkLess({ appName: "role-construct-app" });
    const stack = cdkless.getStack();
    const role = new Role(stack, "MyTestRole", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    });

    cdkless
      .lambda("tests/handlers/test-handler")
      .name("role-construct-lambda")
      .addRole({ role })
      .build();

    const template = Template.fromStack(stack);

    template.hasResourceProperties(
      "AWS::Lambda::Function",
      Match.objectLike({
        FunctionName: "role-construct-lambda-test",
        Role: {
          "Fn::GetAtt": [Match.stringLikeRegexp("MyTestRole*"), "Arn"],
        },
      })
    );
  });

  test("addRole throws error if no role or roleArn is provided", () => {
    const cdkless = new CdkLess({ appName: "invalid-role-app" });

    expect(() => {
      cdkless.lambda("tests/handlers/test-handler").addRole({});
    }).toThrow("Either role or roleArn must be provided to addRole");
  });

  test("Lambda without addRole creates a default role", () => {
    const cdkless = new CdkLess({ appName: "default-role-app" });

    cdkless
      .lambda("tests/handlers/test-handler")
      .name("default-role-lambda")
      .build();

    const stack = cdkless.getStack();
    const template = Template.fromStack(stack);

    // Check that a role is created for the function
    template.hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
              Service: "lambda.amazonaws.com",
            },
          },
        ],
      },
    });

    // Check that the function uses the created role
    template.hasResourceProperties(
      "AWS::Lambda::Function",
      Match.objectLike({
        FunctionName: "default-role-lambda-test",
        Role: {
          "Fn::GetAtt": [
            Match.stringLikeRegexp("defaultrolelambdafunctionServiceRole*"),
            "Arn"
          ],
        },
      })
    );
  });
});
