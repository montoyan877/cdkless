import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
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
import { Names, Stack } from 'aws-cdk-lib';
import { ApiBuilder } from './api-builder';

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

export class LambdaBuilder {
  private lambda: lambda.Function;
  private method?: string;
  private path?: string;
  private scope: Construct;
  private id: string;
  private resourceName: string;
  private environmentVars: { [key: string]: string } = {
    STAGE: process.env.STAGE || ''
  };
  private stack: Stack;
  private triggers: TriggerInfo[] = [];
  private stage: string;
  private isBuilt = false;
  private isAutoBuilding = false;
  private authorizer?: apigatewayv2.IHttpRouteAuthorizer;
  
  // New configuration properties with default values
  private runtimeValue: lambda.Runtime = lambda.Runtime.NODEJS_22_X;
  private memorySize: number = 256;
  private timeoutDuration: cdk.Duration = cdk.Duration.seconds(30);
  private logRetentionDays: logs.RetentionDays = logs.RetentionDays.ONE_MONTH;
  private handlerPath: string;

  constructor(props: LambdaBuilderProps) {
    this.scope = props.scope;
    this.stack = Stack.of(this.scope);
    
    // Get stage from environment variables
    this.stage = process.env.STAGE || '';
    
    // Extract the last segment of the handler path
    this.handlerPath = props.handler;
    const segments = this.handlerPath.split('/');
    const lastSegment = segments[segments.length - 1];
    
    // Generate resource name (kebab-case)
    this.resourceName = lastSegment;
    
    // Generate ID
    this.id = Names.uniqueId(this.scope);
    
    // Initialize Lambda registry for this stack if it doesn't exist
    const stackId = this.stack.stackId;
    if (!lambdaRegistry.has(stackId)) {
      lambdaRegistry.set(stackId, []);
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
  private createNodejsFunction(): lambda.Function {
    // Asegurarnos de que tenemos un handlerPath definido
    if (!this.handlerPath) {
      throw new Error('Handler path is not defined');
    }

    return new NodejsFunction(this.scope, `${this.id}-function`, {
      functionName: `${this.resourceName}-${this.stage}`,
      runtime: this.runtimeValue,
      memorySize: this.memorySize,
      timeout: this.timeoutDuration,
      logRetention: this.logRetentionDays,
      entry: `${this.handlerPath}.ts`,
      handler: 'handler',
      bundling: {
        externalModules: [
          'aws-sdk',
        ],
        minify: true,
        sourceMap: true,
      },
      environment: this.environmentVars,
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

  /**
   * Sets environment variables for the Lambda function
   * @param variables Environment variables
   */
  public environment(variables: { [key: string]: string }): LambdaBuilder {
    this.environmentVars = {
      ...this.environmentVars,
      ...variables
    };
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
   * Sets an authorizer for the API Gateway route
   * @param authorizer An instance of IHttpRouteAuthorizer (HttpJwtAuthorizer, HttpLambdaAuthorizer, etc.)
   */
  public addAuthorizer(authorizer: apigatewayv2.IHttpRouteAuthorizer): LambdaBuilder {
    this.authorizer = authorizer;
    return this;
  }

  /**
   * Adds a custom IAM policy to the Lambda function
   * @param arn ARN of the resource to grant access to
   * @param actions List of IAM actions to allow
   * @param options Additional policy configuration options
   */
  public addPolicy(arn: string, actions: string[], options?: PolicyOptions): LambdaBuilder {
    const policyStatement = new iam.PolicyStatement({
      effect: options?.effect || iam.Effect.ALLOW
    });
    
    const resources = [arn];
    
    if (options?.includeSubResources) {
      resources.push(`${arn}/*`);
    }
    
    policyStatement.addResources(...resources);
    policyStatement.addActions(...actions);
    
    this.lambda.addToRolePolicy(policyStatement);
    
    return this;
  }

  /**
   * Adds an SNS trigger to the Lambda function
   * @param topicArn ARN of the SNS topic
   * @param options Additional options for the SNS subscription
   */
  public addSnsTrigger(topicArn: string, options?: SnsOptions): LambdaBuilder {
    const topic = sns.Topic.fromTopicArn(this.scope, `${this.id}-imported-topic-${this.stage}`, topicArn);
    
    const snsEventSource = new lambdaEventSources.SnsEventSource(topic, {
      filterPolicy: options?.filterPolicy,
      deadLetterQueue: options?.deadLetterQueue,
    });
    
    this.lambda.addEventSource(snsEventSource);
    
    this.lambda.addPermission(`${this.id}-sns-permission-${this.stage}`, {
      principal: new iam.ServicePrincipal('sns.amazonaws.com'),
      sourceArn: topic.topicArn,
    });
    
    const topicName = topicArn.split(':').pop() || 'unknown-topic';
    
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
    const queue = sqs.Queue.fromQueueArn(this.scope, `${this.id}-imported-queue-${this.stage}`, queueArn);
    
    const sqsEventSource = new lambdaEventSources.SqsEventSource(queue, {
      batchSize: options?.batchSize || 10,
      maxBatchingWindow: options?.maxBatchingWindow,
      enabled: options?.enabled,
      reportBatchItemFailures: options?.reportBatchItemFailures,
      maxConcurrency: options?.maxConcurrency,
    });
    
    this.lambda.addEventSource(sqsEventSource);
    
    queue.grantConsumeMessages(this.lambda);
    
    const queueName = queueArn.split(':').pop() || 'unknown-queue';
    
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
    const bucket = s3.Bucket.fromBucketArn(this.scope, `${this.id}-imported-bucket-${this.stage}`, bucketArn);
    
    const events = options?.events || [s3.EventType.OBJECT_CREATED];
    
    const filters: s3.NotificationKeyFilter[] = [];
    
    if (options?.prefix) {
      filters.push({ prefix: options.prefix });
    }
    if (options?.suffix) {
      filters.push({ suffix: options.suffix });
    }
    
    if (options?.filters && options.filters.length > 0) {
      filters.push(...options.filters);
    }
    
    bucket.addEventNotification(
      events[0], 
      new s3n.LambdaDestination(this.lambda),
      ...filters
    );
    
    if (events.length > 1) {
      for (let i = 1; i < events.length; i++) {
        bucket.addEventNotification(
          events[i],
          new s3n.LambdaDestination(this.lambda),
          ...filters
        );
      }
    }
    
    this.lambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:ListBucket'],
      resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
    }));
    
    const bucketName = bucketArn.split(':').pop() || bucketArn.split(':::').pop() || 'unknown-bucket';
    
    this.triggers.push({
      type: 's3',
      resourceArn: bucketArn,
      resourceName: bucketName,
    });
    
    return this;
  }

  public addTablePermissions(tableArn: string): LambdaBuilder {
    const table = dynamodb.Table.fromTableArn(this.scope, `${this.id}-imported-table-${this.stage}`, tableArn);
    table.grantReadWriteData(this.lambda);
    return this;
  }

  /**
   * Gets or creates a shared API Gateway
   * @returns An instance of ApiBuilder
   */
  private getOrCreateSharedApi(): ApiBuilder {
    const stackId = this.stack.stackId;
    
    if (sharedApis.has(stackId)) {
      return sharedApis.get(stackId)!;
    }
    
    const apiBuilder = new ApiBuilder({
      scope: this.scope,
      id: `${this.stack.stackName}-SharedApi-${this.stage}`,
      apiName: `${this.stack.stackName}-api-${this.stage}`,
      description: `Shared API created automatically - ${this.stage}`,
      stageName: this.stage,
      useDefaultCors: true
    });
    
    sharedApis.set(stackId, apiBuilder);
    
    return apiBuilder;
  }

  public build(): lambda.Function {
    if (this.isBuilt) {
      return this.lambda;
    }

    // Crear o recrear el Lambda con las configuraciones actualizadas
    this.lambda = this.createNodejsFunction();

    if (this.method && this.path) {
      const sharedApi = this.getOrCreateSharedApi();
      
      const routeOptions: any = {};
      
      if (this.authorizer) {
        routeOptions.authorizer = this.authorizer;
      }
      
      sharedApi.addRoute(this.path, this.lambda, this.method, routeOptions);
      
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

    const stackId = this.stack.stackId;
    const lambdaInfos = lambdaRegistry.get(stackId)!;
    lambdaInfos.push({
      id: this.id,
      lambda: this.lambda,
      triggers: [...this.triggers]
    });
    
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
      
      // Solo crear CfnOutput si no estamos en un entorno de prueba
      if (process.env.NODE_ENV !== 'test') {
        try {
          // Generate a CfnOutput for the API base URL
          new cdk.CfnOutput(this.scope, `ApiGatewayUrl-${this.stage}`, {
            value: sharedApi.getApiUrl(),
            description: `Shared API Gateway base URL - ${this.stage}`
          });
        } catch (error) {
          console.warn('Unable to create CfnOutput for API URL:', error);
        }
      }
      
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
        
        if (triggerDetails.length > 0) {
          // Solo crear CfnOutput si no estamos en un entorno de prueba
          if (process.env.NODE_ENV !== 'test') {
            try {
              new cdk.CfnOutput(this.scope, `Lambda${id}Triggers-${this.stage}`, {
                value: triggerDetails.join('\n'),
                description: `Triggers for Lambda ${id} - ${this.stage}`
              });
            } catch (error) {
              console.warn(`Unable to create CfnOutput for Lambda ${id} triggers:`, error);
            }
          }
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
