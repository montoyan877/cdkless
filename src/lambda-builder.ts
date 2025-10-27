import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, BundlingOptions } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import {
  AuthenticationMethod,
  ManagedKafkaEventSource,
  SelfManagedKafkaEventSource,
} from "aws-cdk-lib/aws-lambda-event-sources";
import * as events from "aws-cdk-lib/aws-events";
import * as eventsTargets from "aws-cdk-lib/aws-events-targets";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { Stack } from "aws-cdk-lib";
import { ApiBuilder } from "./api-builder";
import {
  LambdaBuilderProps,
  PolicyOptions,
  SnsOptions,
  SqsOptions,
  S3Options,
  EventBridgeRuleOptions,
  SnsConfig,
  SqsConfig,
  S3Config,
  PolicyConfig,
  EventBridgeRuleConfig,
  MSKConfig,
  SMKConfig,
  DynamoStreamsConfig,
  DynamoStreamsOptions,
  IamRoleConfig,
} from "./interfaces/lambda";
import {
  EventSourceMappingOptions,
  FilterCriteria,
  StartingPosition,
} from "aws-cdk-lib/aws-lambda";
import { RouteOptions } from "./interfaces";
import { AwsResourceTags } from "./interfaces/tags";
import { IStack } from "./interfaces/stack";
import { IVpcConfig } from "./interfaces/lambda/lambda-vpc";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { CdkLess } from "./base-stack";

let sharedApi: ApiBuilder;

export class LambdaBuilder {
  private lambda: lambda.Function;
  private method?: string;
  private path?: string;
  private scope: Construct;
  private resourceName: string;
  private environmentVars: { [key: string]: string } = {
    STAGE: process.env.STAGE || "",
  };
  private stack: Stack;
  private stage: string;
  private isBuilt = false;
  private isAutoBuilding = false;
  private authorizer?: apigatewayv2.IHttpRouteAuthorizer;
  private resourceTags: AwsResourceTags = {};
  private vpcConfig?: IVpcConfig;
  private layers: lambda.ILayerVersion[] = [];
  private iamRole?: iam.IRole;

  // Store configurations for later application
  private snsConfigs: SnsConfig[] = [];
  private sqsConfigs: SqsConfig[] = [];
  private s3Configs: S3Config[] = [];
  private policyConfigs: PolicyConfig[] = [];
  private tableArns: string[] = [];
  private eventBridgeRuleConfigs: EventBridgeRuleConfig[] = [];
  private mskConfigs: MSKConfig[] = [];
  private smkConfigs: SMKConfig[] = [];
  private dynamoStreamsConfigs: DynamoStreamsConfig[] = [];

  // New configuration properties with default values
  private runtimeValue: lambda.Runtime = lambda.Runtime.NODEJS_22_X;
  private memorySize: number = 256;
  private timeoutDuration: cdk.Duration = cdk.Duration.seconds(30);
  private logRetentionDays: logs.RetentionDays = logs.RetentionDays.ONE_MONTH;
  private handlerPath: string;
  private bundlingOptions?: BundlingOptions;
  private architectureValue: lambda.Architecture = lambda.Architecture.X86_64;

  constructor(props: LambdaBuilderProps) {
    this.scope = props.scope;
    this.stack = Stack.of(this.scope);

    // Get stage from environment variables
    this.stage = process.env.STAGE || "";

    // Extract the last segment of the handler path
    this.handlerPath = props.handler;
    this.resourceName = this.handlerPath.split("/").pop() || "";

    // Store bundling options if provided
    this.bundlingOptions = props.bundling;

    // Apply default Lambda options
    this.applyDefaultLambdaOptions();

    // Create a proxy to handle automatic building
    return new Proxy(this, {
      get: (target: LambdaBuilder, prop: string | symbol, receiver: any) => {
        // First get the original method or property
        const original = Reflect.get(target, prop, receiver);

        // If it's not a function, simply return it
        if (typeof original !== "function") {
          return original;
        }

        // If it is a function, return a wrapped version
        return function (...args: any[]) {
          // If we're trying to access build(), simply execute it
          if (prop === "build") {
            return original.apply(target, args);
          }

          // If we're trying to access getLambda() and it hasn't been built, build first
          if (prop === "getLambda" && !target.isBuilt) {
            target.build();
            return original.apply(target, args);
          }

          // For any other class method
          // Set a flag to prevent recursion during building
          if (!target.isAutoBuilding) {
            target.isAutoBuilding = true;

            // Execute the original method
            const result = original.apply(target, args);

            // If the method returns the current object (this) for chaining
            // and we've finished with all configurations, automatically build
            if (result === target && !target.isBuilt) {
              // Lambda will be automatically built when the chain ends
              setTimeout(() => target.build(), 0);
            }

            target.isAutoBuilding = false;
            return result;
          } else {
            return original.apply(target, args);
          }
        };
      },
    });
  }

  /**
   * Add tags to the Lambda function
   * @param tags Tags to add to the Lambda function
   * @returns The LambdaBuilder instance for method chaining
   */
  public addTags(tags: AwsResourceTags): LambdaBuilder {
    this.resourceTags = { ...this.resourceTags, ...tags };
    return this;
  }

