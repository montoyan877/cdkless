import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaBuilder } from './lambda-builder';
import { execSync } from 'child_process';
import * as chalk from 'chalk';
import { displayDeploymentSummary } from './utils/terminal-formatter';

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
    // Automatically create App instance
    const app = new cdk.App();
    const actualStage = stage || process.env.STAGE || 'dev';
    
    // Build stack ID using app name and stage
    const stackId = `${appName}-${actualStage}`;
    
    // Call the cdk.Stack constructor
    super(app, stackId, props);
    
    // Store references
    this.app = app;
    this.stage = actualStage;
    
    // Register a hook to automatically synthesize when the process ends
    process.on('beforeExit', () => {
      this.synth();
      this.showDeploymentInfo();
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
      handler
    });
    
    return lambdaBuilder;
  }

  /**
   * Returns the shared API Gateway, if one has been created
   * @returns The shared ApiBuilder instance or undefined if none exists
   */
  public getSharedApi() {
    return LambdaBuilder.getSharedApi(this);
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

  /**
   * Shows detailed information about the deployment
   * This function is called automatically after synthesis
   * to provide a clear view of deployed resources
   */
  private showDeploymentInfo() {
    try {
      console.log(chalk.cyan('\n🔍 Retrieving deployment information...\n'));
      
      // Get the stack name
      const stackName = this.stackName;
      
      // Try to get the information from CloudFormation output
      const result = execSync(
        `aws cloudformation describe-stacks --stack-name ${stackName} --query "Stacks[0].Outputs[?Description==\`COMPLETE_DEPLOYMENT_INFO\`].Value" --output text`,
        { encoding: 'utf-8' }
      );
      
      if (result && result.trim()) {
        // Show the formatted information
        displayDeploymentSummary(result.trim());
      } else {
        console.log(chalk.yellow('⚠️ No detailed deployment information found.'));
        console.log(chalk.yellow('This may be because the stack has not been deployed to AWS yet.'));
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️ Could not retrieve detailed deployment information.'));
      console.log(chalk.yellow('Run the deployment with: cdk deploy'));
    }
  }
} 