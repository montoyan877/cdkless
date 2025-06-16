import { StackProps } from "aws-cdk-lib";
import { IStackSettings } from "../stack";

export interface CdkLessOptions {
  /**
   * Name of the application
   */
  appName: string;

  /**
   * Stack settings for bundling and TypeScript configuration
   * @default defaultSettings
   */
  settings?: IStackSettings;

  /**
   * Additional AWS CDK stack properties
   */
  stackProps?: StackProps;

  /**
   * Deployment environment
   * @default process.env.STAGE || ""
   */
  stage?: string;
}