  /**
   * Adds layers to the Lambda function
   * @param layers Layers to add to the Lambda function
   * @returns The LambdaBuilder instance for method chaining
   */
  public addLayers(layers: lambda.ILayerVersion[]): LambdaBuilder {
    this.layers = [...this.layers, ...layers];
    return this;
  }

  /**
   * Creates a NodejsFunction with the current configuration values
   */
  private createNodejsFunction(): lambda.Function {
    if (!this.handlerPath) {
      throw new Error("Handler path is not defined");
    }
    const functionName =
      this.stage.length > 0
        ? `${this.resourceName}-${this.stage}`
        : this.resourceName;

    const logGroup = new logs.LogGroup(
      this.scope,
      `${this.camelCaseToKebabCase(this.resourceName)}-log-group`,
      {
        retention: this.logRetentionDays,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        logGroupName: `${this.camelCaseToKebabCase(functionName)}-log-group`,
      }
    );

    let vpc: ec2.IVpc | undefined;
    let subnets: ec2.ISubnet[] | undefined;
    let securityGroups: ec2.ISecurityGroup[] | undefined;
    if (this.vpcConfig) {
      vpc = ec2.Vpc.fromLookup(this.scope, `${this.resourceName}-vpc`, {
        vpcId: this.vpcConfig.vpcId,
      });
      if (this.vpcConfig.subnetIds) {
        subnets = this.vpcConfig.subnetIds.map((subnetId) =>
          ec2.Subnet.fromSubnetId(
            this.scope,
            `${this.resourceName}-subnet-${subnetId}`,
            subnetId
          )
        );
      }
      if (this.vpcConfig.securityGroupIds) {
        securityGroups = this.vpcConfig.securityGroupIds.map(
          (securityGroupId) =>
            ec2.SecurityGroup.fromSecurityGroupId(
              this.scope,
              `${this.resourceName}-security-group-${securityGroupId}`,
              securityGroupId
            )
        );
      }
    }

    const layers = [...this.layers];
    const sharedLayer = CdkLess.getSharedLayer();
    if (sharedLayer) layers.push(sharedLayer);

    let lambdaFunction: lambda.Function;
    const defaultSettings = CdkLess.getDefaultSettings();

    if (defaultSettings.bundleLambdasFromTypeScript) {
      const bundling = this.bundlingOptions
        ? { ...defaultSettings.defaultBundlingOptions, ...this.bundlingOptions }
        : defaultSettings.defaultBundlingOptions;

      lambdaFunction = new NodejsFunction(
        this.scope,
        `${this.resourceName}-function`,
        {
          functionName: functionName,
          runtime: this.runtimeValue,
          memorySize: this.memorySize,
          timeout: this.timeoutDuration,
          entry: `${this.handlerPath}.ts`,
          handler: "handler",
          bundling,
          environment: this.environmentVars,
          logGroup,
          vpc,
          vpcSubnets: subnets ? { subnets } : undefined,
          securityGroups,
          layers,
          architecture: this.architectureValue,
          role: this.iamRole,
        }
      );
    } else {
      const handlerFile = this.handlerPath.split("/").pop() || "";
      const handlerPath = this.handlerPath.split("/").slice(0, -1).join("/");

      lambdaFunction = new lambda.Function(
        this.scope,
        `${this.resourceName}-function`,
        {
          functionName: functionName,
          runtime: this.runtimeValue,
          memorySize: this.memorySize,
          timeout: this.timeoutDuration,
          handler: `${handlerFile}.handler`,
          role: this.iamRole,
          code: lambda.Code.fromAsset(handlerPath, {
            exclude: [
              "*",
              "**/*",
              `!${handlerFile}.js`,
              `!${handlerFile}.js.map`,
            ],
          }),
          environment: this.environmentVars,
          logGroup,
          vpc,
          vpcSubnets: subnets ? { subnets } : undefined,
          securityGroups,
          layers,
          architecture: this.architectureValue,
        }
      );
    }

    if (this.scope instanceof Stack && "getResourceTags" in this.scope) {
      const stackResourceTags = (this.scope as IStack).getResourceTags();
      Object.entries(stackResourceTags).forEach(([key, value]) => {
        cdk.Tags.of(lambdaFunction).add(key, value);
      });
    }

    Object.entries(this.resourceTags).forEach(([key, value]) => {
      cdk.Tags.of(lambdaFunction).add(key, value);
    });

    return lambdaFunction;
  }

  /**
   * Sets the name of the Lambda function
   * @param name Name of the Lambda function
   */
  public name(name: string): LambdaBuilder {
    this.resourceName = name;
    return this;
  }

  /**
   * Sets the runtime for the Lambda function
   * @param runtime Runtime for the Lambda function
   */
  public runtime(runtime: lambda.Runtime): LambdaBuilder {
    this.runtimeValue = runtime;
    return this;
  }

  /**
   * Sets the memory size for the Lambda function (in MB)
   * @param size Memory size in MB
   */
  public memory(size: number): LambdaBuilder {
    this.memorySize = size;
    return this;
  }

  /**
   * Sets the timeout for the Lambda function
   * @param duration Timeout duration
   */
  public timeout(duration: cdk.Duration): LambdaBuilder {
    this.timeoutDuration = duration;
    return this;
  }

