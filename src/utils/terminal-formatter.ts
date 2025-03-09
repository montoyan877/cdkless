import * as chalk from 'chalk';
import { DeploymentOutput } from '../interfaces/outputs/terminal';

/**
 * Formats and displays deployment information in the terminal
 * with improved visual structure and colors
 * 
 * This function is used internally by CDKless to display information
 * about the deployment in a clear and attractive way.
 */
export function displayDeploymentSummary(outputString: string): void {
  try {
    const outputs: DeploymentOutput = JSON.parse(outputString);
    const summary = outputs.summary;
    
    console.log(chalk.bold.green('==================================='));
    console.log(chalk.bold.green(`🚀 ${summary.stackName} - ${summary.stage} 🚀`));
    console.log(chalk.bold.green('==================================='));
    
    console.log(chalk.yellow('\n📊 Resource Summary:'));
    console.log(chalk.cyan(`  Lambdas: ${summary.lambdaCount}`));
    console.log(chalk.cyan(`  API Endpoints: ${summary.apiEndpoints}`));
    console.log(chalk.cyan(`  SNS Topics: ${summary.snsTopics}`));
    console.log(chalk.cyan(`  SQS Queues: ${summary.sqsQueues}`));
    console.log(chalk.cyan(`  S3 Buckets: ${summary.s3Buckets}`));
    
    if (outputs.api) {
      console.log(chalk.yellow('\n🌐 API Gateway:'));
      console.log(chalk.cyan(`  URL: ${outputs.api.url}`));
    }
    
    console.log(chalk.yellow('\n⚡ Lambda Functions:'));
    outputs.lambdas.forEach((lambda) => {
      console.log(chalk.cyan(`  • ${lambda.name}:`));
      console.log(chalk.cyan(`    Memory: ${lambda.memory} MB`));
      console.log(chalk.cyan(`    Timeout: ${lambda.timeout} sec`));
      
      if (Object.keys(lambda.environment).length > 0) {
        console.log(chalk.cyan('    Environment Variables:'));
        Object.entries(lambda.environment).forEach(([key, value]) => {
          console.log(chalk.green(`      → ${key}: ${value}`));
        });
      }
      
      if (lambda.triggers && lambda.triggers.length > 0) {
        console.log(chalk.cyan('    Triggers:'));
        lambda.triggers.forEach((trigger) => {
          if (trigger.type === 'API Gateway') {
            console.log(chalk.green(`      → ${trigger.method} ${trigger.path}`));
          } else {
            console.log(chalk.green(`      → ${trigger.type}: ${trigger.name}`));
          }
        });
      }
      console.log();
    });
    
    console.log(chalk.bold.green('==================================='));
    console.log(chalk.bold.green('Deployment completed successfully!'));
    console.log(chalk.bold.green('==================================='));
  } catch (error) {
    console.error('Error formatting output:', error);
    console.log(outputString); // Show original output in case of error
  }
} 