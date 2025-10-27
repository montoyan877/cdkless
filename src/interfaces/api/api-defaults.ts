import { CorsPreflightOptions } from "aws-cdk-lib/aws-apigatewayv2";

export interface DefaultApiOptions {
  /**
   * CORS configuration for the API Gateway.
   * If not provided, default CORS will be used (allow all origins).
   * Set to false to disable CORS entirely.
   * 
   * @default undefined (uses default CORS)
   */
  cors?: CorsPreflightOptions | false;
}