  /**
   * Sets the log retention period for the Lambda function
   * @param retention Log retention period
   */
  public logRetention(retention: logs.RetentionDays): LambdaBuilder {
    this.logRetentionDays = retention;
    return this;
  }

  /**
   * Sets the bundling options for the Lambda function
   * @param options Bundling options
   */
  public bundling(options: BundlingOptions): LambdaBuilder {
    this.bundlingOptions = options;
    return this;
  }

  /**
   * Sets environment variables for the Lambda function
   * @param variables Environment variables
   */
  public environment(variables: { [key: string]: string }): LambdaBuilder {
    this.environmentVars = {
      ...this.environmentVars,
      ...variables,
    };
    return this;
  }

  /**
   * Sets the architecture for the Lambda function
   * @param arch Architecture for the Lambda function (x86_64 or arm64)
   * @returns The LambdaBuilder instance for method chaining
   * 
   * @example
   * // Set to ARM64 architecture
   * app.lambda("src/handlers/process-data")
   *   .architecture(lambda.Architecture.ARM_64);
   * 
   * @example
   * // Set to x86_64 architecture (default)
   * app.lambda("src/handlers/process-data")
   *   .architecture(lambda.Architecture.X86_64);
   */
  public architecture(arch: lambda.Architecture): LambdaBuilder {
    this.architectureValue = arch;
    return this;
  }

  public get(path: string): LambdaBuilder {
    this.method = "GET";
    this.path = path;
    return this;
  }

  public post(path: string): LambdaBuilder {
    this.method = "POST";
    this.path = path;
    return this;
  }

  public put(path: string): LambdaBuilder {
    this.method = "PUT";
    this.path = path;
    return this;
  }

  public patch(path: string): LambdaBuilder {
    this.method = "PATCH";
    this.path = path;
    return this;
  }

  public delete(path: string): LambdaBuilder {
    this.method = "DELETE";
    this.path = path;
    return this;
  }

  /**
   * Sets an authorizer for the API Gateway route
   * @param authorizer An instance of IHttpRouteAuthorizer (HttpJwtAuthorizer, HttpLambdaAuthorizer, etc.)
   */
  public addAuthorizer(
    authorizer: apigatewayv2.IHttpRouteAuthorizer
  ): LambdaBuilder {
    this.authorizer = authorizer;
    return this;
  }

  /**
   * Adds a custom IAM policy to the Lambda function
   * @param arn ARN of the resource to grant access to
   * @param actions List of IAM actions to allow
   * @param options Additional policy configuration options
   */
  public addPolicy(
    arn: string,
    actions: string[],
    options?: PolicyOptions
  ): LambdaBuilder {
    // Store the policy configuration for later application
    this.policyConfigs.push({ arn, actions, options });
    return this;
  }

  /**
   * Adds an SNS trigger to the Lambda function
   * @param topicArn ARN of the SNS topic
   * @param options Additional options for the SNS subscription
   */
  public addSnsTrigger(topicArn: string, options?: SnsOptions): LambdaBuilder {
    // Store the SNS configuration for later application
    this.snsConfigs.push({ topicArn, options });
    return this;
  }

  /**
   * Adds an SQS trigger to the Lambda function
   * @param queueArn ARN of the SQS queue
   * @param options Additional options for the SQS configuration
   */
  public addSqsTrigger(queueArn: string, options?: SqsOptions): LambdaBuilder {
    // Store the SQS configuration for later application
    this.sqsConfigs.push({ queueArn, options });
    return this;
  }

  /**
   * Adds an S3 trigger to the Lambda function
   * @param bucketArn ARN of the S3 bucket
   * @param options Additional options for the S3 configuration
   */
  public addS3Trigger(bucketArn: string, options?: S3Options): LambdaBuilder {
    // Store the S3 configuration for later application
    this.s3Configs.push({ bucketArn, options });
    return this;
  }

  public addTablePermissions(tableArn: string): LambdaBuilder {
    // Store the table ARN for later application
    this.tableArns.push(tableArn);
    return this;
  }

  /**
   * Adds an EventBridge rule trigger to the Lambda function
   * @param options Options for the EventBridge rule
   */
  public addEventBridgeRuleTrigger(
    options: EventBridgeRuleOptions
  ): LambdaBuilder {
    // Store the EventBridge rule configuration for later application
    this.eventBridgeRuleConfigs.push({ options });
    return this;
  }

