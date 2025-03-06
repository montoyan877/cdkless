import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import { Stack } from 'aws-cdk-lib';
import { ApiBuilder } from './api-builder';
import * as path from 'path';

export interface LambdaBuilderProps {
  scope: Construct;      // Scope is still required for CDK
  handler: string;       // Only required parameter - path to handler (without extension)
}

// Interfaces for trigger configuration options
export interface SnsOptions {
  filterPolicy?: { [key: string]: sns.SubscriptionFilter };
  deadLetterQueue?: sqs.IQueue;
}

export interface SqsOptions {
  batchSize?: number;
  maxBatchingWindow?: cdk.Duration;
  enabled?: boolean;
  reportBatchItemFailures?: boolean;
  maxConcurrency?: number;
}

export interface S3Options {
  events?: s3.EventType[];
  filters?: s3.NotificationKeyFilter[];
  prefix?: string;
  suffix?: string;
}

// Interface for IAM policy configuration options
export interface PolicyOptions {
  includeSubResources?: boolean;  // If true, also adds `${arn}/*` as a resource
  effect?: iam.Effect;            // Effect.ALLOW by default
}

// Interface for authorizer options
export interface AuthorizerOptions {
  authorizerType?: 'HTTP' | 'JWT' | 'LAMBDA' | 'IAM';  // Authorizer type
  identitySource?: string[];                        // Identity sources (e.g., headers, query params)
  authorizationScopes?: string[];                   // Authorization scopes for JWT
  cacheTime?: cdk.Duration;                         // Cache time for responses
}

// Interface to store trigger information
interface TriggerInfo {
  type: 'sns' | 'sqs' | 's3' | 'api';
  resourceArn?: string;
  resourceName?: string;
  method?: string;
  path?: string;
}

// Interface to store Lambda information
interface LambdaInfo {
  id: string;
  lambda: lambda.Function;
  triggers: TriggerInfo[];
}

// Global store for shared APIs (per stack)
const sharedApis = new Map<string, ApiBuilder>();

// Global store for all created Lambdas (per stack)
const lambdaRegistry = new Map<string, LambdaInfo[]>();

// Global store for imported authorizers (per stack)
const importedAuthorizers = new Map<string, any>();

export class LambdaBuilder {
  private lambda: lambda.Function;
  private method?: string;
  private path?: string;
  private scope: Construct;
  private id: string;
  private resourceName: string;
  private environmentVars: { [key: string]: string } = {};
  private stack: Stack;
  private triggers: TriggerInfo[] = [];
  private stage: string;
  private isBuilt = false;
  private isAutoBuilding = false;
  private authorizerArn?: string;
  private authorizerOptions?: AuthorizerOptions;

  // New configuration properties with default values
  private runtimeValue: lambda.Runtime = lambda.Runtime.NODEJS_20_X;
  private memorySize: number = 256;
  private timeoutDuration: cdk.Duration = cdk.Duration.seconds(30);
  private logRetentionDays: logs.RetentionDays = logs.RetentionDays.ONE_MONTH;

  constructor(props: LambdaBuilderProps) {
    this.scope = props.scope;
    this.stack = Stack.of(this.scope);
    
    // Get stage from environment variables or use 'dev' as default
    this.stage = process.env.STAGE || 'dev';
    
    // Extract the last segment of the handler path
    const handlerPath = props.handler;
    const segments = handlerPath.split('/');
    const lastSegment = segments[segments.length - 1];
    
    // Generate resource name (kebab-case)
    this.resourceName = lastSegment;
    
    // Generate ID for CDK (PascalCase)
    this.id = lastSegment
      .split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    
    // Create NodejsFunction - configurable values will be applied in build()
    this.lambda = this.createNodejsFunction(props.handler);

    // Initialize Lambda registry for this stack if it doesn't exist
    const stackId = this.stack.stackId;
    if (!lambdaRegistry.has(stackId)) {
      lambdaRegistry.set(stackId, []);
    }

    // Initialize authorizer registry for this stack if it doesn't exist
    if (!importedAuthorizers.has(stackId)) {
      importedAuthorizers.set(stackId, new Map<string, any>());
    }

    // Create a proxy to handle automatic building
    return new Proxy(this, {
      get: (target: LambdaBuilder, prop: string | symbol, receiver: any) => {
        // First get the original method or property
        const original = Reflect.get(target, prop, receiver);
        
        // If it's not a function, simply return it
        if (typeof original !== 'function') {
          return original;
        }
        
        // If it is a function, return a wrapped version
        return function(...args: any[]) {
          // If we're trying to access build(), simply execute it
          if (prop === 'build') {
            return original.apply(target, args);
          }
          
          // If we're trying to access getLambda() and it hasn't been built, build first
          if (prop === 'getLambda' && !target.isBuilt) {
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
            
            // Reset the flag
            target.isAutoBuilding = false;
            return result;
          } else {
            return original.apply(target, args);
          }
        };
      }
    });
  }

