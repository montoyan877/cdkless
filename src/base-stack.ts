import * as cdk from "aws-cdk-lib";
import { LambdaBuilder } from "./lambda-builder";

/**
 * Base class that provides simplified methods
 * to interact with the CDK-less framework
 */
export class CdkLess extends cdk.Stack {
  private app: cdk.App;
  protected stage: string;

  /**
   * Simplified constructor that only requires the application name
   * @param appName Name of the application
   * @param stage Deployment environment (default: 'dev')
   * @param props Additional Stack properties (optional)
   */
  constructor(appName: string, stage?: string, props?: cdk.StackProps) {
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
