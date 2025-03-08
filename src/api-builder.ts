import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';

export interface ApiBuilderProps {
  scope: Construct;
  id: string;
  apiName?: string;
  description?: string;
  stageName?: string;
  useDefaultCors?: boolean;
  binaryMediaTypes?: string[];
  disableExecuteApiEndpoint?: boolean;
}

export interface RouteOptions {
  authorizer?: apigatewayv2.IHttpRouteAuthorizer;
  authorizationScopes?: string[];
  [key: string]: any;
}

export class ApiBuilder {
  private api: apigatewayv2.HttpApi;
  private scope: Construct;
  private stageName: string;
  private routes: Map<string, string> = new Map();

  constructor(props: ApiBuilderProps) {
    this.scope = props.scope;
    this.stageName = props.stageName || 'default';
    
    // Configuración de la API
    let apiConfig: apigatewayv2.HttpApiProps = {
      apiName: props.apiName || `${props.id}-api`,
      description: props.description || 'API created with ApiBuilder',
      disableExecuteApiEndpoint: props.disableExecuteApiEndpoint
    };
    
    // Añadir CORS solo si useDefaultCors no es false explícitamente
    if (props.useDefaultCors !== false) {
      // Crear una nueva configuración que incluya CORS
      apiConfig = {
        ...apiConfig,
        corsPreflight: {
          allowOrigins: ['*'],
          allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
          allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key']
        }
      };
    }
    
    // Crear la API con las propiedades configuradas
    this.api = new apigatewayv2.HttpApi(props.scope, props.id, apiConfig);
  }

  /**
   * Adds a route to the API
   * @param path Path to add
   * @param lambda Lambda function that will handle the route
   * @param method HTTP method (GET, POST, PUT, DELETE)
   * @param options Additional options for the route
   */
  public addRoute(
    path: string, 
    lambda: lambda.Function, 
    method: string,
    options?: RouteOptions
  ): ApiBuilder {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    let httpMethod: apigatewayv2.HttpMethod;
    switch (method.toUpperCase()) {
      case 'GET':
        httpMethod = apigatewayv2.HttpMethod.GET;
        break;
      case 'POST':
        httpMethod = apigatewayv2.HttpMethod.POST;
        break;
      case 'PUT':
        httpMethod = apigatewayv2.HttpMethod.PUT;
        break;
      case 'DELETE':
        httpMethod = apigatewayv2.HttpMethod.DELETE;
        break;
      case 'PATCH':
        httpMethod = apigatewayv2.HttpMethod.PATCH;
        break;
      case 'OPTIONS':
        httpMethod = apigatewayv2.HttpMethod.OPTIONS;
        break;
      case 'HEAD':
        httpMethod = apigatewayv2.HttpMethod.HEAD;
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
    
    // Generar un ID estable para la integración que no contenga tokens
    const integrationId = `${path.replace(/\//g, '-')}-${method.toLowerCase()}-integration`;
    
    const integration = new apigatewayv2_integrations.HttpLambdaIntegration(
      integrationId,
      lambda
    );
    
    const routeConfig: apigatewayv2.AddRoutesOptions = {
      path: normalizedPath,
      methods: [httpMethod],
      integration: integration,
      ...(options?.authorizer && { authorizer: options.authorizer }),
    };
    
    const routes = this.api.addRoutes(routeConfig);
    const route = routes[0];
    
    this.routes.set(normalizedPath, route.routeId);
    
    return this;
  }

  /**
   * Returns the API instance
   * @returns The API Gateway HttpApi instance
   */
  public getApi(): apigatewayv2.HttpApi {
    return this.api;
  }

  /**
   * Returns the base URL of the API
   * @returns The base URL of the API
   */
  public getApiUrl(): string {
    return this.api.apiEndpoint;
  }

  /**
   * Returns the full URL for a specific endpoint
   * @param path Path of the endpoint
   * @param stage Optional stage name
   * @returns The full URL for the specified endpoint
   */
  public getEndpoint(path: string, stage?: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const stagePath = stage || this.stageName;
    return `${this.api.apiEndpoint}/${stagePath}${normalizedPath}`;
  }
} 