  /**
   * Creates a NodejsFunction with the current configuration values
   */
  private createNodejsFunction(handlerPath: string): lambda.Function {
    return new NodejsFunction(this.scope, `${this.id}-function`, {
      functionName: `${this.resourceName}-${this.stage}`,
      runtime: this.runtimeValue,
      memorySize: this.memorySize,
      timeout: this.timeoutDuration,
      logRetention: this.logRetentionDays,
      entry: `${handlerPath}.ts`,  // Automatically use the .ts extension
      handler: 'handler',          // The name of the exported function
      bundling: {
        externalModules: [
          'aws-sdk', // Don't include aws-sdk in the bundle
        ],
        minify: true,
        sourceMap: true,
      },
      environment: {
        STAGE: this.stage,
      },
    });
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

  public get(path: string): LambdaBuilder {
    this.method = 'GET';
    this.path = path;
    
    // Register the API trigger
    this.triggers.push({
      type: 'api',
      method: 'GET',
      path: path,
    });
    
    return this;
  }

  public post(path: string): LambdaBuilder {
    this.method = 'POST';
    this.path = path;
    
    // Register the API trigger
    this.triggers.push({
      type: 'api',
      method: 'POST',
      path: path,
    });
    
    return this;
  }

  public put(path: string): LambdaBuilder {
    this.method = 'PUT';
    this.path = path;
    
    // Register the API trigger
    this.triggers.push({
      type: 'api',
      method: 'PUT',
      path: path,
    });
    
    return this;
  }

  public delete(path: string): LambdaBuilder {
    this.method = 'DELETE';
    this.path = path;
    
    // Register the API trigger
    this.triggers.push({
      type: 'api',
      method: 'DELETE',
      path: path,
    });
    
    return this;
  }

  /**
   * Adds an authorizer to the API Gateway route
   * @param authorizerArn ARN of the Lambda function that implements the authorizer
   * @param options Additional options for the authorizer
   */
  public addAuthorizer(authorizerArn: string, options?: AuthorizerOptions): LambdaBuilder {
    // Save the authorizer information to use it in build()
    this.authorizerArn = authorizerArn;
    this.authorizerOptions = options || { 
      authorizerType: 'HTTP',
      identitySource: ['$request.header.Authorization']
    };
    
    return this;
  }

  /**
   * Adds a custom IAM policy to the Lambda function
   * @param arn ARN of the resource to grant access to
   * @param actions List of IAM actions to allow
   * @param options Additional policy configuration options
   */
  public addPolicy(arn: string, actions: string[], options?: PolicyOptions): LambdaBuilder {
    // Create a new policy statement
    const policyStatement = new iam.PolicyStatement({
      effect: options?.effect || iam.Effect.ALLOW
    });
    
    // Add the main resource
    const resources = [arn];
    
    // If specified, also add sub-resources
    if (options?.includeSubResources) {
      resources.push(`${arn}/*`);
    }
    
    // Add resources and actions to the policy
    policyStatement.addResources(...resources);
    policyStatement.addActions(...actions);
    
    // Add the policy to the Lambda role
    this.lambda.addToRolePolicy(policyStatement);
    
    return this;
  }

  /**
   * Adds an SNS trigger to the Lambda function
   * @param topicArn ARN of the SNS topic
   * @param options Additional options for the SNS subscription
   */
  public addSnsTrigger(topicArn: string, options?: SnsOptions): LambdaBuilder {
    // Import existing topic by ARN
    const topic = sns.Topic.fromTopicArn(this.scope, `${this.id}-imported-topic-${this.stage}`, topicArn);
    
    // Configure the SNS event with the provided options
    const snsEventSource = new lambdaEventSources.SnsEventSource(topic, {
      filterPolicy: options?.filterPolicy,
      deadLetterQueue: options?.deadLetterQueue,
    });
    
    // Add the event to the Lambda
    this.lambda.addEventSource(snsEventSource);
    
    // Configure permission for SNS to invoke the Lambda
    this.lambda.addPermission(`${this.id}-sns-permission-${this.stage}`, {
      principal: new iam.ServicePrincipal('sns.amazonaws.com'),
      sourceArn: topic.topicArn,
    });
    
    // Extract topic name from ARN
    const topicName = topicArn.split(':').pop() || 'unknown-topic';
    
    // Register the SNS trigger
    this.triggers.push({
      type: 'sns',
      resourceArn: topicArn,
      resourceName: topicName
    });
    
    return this;
  }

  /**
   * Adds an SQS trigger to the Lambda function
   * @param queueArn ARN of the SQS queue
   * @param options Additional options for the SQS configuration
   */
  public addSqsTrigger(queueArn: string, options?: SqsOptions): LambdaBuilder {
    // Import existing queue by ARN
    const queue = sqs.Queue.fromQueueArn(this.scope, `${this.id}-imported-queue-${this.stage}`, queueArn);
    
    // Configure the SQS event with the provided options
    const sqsEventSource = new lambdaEventSources.SqsEventSource(queue, {
      batchSize: options?.batchSize || 10,
      maxBatchingWindow: options?.maxBatchingWindow,
      enabled: options?.enabled,
      reportBatchItemFailures: options?.reportBatchItemFailures,
      maxConcurrency: options?.maxConcurrency,
    });
    
    // Add the event to the Lambda
    this.lambda.addEventSource(sqsEventSource);
    
    // Grant additional permissions
    queue.grantConsumeMessages(this.lambda);
    
    // Extract queue name from ARN
    const queueName = queueArn.split(':').pop() || 'unknown-queue';
    
    // Register the SQS trigger
    this.triggers.push({
      type: 'sqs',
      resourceArn: queueArn,
      resourceName: queueName,
    });
    
    return this;
  }

  /**
   * Adds an S3 trigger to the Lambda function
   * @param bucketArn ARN of the S3 bucket
   * @param options Additional options for the S3 configuration
   */
  public addS3Trigger(bucketArn: string, options?: S3Options): LambdaBuilder {
    // Import existing bucket by ARN
    const bucket = s3.Bucket.fromBucketArn(this.scope, `${this.id}-imported-bucket-${this.stage}`, bucketArn);
    
    // By default, configure for object creation events if none specified
    const events = options?.events || [s3.EventType.OBJECT_CREATED];
    
    // Configure S3 notification with the provided options
    const filters: s3.NotificationKeyFilter[] = [];
    
    // Add prefix and suffix filters if provided
    if (options?.prefix) {
      filters.push({ prefix: options.prefix });
    }
    if (options?.suffix) {
      filters.push({ suffix: options.suffix });
    }
    
    // Add additional filters if provided
    if (options?.filters && options.filters.length > 0) {
      filters.push(...options.filters);
    }
    
    // Add the S3 event to the Lambda
    bucket.addEventNotification(
      events[0], 
      new s3n.LambdaDestination(this.lambda),
      ...filters
    );
    
    // For additional events, add them one by one
    if (events.length > 1) {
      for (let i = 1; i < events.length; i++) {
        bucket.addEventNotification(
          events[i],
          new s3n.LambdaDestination(this.lambda),
          ...filters
        );
      }
    }
    
    // Grant additional permissions
    this.lambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:ListBucket'],
      resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
    }));
    
    // Extract bucket name from ARN
    const bucketName = bucketArn.split(':').pop() || bucketArn.split(':::').pop() || 'unknown-bucket';
    
    // Register the S3 trigger
    this.triggers.push({
      type: 's3',
      resourceArn: bucketArn,
      resourceName: bucketName,
    });
    
    return this;
  }

  public addTable(tableArn: string): LambdaBuilder {
    // Import existing table by ARN
    const table = dynamodb.Table.fromTableArn(this.scope, `${this.id}-imported-table-${this.stage}`, tableArn);
    table.grantReadWriteData(this.lambda);
    
    // Extract table name from ARN to use in environment variables
    const tableName = tableArn.split('/').pop() || tableArn.split(':').pop();
    if (tableName) {
      this.environmentVars['TABLE_NAME'] = tableName;
    }
    return this;
  }

  /**
   * Configures environment variables for the Lambda function
   * @param env Environment variables to add
   */
  public environment(env: { [key: string]: string }): LambdaBuilder {
    // Merge with existing environment variables
    this.environmentVars = { ...this.environmentVars, ...env };
    Object.entries(this.environmentVars).forEach(([key, value]) => {
      this.lambda.addEnvironment(key, value);
    });
    return this;
  }

  /**
   * Gets or creates a shared API Gateway
   * @returns An instance of ApiBuilder
   */
  private getOrCreateSharedApi(): ApiBuilder {
    // Get current stack ID
    const stackId = this.stack.stackId;
    
    // Check if an API already exists for this stack
    if (sharedApis.has(stackId)) {
      // Return existing API
      return sharedApis.get(stackId)!;
    }
    
    // If not, create a new one
    const apiBuilder = new ApiBuilder({
      scope: this.scope,
      id: `${this.stack.stackName}-SharedApi-${this.stage}`,
      apiName: `${this.stack.stackName}-api-${this.stage}`,
      description: `Shared API created automatically - ${this.stage}`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key']
      }
    });
    
    // Save it in the map for reuse
    sharedApis.set(stackId, apiBuilder);
    
    // Return the existing or newly created API
    return apiBuilder;
  }

  /**
   * Gets or creates an imported authorizer
   * @param authorizerArn ARN of the authorizer to import
   * @param options Configuration options for the authorizer
   * @returns The authorizer instance
   */
  private getOrCreateAuthorizer(authorizerArn: string, options: AuthorizerOptions): any {
    const authorizers = importedAuthorizers.get(this.stack.stackId) as Map<string, any>;
    
    // If we already have this authorizer imported, reuse it
    if (authorizers.has(authorizerArn)) {
      return authorizers.get(authorizerArn);
    }
    
    // If not, create a new authorizer based on type
    let authorizer;
    
    // Extract function name from ARN to use as ID
    const arnParts = authorizerArn.split(':');
    const authName = arnParts[arnParts.length - 1].replace(/[^a-zA-Z0-9]/g, '');
    
    // Import Lambda function that implements the authorizer
    const defaultFunction = lambda.Function.fromFunctionArn(
      this.scope,
      `ImportedAuthorizer${authName}`,
      authorizerArn
    );
    
    if (options.authorizerType === 'HTTP' || !options.authorizerType) {
      // Create an HTTP authorizer
      authorizer = new apigateway.RequestAuthorizer(this.scope, authName, {
        handler: defaultFunction,
        identitySources: options.identitySource || ['method.request.header.Authorization'],
        resultsCacheTtl: options.cacheTime
      });
    } else if (options.authorizerType === 'JWT') {
      // Implementation for JWT Authorizer (for future expansion)
      // Currently throws an exception
      throw new Error('JWT Authorizer not yet implemented');
    } else if (options.authorizerType === 'IAM') {
      // Implementation for IAM Authorizer (for future expansion)
      // Currently throws an exception
      throw new Error('IAM Authorizer not yet implemented');
    } else {
      // For any other type, assume HTTP as default
      authorizer = new apigateway.RequestAuthorizer(this.scope, authName, {
        handler: defaultFunction,
        identitySources: options.identitySource || ['method.request.header.Authorization'],
        resultsCacheTtl: options.cacheTime
      });
    }
    
    // Save the authorizer for reuse
    authorizers.set(authorizerArn, authorizer);
    
    return authorizer;
  }

  public build(): lambda.Function {
    if (this.isBuilt) {
      return this.lambda;
    }

    // Add API Gateway integration if method and path are set
    if (this.method && this.path) {
      // Get or create the shared API
      const sharedApi = this.getOrCreateSharedApi();
      
      // If an authorizer has been specified, add it to the route
      let methodOptions: apigateway.MethodOptions = {};
      
      if (this.authorizerArn && this.authorizerOptions) {
        const authorizer = this.getOrCreateAuthorizer(this.authorizerArn, this.authorizerOptions);
        
        methodOptions = {
          authorizer,
          authorizationType: apigateway.AuthorizationType.CUSTOM
        };
        
        // If scopes are specified, add them to the method options
        if (this.authorizerOptions.authorizationScopes && this.authorizerOptions.authorizationScopes.length > 0) {
          methodOptions = {
            ...methodOptions,
            authorizationScopes: this.authorizerOptions.authorizationScopes
          };
        }
      }
      
      // Add the route to the shared API with the authorizer if present
      sharedApi.addRoute(this.path, this.lambda, this.method, methodOptions);
      
      // Update API-type triggers with the base URL
      this.triggers = this.triggers.map(trigger => {
        if (trigger.type === 'api') {
          return {
            ...trigger,
            resourceArn: sharedApi.getApiUrl(),
          };
        }
        return trigger;
      });
    }

    // Register the Lambda and its triggers
    const stackId = this.stack.stackId;
    const lambdaInfos = lambdaRegistry.get(stackId)!;
    lambdaInfos.push({
      id: this.id,
      lambda: this.lambda,
      triggers: [...this.triggers]
    });
    
    // If this is the last Lambda to be created, generate CfnOutputs
    this.generateCfnOutputs();
    
    this.isBuilt = true;
    return this.lambda;
  }

  private generateCfnOutputs(): void {
    // We don't know yet if this is the last Lambda, so schedule the generation
    // to happen after all Lambdas have been created
    process.nextTick(() => {
      const stackId = this.stack.stackId;
      const lambdaInfos = lambdaRegistry.get(stackId)!;
      const sharedApi = sharedApis.get(stackId);
      
      if (!sharedApi) return;
      
      // Generate a CfnOutput for the API base URL
      new cdk.CfnOutput(this.scope, `ApiGatewayUrl-${this.stage}`, {
        value: sharedApi.getApiUrl(),
        description: `Shared API Gateway base URL - ${this.stage}`
      });
      
      // Generate CfnOutputs for each Lambda and its triggers
      lambdaInfos.forEach((lambdaInfo) => {
        const id = lambdaInfo.id;
        const triggers = lambdaInfo.triggers;
        
        // Generate trigger details
        const triggerDetails = triggers.map(trigger => {
          switch (trigger.type) {
            case 'api':
              return `Lambda: [${id}] -> ${trigger.method} ${sharedApi.getEndpoint(trigger.path || '')}`;
            case 'sns':
              return `Lambda: [${id}] -> TRIGGERED by SNS [${trigger.resourceName}]`;
            case 'sqs':
              return `Lambda: [${id}] -> TRIGGERED by SQS [${trigger.resourceName}]`;
            case 's3':
              return `Lambda: [${id}] -> TRIGGERED by S3 [${trigger.resourceName}]`;
            default:
              return '';
          }
        }).filter(text => text !== '');
        
        // Only create CfnOutput if there are triggers to display
        if (triggerDetails.length > 0) {
          new cdk.CfnOutput(this.scope, `Lambda${id}Triggers-${this.stage}`, {
            value: triggerDetails.join('\n'),
            description: `Triggers for Lambda ${id} - ${this.stage}`
          });
        }
      });
    });
  }

  public getLambda(): lambda.Function {
    return this.lambda;
  }
  
  public static getSharedApi(scope: Construct): ApiBuilder | undefined {
    const stack = Stack.of(scope);
    return sharedApis.get(stack.stackId);
  }
} 
