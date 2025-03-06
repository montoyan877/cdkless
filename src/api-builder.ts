import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ApiBuilderProps {
  scope: Construct;
  id: string;
  apiName?: string;
  description?: string;
  deployOptions?: apigateway.StageOptions;
  defaultCorsPreflightOptions?: apigateway.CorsOptions;
}

export class ApiBuilder {
  private api: apigateway.RestApi;
  private scope: Construct;
  private routes: Map<string, apigateway.IResource> = new Map();

  constructor(props: ApiBuilderProps) {
    this.scope = props.scope;
    
    this.api = new apigateway.RestApi(props.scope, props.id, {
      restApiName: props.apiName || `${props.id}-api`,
      description: props.description || 'API created with ApiBuilder',
      deployOptions: props.deployOptions,
      defaultCorsPreflightOptions: props.defaultCorsPreflightOptions || {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key']
      }
    });
  }

  /**
   * Adds a route to the API
   * @param path Path to add
   * @param lambda Lambda function that will handle the route
   * @param method HTTP method (GET, POST, PUT, DELETE)
   * @param methodOptions Additional method options (authorizers, validations, etc.)
   */
  public addRoute(path: string, lambda: lambda.Function, method: string, methodOptions?: apigateway.MethodOptions): ApiBuilder {
    // Make sure the path doesn't start with /
    const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
    
    // Split the path into segments
    const segments = normalizedPath.split('/');
    
    // Start from the root
    let currentResource: apigateway.IResource = this.api.root;
    
    // Create each segment of the path
    let fullPath = '';
    for (const segment of segments) {
      if (!segment) continue; // Skip empty segments
      
      fullPath = fullPath ? `${fullPath}/${segment}` : segment;
      
      // Check if we already have this resource created
      if (this.routes.has(fullPath)) {
        currentResource = this.routes.get(fullPath)!;
      } else {
        // Create a new resource
        currentResource = currentResource.addResource(segment);
        this.routes.set(fullPath, currentResource);
      }
    }
    
    // Add the method to the route
    const integration = new apigateway.LambdaIntegration(lambda);
    
    // If method options are provided, use them
    if (methodOptions) {
      currentResource.addMethod(method, integration, methodOptions);
    } else {
      // Otherwise, use the default configuration
      currentResource.addMethod(method, integration);
    }
    
    return this;
  }

  /**
   * Adds an authorizer to the API
   * @param authorizerName Name of the authorizer
   * @param lambda Lambda function that will be used as authorizer
   * @returns The created request authorizer
   */
  public addAuthorizer(authorizerName: string, lambda: lambda.Function): apigateway.RequestAuthorizer {
    const authorizer = new apigateway.RequestAuthorizer(this.scope, `${authorizerName}Authorizer`, {
      handler: lambda,
      identitySources: [apigateway.IdentitySource.header('Authorization')],
    });
    
    return authorizer;
  }

  /**
   * Returns the API instance
   * @returns The API Gateway RestApi instance
   */
  public getApi(): apigateway.RestApi {
    return this.api;
  }

  /**
   * Returns the base URL of the API
   * @returns The base URL of the API
   */
  public getApiUrl(): string {
    return this.api.url;
  }

  /**
   * Returns the full URL for a specific endpoint
   * @param path Path of the endpoint
   * @param stage Optional stage name
   * @returns The full URL for the specified endpoint
   */
  public getEndpoint(path: string, stage?: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const stageUrl = stage ? `/${stage}` : '';
    return `${this.api.url}${stageUrl}${normalizedPath}`;
  }
} 