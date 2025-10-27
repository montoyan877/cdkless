import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

/**
 * Properties for creating an ApiBuilder
 */
export interface ApiBuilderProps {
  scope: Construct;
  id: string;
  apiName?: string;
  description?: string;
  stageName?: string;
  useDefaultCors?: boolean;
  corsConfig?: apigatewayv2.CorsPreflightOptions | false;
  binaryMediaTypes?: string[];
  disableExecuteApiEndpoint?: boolean;
}

export interface Route {
  path: string;
  resourceName: string;
  lambda: lambda.Function;
  method: string;
  options?: RouteOptions;
}

export interface RouteOptions {
  authorizer?: apigatewayv2.IHttpRouteAuthorizer;
  [key: string]: any;
}