  /**
   * Adds an Amazon MSK (Managed Streaming for Apache Kafka) trigger to the Lambda function.
   * This allows your Lambda function to consume messages from an Amazon MSK cluster.
   * 
   * @param config Configuration object for the MSK trigger
   * @param config.clusterArn ARN of the Amazon MSK cluster
   * @param config.topic Kafka topic to consume from
   * @param config.secretArn ARN of the AWS Secrets Manager secret containing Kafka credentials
   * @param config.batchSize Number of records to process in each batch (default: 10)
   * @param config.maximumBatchingWindow Maximum time in seconds to wait for records before processing (default: 1)
   * @param config.startingPosition Starting position for reading from the Kafka topic (TRIM_HORIZON, LATEST, AT_TIMESTAMP)
   * @param config.startingPositionDate ISO String date for AT_TIMESTAMP starting position (format: YYYY-MM-DDTHH:mm:ss.sssZ)
   * @param config.enabled Whether the trigger is enabled (default: true)
   * @param config.consumerGroupId Custom consumer group ID (default: auto-generated)
   * 
   * @returns The LambdaBuilder instance for method chaining
   * 
   * @example
   * Basic MSK trigger
   * app.lambda("src/handlers/orders/process-msk-order")
   *   .addMSKTrigger({
   *     clusterArn: "arn:aws:kafka:us-east-1:123456789012:cluster/your-cluster",
   *     topic: "orders-topic",
   *     secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name"
   *   });
   * 
   * @example
   * MSK trigger with custom configuration
   * app.lambda("src/handlers/orders/process-msk-order")
   *   .addMSKTrigger({
   *     clusterArn: "arn:aws:kafka:us-east-1:123456789012:cluster/your-cluster",
   *     topic: "orders-topic",
   *     secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
   *     batchSize: 100,
   *     maximumBatchingWindow: 5,
   *     startingPosition: StartingPosition.TRIM_HORIZON,
   *     consumerGroupId: "orders-consumer-group"
   *   });
   * 
   * @example
   * MSK trigger with timestamp starting position
   * app.lambda("src/handlers/orders/process-msk-order")
   *   .addMSKTrigger({
   *     clusterArn: "arn:aws:kafka:us-east-1:123456789012:cluster/your-cluster",
   *     topic: "orders-topic",
   *     secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
   *     startingPosition: StartingPosition.AT_TIMESTAMP,
   *     startingPositionDate: "2024-01-01T00:00:00.000Z"
   *   });
   */
  public addMSKTrigger(config: MSKConfig): LambdaBuilder {
    this.mskConfigs.push(config);
    return this;
  }

  /**
   * Adds a Self-Managed Kafka trigger to the Lambda function.
   * This allows your Lambda function to consume messages from a self-managed Kafka cluster
   * (e.g., Confluent Cloud, on-premises Kafka, etc.).
   * 
   * @param config Configuration object for the Self-Managed Kafka trigger
   * @param config.bootstrapServers Array of Kafka broker URLs
   * @param config.topic Kafka topic to consume from
   * @param config.secretArn ARN of the AWS Secrets Manager secret containing Kafka credentials
   * @param config.authenticationMethod Authentication method for Kafka (default: SASL_SCRAM_512_AUTH)
   * @param config.batchSize Number of records to process in each batch (default: 10)
   * @param config.maximumBatchingWindow Maximum time in seconds to wait for records before processing (default: 1)
   * @param config.startingPosition Starting position for reading from the Kafka topic (TRIM_HORIZON, LATEST, AT_TIMESTAMP)
   * @param config.startingPositionDate ISO String date for AT_TIMESTAMP starting position (format: YYYY-MM-DDTHH:mm:ss.sssZ)
   * @param config.enabled Whether the trigger is enabled (default: true)
   * @param config.consumerGroupId Custom consumer group ID (default: auto-generated)
   * @param config.onFailure Dead Letter Queue configuration for failed records
   * @param config.onFailure.destination ARN of the DLQ (SQS, SNS, or S3) - can be literal or CloudFormation token
   * @param config.onFailure.destinationType Type of destination ('sqs', 'sns', 's3') - always required
   * 
   * @returns The LambdaBuilder instance for method chaining
   * 
   * @example
   * Basic Self-Managed Kafka trigger (Confluent Cloud)
   * app.lambda("src/handlers/orders/process-kafka-order")
   *   .addSMKTrigger({
   *     bootstrapServers: ["pkc-p11xm.us-east-1.aws.confluent.cloud:9099"],
   *     topic: "orders-topic",
   *     secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name"
   *   });
   * 
   * @example
   * Self-Managed Kafka trigger with custom configuration
   * app.lambda("src/handlers/orders/process-kafka-order")
   *   .addSMKTrigger({
   *     bootstrapServers: ["kafka-broker-1:9092", "kafka-broker-2:9092"],
   *     topic: "orders-topic",
   *     secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
   *     authenticationMethod: AuthenticationMethod.SASL_SCRAM_256_AUTH,
   *     batchSize: 100,
   *     maximumBatchingWindow: 5,
   *     startingPosition: StartingPosition.TRIM_HORIZON,
   *     consumerGroupId: "orders-consumer-group"
   *   });
   * 
   * @example
   * Self-Managed Kafka trigger with SQS Dead Letter Queue
   * app.lambda("src/handlers/orders/process-kafka-order")
   *   .addSMKTrigger({
   *     bootstrapServers: ["kafka-broker-1:9092", "kafka-broker-2:9092"],
   *     topic: "orders-topic",
   *     secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
   *     batchSize: 100,
   *     maximumBatchingWindow: 10,
   *     onFailure: {
   *       destination: "arn:aws:sqs:us-east-1:123456789012:kafka-dlq",
   *       destinationType: 'sqs'
   *     }
   *   });
   * 
   * @example
   * Self-Managed Kafka trigger with S3 bucket for failed records
   * app.lambda("src/handlers/orders/process-kafka-order")
   *   .addSMKTrigger({
   *     bootstrapServers: ["kafka-broker-1:9092"],
   *     topic: "orders-topic",
   *     secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
   *     onFailure: {
   *       destination: "arn:aws:s3:::my-failed-kafka-records-bucket",
   *       destinationType: 's3'
   *     }
   *   });
   * 
   * @example
   * Self-Managed Kafka trigger with CloudFormation imported DLQ (SQS)
   * app.lambda("src/handlers/orders/process-kafka-order")
   *   .addSMKTrigger({
   *     bootstrapServers: ["kafka-broker-1:9092"],
   *     topic: "orders-topic",
   *     secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
   *     onFailure: {
   *       destination: Fn.importValue('JournalProcessorDLQ-Arn-prod'),
   *       destinationType: 'sqs'  // Required when using CloudFormation tokens
   *     }
   *   });
   * 
   * @example
   * Self-Managed Kafka trigger with timestamp starting position
   * app.lambda("src/handlers/orders/process-kafka-order")
   *   .addSMKTrigger({
   *     bootstrapServers: ["kafka-broker-1:9092"],
   *     topic: "orders-topic",
   *     secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret/your-secret-name",
   *     startingPosition: StartingPosition.AT_TIMESTAMP,
   *     startingPositionDate: "2024-01-01T00:00:00.000Z"
   *   });
   */
  public addSMKTrigger(config: SMKConfig): LambdaBuilder {
    this.smkConfigs.push(config);
    return this;
  }

