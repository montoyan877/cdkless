/**
 * Interface for terminal display of deployment results
 */
export interface DeploymentOutput {
  /** General resource summary */
  summary: {
    stackName: string;
    stage: string;
    lambdaCount: number;
    apiEndpoints: number;
    snsTopics: number;
    sqsQueues: number;
    s3Buckets: number;
  };
  /** API Gateway information (if exists) */
  api: {
    url: string;
  } | null;
  /** List of deployed Lambda functions with their details */
  lambdas: Array<{
    name: string;
    memory: number | string;
    timeout: number | string;
    environment: Record<string, string>;
    triggers: Array<{
      type: string;
      method?: string;
      path?: string;
      name?: string;
    }>;
  }>;
} 