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
} from "./interfaces/lambda";
import { StartingPosition } from "aws-cdk-lib/aws-lambda";
import { RouteOptions } from "./interfaces";
import { AwsResourceTags } from "./interfaces/tags";
import { IStack } from "./interfaces/stack";
import { IVpcConfig } from "./interfaces/lambda/lambda-vpc";
import * as ec2 from "aws-cdk-lib/aws-ec2";

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
   * Creates a NodejsFunction with the current configuration values
   */
  private createNodejsFunction(): lambda.Function {
    if (!this.handlerPath) {
      throw new Error("Handler path is not defined");
    }

    const logGroup = new logs.LogGroup(
      this.scope,
      `${this.resourceName}-log-group`,
      {
        retention: this.logRetentionDays,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    const functionName =
      this.stage.length > 0
        ? `${this.resourceName}-${this.stage}`
        : this.resourceName;

    // Default bundling options
    const defaultBundling = {
      minify: true,
      sourceMap: false,
      externalModules: ["aws-sdk"],
    };

    // Merge default bundling with custom bundling options
    const bundlingConfig = this.bundlingOptions 
      ? { ...defaultBundling, ...this.bundlingOptions }
      : defaultBundling;

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

    const lambdaFunction = new NodejsFunction(
      this.scope,
      `${this.resourceName}-function`,
      {
        functionName: functionName,
        runtime: this.runtimeValue,
        memorySize: this.memorySize,
        timeout: this.timeoutDuration,
        entry: `${this.handlerPath}.ts`,
        handler: "handler",
        bundling: bundlingConfig,
        environment: this.environmentVars,
        logGroup,
        vpc,
        vpcSubnets: subnets ? { subnets } : undefined,
        securityGroups,
      }
    );

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

  public addMSKTrigger(config: MSKConfig): LambdaBuilder {
    this.mskConfigs.push(config);
    return this;
  }

  public addSMKTrigger(config: SMKConfig): LambdaBuilder {
    this.smkConfigs.push(config);
    return this;
  }

  /**
   * Agrega un trigger de DynamoDB Streams a la función Lambda
   * @param tableArn ARN de la tabla de DynamoDB que tiene habilitados los streams
   * @param config Configuración opcional para el trigger de DynamoDB Streams
   * @returns La instancia de LambdaBuilder para encadenar métodos
   */
  public addDynamoStreamsTrigger(tableArn: string, config?: DynamoStreamsConfig): LambdaBuilder {
    this.dynamoStreamsConfigs.push({ tableArn, ...config });
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

    const apiBuilder = new ApiBuilder({
      scope: this.scope,
      id: apiName,
      apiName: apiName,
      description: `Shared API created automatically - ${this.stage}`,
      stageName: this.stage,
      useDefaultCors: true,
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
      });

      this.lambda.addEventSource(eventSource);
    }
  }

  private applySMKTriggers(): void {
    for (const config of this.smkConfigs) {
      const secret = secretsmanager.Secret.fromSecretCompleteArn(
        this.scope,
        `${this.resourceName}-kafka-secret`,
        config.secretArn
      );

      const eventSource = new SelfManagedKafkaEventSource({
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
      });

      this.lambda.addEventSource(eventSource);
    }
  }

  private applyDynamoStreamsTriggers(): void {
    this.dynamoStreamsConfigs.forEach((config, index) => {
      const table = dynamodb.Table.fromTableArn(
        this.scope,
        `${this.resourceName}-imported-table-${this.stage}-${index}`,
        config.tableArn
      );

      const eventSource = new lambdaEventSources.DynamoEventSource(table, {
        batchSize: config.batchSize || 10,
        maxBatchingWindow: config.maxBatchingWindow 
          ? cdk.Duration.seconds(config.maxBatchingWindow)
          : undefined,
        startingPosition: config.startingPosition || StartingPosition.TRIM_HORIZON,
        enabled: config.enabled ?? true,
        retryAttempts: config.retryAttempts,
        reportBatchItemFailures: config.reportBatchItemFailures,
      });

      this.lambda.addEventSource(eventSource);
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
}