  /**
   * Adds a DynamoDB Streams trigger to the Lambda function to process real-time stream records
   * from a DynamoDB table. This allows your Lambda function to automatically respond to
   * data changes (inserts, updates, deletes) in the DynamoDB table.
   *
   * @param streamArn ARN of the DynamoDB Stream (e.g., "arn:aws:dynamodb:us-east-1:123456789012:table/MyTable/stream/2024-01-01T00:00:00.000")
   * @param options Optional configuration for the DynamoDB Streams trigger
   * @param options.batchSize Number of records to process in each batch (1-10000, default: 10)
   * @param options.maxBatchingWindow Maximum time in seconds to wait for records before processing (0-300, default: 0)
   * @param options.startingPosition Starting position for reading from the stream (TRIM_HORIZON, LATEST, AT_TIMESTAMP)
   * @param options.enabled Whether the trigger is enabled (default: true)
   * @param options.retryAttempts Number of retry attempts for failed records (0-10000, default: -1 for infinite)
   * @param options.reportBatchItemFailures Whether to report individual batch item failures (default: false)
   * @param options.filters Array of FilterCriteria to filter events before processing
   * @param options.advancedOptions Advanced configuration options for performance tuning
   * @param options.advancedOptions.maxRecordAge Maximum age of records to process
   * @param options.advancedOptions.bisectBatchOnError Split batch in two and retry on error
   * @param options.advancedOptions.parallelizationFactor Number of concurrent batches per shard (1-10)
   * @param options.advancedOptions.tumblingWindow Size of tumbling windows to group records (0-15 minutes)
   * @param options.advancedOptions.filterEncryption KMS key for filter criteria encryption
   * @param options.advancedOptions.metricsConfig Enhanced monitoring metrics configuration
   * @param options.advancedOptions.provisionedPollerConfig Provisioned poller configuration
   *
   * @returns The LambdaBuilder instance for method chaining
   *
   * @example
   * Basic DynamoDB Streams trigger
   * app.lambda("src/handlers/process-user-changes")
   *   .addDynamoStreamsTrigger("arn:aws:dynamodb:us-east-1:123456789012:table/Users/stream/2024-01-01T00:00:00.000");
   *
   * @example
   * DynamoDB Streams trigger with custom configuration
   * app.lambda("src/handlers/process-order-changes")
   *   .addDynamoStreamsTrigger(
   *     "arn:aws:dynamodb:us-east-1:123456789012:table/Orders/stream/2024-01-01T00:00:00.000",
   *     {
   *       batchSize: 50,
   *       maxBatchingWindow: 5,
   *       startingPosition: lambda.StartingPosition.TRIM_HORIZON,
   *       retryAttempts: 3,
   *       reportBatchItemFailures: true,
   *       filters: [{
   *         pattern: JSON.stringify({
   *           eventName: ["INSERT", "MODIFY"]
   *         })
   *       }]
   *     }
   *   );
   *
   * @example
   * DynamoDB Streams trigger with advanced options for high-performance scenarios
   * app.lambda("src/handlers/high-volume-processor")
   *   .addDynamoStreamsTrigger(
   *     "arn:aws:dynamodb:us-east-1:123456789012:table/HighVolumeTable/stream/2024-01-01T00:00:00.000",
   *     {
   *       batchSize: 100,
   *       maxBatchingWindow: 10,
   *       startingPosition: lambda.StartingPosition.LATEST,
   *       reportBatchItemFailures: true,
   *       advancedOptions: {
   *         parallelizationFactor: 5,
   *         maxRecordAge: cdk.Duration.hours(24),
   *         bisectBatchOnError: true,
   *         tumblingWindow: cdk.Duration.minutes(5)
   *       }
   *     }
   *   );
   */
  public addDynamoStreamsTrigger(
    streamArn: string,
    options?: DynamoStreamsOptions
  ): LambdaBuilder {
    this.dynamoStreamsConfigs.push({ streamArn, options });
    return this;
  }

