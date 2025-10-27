import * as cdk from "aws-cdk-lib";
import { LambdaBuilder } from "./lambda-builder";
import { AwsResourceTags } from "./interfaces/tags";
import { IStack, IStackSettings } from "./interfaces/stack";
import {
  Code,
  ILayerVersion,
  LayerVersion,
  LayerVersionProps,
} from "aws-cdk-lib/aws-lambda";
import path from "path";
import { CdkLessOptions } from "./interfaces/cdkless";

let sharedLayer: ILayerVersion;

let defaultSettings: IStackSettings = {
  bundleLambdasFromTypeScript: true,
  defaultBundlingOptions: {
    minify: false,
    sourceMap: false,
    externalModules: ["aws-sdk", "@aws-sdk/*", "/opt/*"],
  },
  defaultTags: {},
};

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
   * @param settings Default settings for CdkLess
   * @param props Additional Stack properties (optional)
   * @param stage Deployment environment (default: 'dev')
   */
  constructor({
    appName,
    settings = defaultSettings,
    stackProps,
    stage = process.env.STAGE || "",
  }: CdkLessOptions) {
    const app = new cdk.App();
    CdkLess.setDefaultSettings(settings);

    const stackId =
      stage.length > 0 ? `${appName}-${stage}` : appName;

    super(app, stackId, stackProps);

    this.app = app;
    this.stage = stage;

    // Initialize tags based on settings or default ProjectName
    if (settings.defaultTags) {
      // Use settings.defaultTags if provided
      this.stackTags = { ...settings.defaultTags };
      this.resourceTags = { ...settings.defaultTags };
    } else {
      // Use automatic ProjectName tag if no defaultTags provided
      this.stackTags = { ProjectName: stackId };
      this.resourceTags = { ProjectName: stackId };
    }

    process.on("beforeExit", () => {
      this.synth();
    });
  }

  /**
   * Set the default settings for the stack
   * @param settings Settings to set
   */
  static setDefaultSettings(settings: IStackSettings): void {
    defaultSettings = { ...defaultSettings, ...settings };
  }

  /**
   * Get the default settings for the stack
   * @returns The default settings
   */
  static getDefaultSettings(): IStackSettings {
    return defaultSettings;
  }

  /**
   * Set the shared layer for all Lambda functions
   * @param layerPath Path to the layer
   * @param options Layer options
   * @returns The shared layer
   */
  public setSharedLayer(
    layerPath: string,
    options?: Omit<LayerVersionProps, "code">
  ): ILayerVersion {
    if (sharedLayer) return sharedLayer;

    const appName = this.stackName.replace(`-${this.stage}`, "");
    const layerName =
      options?.layerVersionName || this.stage.length > 0
        ? `${appName}-layer-${this.stage}`
        : `${appName}-layer`;

    const code = Code.fromAsset(path.join(layerPath));
    if (!code) {
      throw "Shared layer not found";
    }

    const layer = new LayerVersion(this, layerName, {
      code,
      ...options,
    });

    console.log(`✅ Shared layer created: ${layerName}`);

    sharedLayer = layer;

    return layer;
  }

  /**
   * Get the shared layer
   * @returns The shared layer
   */
  static getSharedLayer(): ILayerVersion | undefined {
    return sharedLayer;
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

  public getScope() {
    return this.app;
  }
}
