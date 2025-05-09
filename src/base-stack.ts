import * as cdk from "aws-cdk-lib";
import { LambdaBuilder } from "./lambda-builder";
import { AwsResourceTags, TagsConfig } from "./interfaces/tags";
import { IStack } from "./interfaces/stack";

/**
 * Base class that provides simplified methods
 * to interact with the CDK-less framework
 */
export class CdkLess extends cdk.Stack implements IStack {
  private app: cdk.App;
  protected stage: string;
  private stackTags: AwsResourceTags = {};
  private resourceTags: AwsResourceTags = {};

  /**
   * Simplified constructor that only requires the application name
   * @param appName Name of the application
   * @param stage Deployment environment (default: 'dev')
   * @param props Additional Stack properties (optional)
   */
  constructor(
    appName: string, 
    stage?: string, 
    props?: cdk.StackProps
  ) {
    const app = new cdk.App();
    const actualStage = stage || process.env.STAGE || "";

    const stackId =
      actualStage.length > 0 ? `${appName}-${actualStage}` : appName;

    super(app, stackId, props);

    this.app = app;
    this.stage = actualStage;

    process.on("beforeExit", () => {
      this.synth();
    });
  }

  /**
   * Get the current stack tags
   * @returns The current stack tags
   */
  public getStackTags(): AwsResourceTags {
    return { ...this.stackTags };
  }

  /**
   * Get the current resource tags
   * @returns The current resource tags
   */
  public getResourceTags(): AwsResourceTags {
    return { ...this.resourceTags };
  }

  /**
   * Add tags to the stack
   * @param tags Tags to add
   */
  public addStackTags(tags: AwsResourceTags): void {
    this.stackTags = { ...this.stackTags, ...tags };
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }

  /**
   * Add tags to all resources
   * @param tags Tags to add
   */
  public addResourceTags(tags: AwsResourceTags): void {
    this.resourceTags = { ...this.resourceTags, ...tags };
  }

  /**
   * Creates a new LambdaBuilder instance to configure a Lambda function
   * @param handler Path to the Lambda function handler file
   * @returns LambdaBuilder instance for fluent configuration
   */
  public lambda(handler: string): LambdaBuilder {
    const lambdaBuilder = new LambdaBuilder({
      scope: this,
      handler,
    });

    return lambdaBuilder;
  }

  /**
   * Returns the shared API Gateway, if one has been created
   * @returns The shared ApiBuilder instance or undefined if none exists
   */
  public getSharedApi() {
    return LambdaBuilder.getSharedApi();
  }

  /**
   * Synthesizes the CDK application
   */
  public synth() {
    this.app.synth();
  }

  /**
   * Returns the stack
   * @returns The stack
   */
  public getStack() {
    return this;
  }
}