  /**
   * Gets or creates a shared API Gateway
   * @returns An instance of ApiBuilder
   */
  private getOrCreateSharedApi(): ApiBuilder {
    if (sharedApi) return sharedApi;

    const appName = this.stack.stackName.replace(`-${this.stage}`, "");
    const apiName =
      this.stage.length > 0 ? `${appName}-api-${this.stage}` : `${appName}-api`;

    const defaultSettings = CdkLess.getDefaultSettings();
    const corsConfig = defaultSettings.defaultApiOptions?.cors;

    const apiBuilder = new ApiBuilder({
      scope: this.scope,
      id: apiName,
      apiName: apiName,
      description: `Shared API created automatically - ${this.stage}`,
      stageName: this.stage,
      useDefaultCors: corsConfig === undefined ? true : undefined,
      corsConfig: corsConfig,
    });

    sharedApi = apiBuilder;

    return apiBuilder;
  }

  /**
   * Apply all the stored SNS configurations
   */
  private applySnsTriggers(): void {
    this.snsConfigs.forEach((config) => {
      const topic = sns.Topic.fromTopicArn(
        this.scope,
        `${this.resourceName}-imported-topic-${
          this.stage
        }-${this.snsConfigs.indexOf(config)}`,
        config.topicArn
      );

      const snsEventSource = new lambdaEventSources.SnsEventSource(topic, {
        filterPolicy: config.options?.filterPolicy,
        deadLetterQueue: config.options?.deadLetterQueue,
      });

      this.lambda.addEventSource(snsEventSource);

      this.lambda.addPermission(
        `${this.resourceName}-sns-permission-${
          this.stage
        }-${this.snsConfigs.indexOf(config)}`,
        {
          principal: new iam.ServicePrincipal("sns.amazonaws.com"),
          sourceArn: topic.topicArn,
        }
      );
    });
  }

  /**
   * Apply all the stored SQS configurations
   */
  private applySqsTriggers(): void {
    this.sqsConfigs.forEach((config) => {
      const queue = sqs.Queue.fromQueueArn(
        this.scope,
        `${this.resourceName}-imported-queue-${
          this.stage
        }-${this.sqsConfigs.indexOf(config)}`,
        config.queueArn
      );

      const sqsEventSource = new lambdaEventSources.SqsEventSource(queue, {
        batchSize: config.options?.batchSize || 10,
        maxBatchingWindow: config.options?.maxBatchingWindow,
        enabled: config.options?.enabled,
        reportBatchItemFailures: config.options?.reportBatchItemFailures,
        maxConcurrency: config.options?.maxConcurrency,
      });

      this.lambda.addEventSource(sqsEventSource);
      queue.grantConsumeMessages(this.lambda);
    });
  }

  /**
   * Apply all the stored S3 configurations
   */
  private applyS3Triggers(): void {
    this.s3Configs.forEach((config) => {
      const bucket = s3.Bucket.fromBucketArn(
        this.scope,
        `${this.resourceName}-imported-bucket-${
          this.stage
        }-${this.s3Configs.indexOf(config)}`,
        config.bucketArn
      );

      const events = config.options?.events || [s3.EventType.OBJECT_CREATED];
      const filters: s3.NotificationKeyFilter[] = [];

      if (config.options?.prefix) {
        filters.push({ prefix: config.options.prefix });
      }
      if (config.options?.suffix) {
        filters.push({ suffix: config.options.suffix });
      }
      if (config.options?.filters && config.options.filters.length > 0) {
        filters.push(...config.options.filters);
      }

      events.forEach((event) => {
        bucket.addEventNotification(
          event,
          new s3n.LambdaDestination(this.lambda),
          ...filters
        );
      });

      this.lambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["s3:GetObject", "s3:ListBucket"],
          resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
        })
      );
    });
  }

  /**
   * Apply all the stored policy configurations
   */
  private applyPolicies(): void {
    this.policyConfigs.forEach((config) => {
      const policyStatement = new iam.PolicyStatement({
        effect: config.options?.effect || iam.Effect.ALLOW,
      });

      const resources = [config.arn];
      if (config.options?.includeSubResources) {
        resources.push(`${config.arn}/*`);
      }

      policyStatement.addResources(...resources);
      policyStatement.addActions(...config.actions);

      this.lambda.addToRolePolicy(policyStatement);
    });
  }

  /**
   * Apply all the stored table permissions
   */
  private applyTablePermissions(): void {
    this.tableArns.forEach((tableArn, index) => {
      const table = dynamodb.Table.fromTableArn(
        this.scope,
        `${this.resourceName}-imported-table-${this.stage}-${index}`,
        tableArn
      );
      table.grantReadWriteData(this.lambda);
    });
  }

  /**
   * Apply all the stored EventBridge rule configurations
   */
  private applyEventBridgeRuleTriggers(): void {
    this.eventBridgeRuleConfigs.forEach((config, index) => {
      const ruleName =
        config.options.ruleName ||
        `${this.resourceName}-rule-${this.stage}-${index}`;

      // Create the rule
      const rule = new events.Rule(
        this.scope,
        `${this.resourceName}-rule-${index}`,
        {
          ruleName: ruleName,
          description: config.options.description,
          enabled: config.options.enabled !== false, // Default to true if not specified
          schedule: config.options.scheduleExpression
            ? events.Schedule.expression(config.options.scheduleExpression)
            : undefined,
          eventPattern: config.options.eventPattern,
        }
      );

      // Add the Lambda as a target
      rule.addTarget(new eventsTargets.LambdaFunction(this.lambda));
    });
  }

  private applyMSKTriggers(): void {
    for (const config of this.mskConfigs) {
      const secret = secretsmanager.Secret.fromSecretCompleteArn(
        this.scope,
        `${this.resourceName}-kafka-secret`,
        config.secretArn
      );
      let startingPositionTimestamp: number | undefined;
      if (config.startingPositionDate && config.startingPosition === StartingPosition.AT_TIMESTAMP) {
        // Validar que la fecha tenga formato ISO String
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
        if (!isoDateRegex.test(config.startingPositionDate)) {
          throw new Error(`Invalid ISO date format for startingPositionDate: ${config.startingPositionDate}. Expected format: YYYY-MM-DDTHH:mm:ss.sssZ`);
        }
        startingPositionTimestamp = new Date(config.startingPositionDate).getTime() / 1000;
      }

      const eventSource = new ManagedKafkaEventSource({
        clusterArn: config.clusterArn,
        topic: config.topic,
        secret: secret,
        batchSize: config?.batchSize || 10,
        maxBatchingWindow: cdk.Duration.seconds(
          config?.maximumBatchingWindow || 1
        ),
        startingPosition:
          config?.startingPosition || StartingPosition.TRIM_HORIZON,
        enabled: config?.enabled ?? true,
        consumerGroupId:
          config?.consumerGroupId ||
          `lambda-${this.resourceName}-consumer-group`,
        startingPositionTimestamp,
      });

      this.lambda.addEventSource(eventSource);
    }
  }

  private applySMKTriggers(): void {
    this.smkConfigs.forEach((config, index) => {
      const secret = secretsmanager.Secret.fromSecretCompleteArn(
        this.scope,
        `${this.resourceName}-kafka-secret-${index}`,
        config.secretArn
      );

      // Prepare onFailure destination if provided
      let onFailureDestination;
      if (config.onFailure?.destination) {
        const destinationArn = config.onFailure.destination;
        const destinationType = config.onFailure.destinationType;
        
        // Create the appropriate destination based on type
        // CloudFormation will validate the ARN at deployment time
        switch (destinationType) {
          case 'sqs':
            const queue = sqs.Queue.fromQueueArn(
              this.scope,
              `${this.resourceName}-smk-dlq-${index}`,
              destinationArn
            );
            onFailureDestination = new lambdaEventSources.SqsDlq(queue);
            break;
          
          case 'sns':
            const topic = sns.Topic.fromTopicArn(
              this.scope,
              `${this.resourceName}-smk-dlq-${index}`,
              destinationArn
            );
            onFailureDestination = new lambdaEventSources.SnsDlq(topic);
            break;
          
          case 's3':
            const bucket = s3.Bucket.fromBucketArn(
              this.scope,
              `${this.resourceName}-smk-dlq-${index}`,
              destinationArn
            );
            onFailureDestination = new lambdaEventSources.S3OnFailureDestination(bucket);
            break;
        }
      }

      const eventSource = new SelfManagedKafkaEventSource({
        // Base configuration
        bootstrapServers: config.bootstrapServers,
        topic: config.topic,
        authenticationMethod:
          config?.authenticationMethod ||
          AuthenticationMethod.SASL_SCRAM_512_AUTH,
        secret: secret,
        batchSize: config?.batchSize || 10,
        maxBatchingWindow: cdk.Duration.seconds(
          config?.maximumBatchingWindow || 1
        ),
        startingPosition:
          config?.startingPosition || StartingPosition.TRIM_HORIZON,
        enabled: config?.enabled ?? true,
        consumerGroupId:
          config?.consumerGroupId ||
          `lambda-${this.resourceName}-consumer-group`,
        
        // Advanced options
        onFailure: onFailureDestination,
      });

      this.lambda.addEventSource(eventSource);
    });
  }

  /**
   * Applies all stored DynamoDB Streams trigger configurations to the Lambda function.
   * This method processes each DynamoDB Streams configuration and creates the corresponding
   * event source with the specified properties like batch size, batching window, filters,
   * and advanced options such as retry attempts, parallelization, and failure destinations.
   *
   * For each configuration:
   * - Creates a DynamoDB table reference from the provided ARN
   * - Configures the event source with batch processing settings
   * - Applies any specified filters for event filtering
   * - Configures advanced options like parallelization, retry attempts, and failure handling
   * - Adds the event source to the Lambda function
   *
   * @private
   * @returns void
   */
  private applyDynamoStreamsTriggers(): void {
    this.dynamoStreamsConfigs.forEach((config: DynamoStreamsConfig) => {
      const { streamArn, options } = config;

      const advancedOptions = options?.advancedOptions || {};

      const sourceMappingOptions: EventSourceMappingOptions = {
        eventSourceArn: streamArn,
        enabled: options?.enabled ?? true,
        batchSize: options?.batchSize || 10,
        maxBatchingWindow: cdk.Duration.seconds(
          options?.maxBatchingWindow || 0
        ),
        startingPosition: options?.startingPosition || StartingPosition.LATEST,
        reportBatchItemFailures: options?.reportBatchItemFailures,
        retryAttempts: options?.retryAttempts,
        filters: options?.filters,
        ...advancedOptions,
      };

      this.lambda.addEventSourceMapping(streamArn, sourceMappingOptions);
    });
  }

  public build(): lambda.Function {
    if (this.isBuilt) {
      return this.lambda;
    }

    this.lambda = this.createNodejsFunction();

    // Now that the Lambda exists, apply all the stored configurations
    this.applySnsTriggers();
    this.applySqsTriggers();
    this.applyS3Triggers();
    this.applyPolicies();
    this.applyTablePermissions();
    this.applyEventBridgeRuleTriggers();
    this.applyMSKTriggers();
    this.applySMKTriggers();
    this.applyDynamoStreamsTriggers();

    if (this.method && this.path) {
      const sharedApi = this.getOrCreateSharedApi();

      const routeOptions: RouteOptions = {};

      if (this.authorizer) {
        routeOptions.authorizer = this.authorizer;
      }

      sharedApi.addRoute({
        path: this.path,
        resourceName: this.resourceName,
        lambda: this.lambda,
        method: this.method,
        options: routeOptions,
      });
    }

    this.isBuilt = true;
    return this.lambda;
  }

  public getLambda(): lambda.Function {
    return this.lambda;
  }

  static getSharedApi(): ApiBuilder | undefined {
    return sharedApi;
  }

  /**
   * Sets the VPC configuration for the Lambda function
   * @param vpcConfig Configuration object containing VPC settings
   * @param vpcConfig.vpcId The ID of the VPC to place the Lambda function in
   * @param vpcConfig.subnetIds Optional array of subnet IDs where the Lambda function will be placed
   * @param vpcConfig.securityGroupIds Optional array of security group IDs to associate with the Lambda function
   * @returns The LambdaBuilder instance for method chaining
   * @example
   * // Basic VPC configuration
   * app.lambda("src/handlers/users/get-user")
   *   .addVpcConfig({
   *     vpcId: "vpc-1234567890abcdef0"
   *   });
   *
   * // Full VPC configuration with subnets and security groups
   * app.lambda("src/handlers/users/get-user")
   *   .addVpcConfig({
   *     vpcId: "vpc-1234567890abcdef0",
   *     subnetIds: ["subnet-1234567890abcdef0", "subnet-0987654321fedcba0"],
   *     securityGroupIds: ["sg-1234567890abcdef0"]
   *   });
   */
  public addVpcConfig(vpcConfig: IVpcConfig): LambdaBuilder {
    this.vpcConfig = vpcConfig;
    return this;
  }

  /**
   * Attach an existing IAM role to the Lambda function
   * @param config Configuration for attaching an existing IAM role
   * @returns The LambdaBuilder instance for method chaining
   * @throws Error if neither role nor roleArn is provided
   */
  public addRole(config: IamRoleConfig): LambdaBuilder {
    if (!config.role && !config.roleArn) {
      throw new Error('Either role or roleArn must be provided to addRole');
    }

    // If an existing role is provided, use it directly
    if (config.role) {
      this.iamRole = config.role;
      return this;
    }

    // If a role ARN is provided, import the existing role
    this.iamRole = iam.Role.fromRoleArn(
      this.scope,
      `${this.resourceName}-imported-role`,
      config.roleArn!
    );
    return this;
  }

  /**
   * Converts a CamelCase string to kebab-case (separated by hyphens)
   * @param camelCaseStr The CamelCase string to convert
   * @returns The kebab-case string
   * @example
   * // Returns "foo-bar"
   * this.camelCaseToKebabCase("FooBar");
   *
   * // Returns "hello-world-example"
   * this.camelCaseToKebabCase("HelloWorldExample");
   *
   * // Returns "simple"
   * this.camelCaseToKebabCase("simple");
   */
  private camelCaseToKebabCase(camelCaseStr: string): string {
    return camelCaseStr
      .replace(/([a-z])([A-Z])/g, "$1-$2") // Insert hyphen before uppercase letters
      .toLowerCase(); // Convert entire string to lowercase
  }

  private applyDefaultLambdaOptions(): void {
    const defaultSettings = CdkLess.getDefaultSettings();
    const defaultLambdaOptions = defaultSettings.defaultLambdaOptions || {};

    this.runtimeValue = defaultLambdaOptions.runtime || this.runtimeValue;
    this.memorySize = defaultLambdaOptions.memorySize || this.memorySize;
    this.timeoutDuration = defaultLambdaOptions.timeout || this.timeoutDuration;
    this.logRetentionDays = defaultLambdaOptions.logRetention || this.logRetentionDays;
    this.architectureValue = defaultLambdaOptions.architecture || this.architectureValue;

    if (defaultLambdaOptions.environment) {
      this.environmentVars = {
        ...this.environmentVars,
        ...defaultLambdaOptions.environment,
      };
    }
  }
}
