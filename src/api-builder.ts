import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayv2_integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { ApiBuilderProps, Route } from "./interfaces/api/api-interfaces";

export class ApiBuilder {
  private api: apigatewayv2.HttpApi;
  private stageName: string;
  private routes: Map<string, string> = new Map();

  constructor(props: ApiBuilderProps) {
    this.stageName = props.stageName || "default";

    let apiConfig: apigatewayv2.HttpApiProps = {
      apiName: props.apiName || `${props.id}-api`,
      description: props.description || "API created with ApiBuilder",
      disableExecuteApiEndpoint: props.disableExecuteApiEndpoint,
    };

    if (props.useDefaultCors !== false) {
      apiConfig = {
        ...apiConfig,
        corsPreflight: {
          allowOrigins: ["*"],
          allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
          allowHeaders: ["Content-Type", "Authorization", "X-Api-Key"],
        },
      };
    }

    this.api = new apigatewayv2.HttpApi(props.scope, props.id, apiConfig);
  }

  /**
   * Adds a route to the API
   * @param path Path to add
   * @param resourceName Name of the resource
   * @param lambda Lambda function that will handle the route
   * @param method HTTP method (GET, POST, PUT, DELETE, PATCH)
   * @param options Additional options for the route
   */
  public addRoute({
    path,
    resourceName,
    lambda,
    method,
    options,
  }: Route): ApiBuilder {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    let httpMethod: apigatewayv2.HttpMethod;
    switch (method.toUpperCase()) {
      case "GET":
        httpMethod = apigatewayv2.HttpMethod.GET;
        break;
      case "POST":
        httpMethod = apigatewayv2.HttpMethod.POST;
        break;
      case "PUT":
        httpMethod = apigatewayv2.HttpMethod.PUT;
        break;
      case "DELETE":
        httpMethod = apigatewayv2.HttpMethod.DELETE;
        break;
      case "PATCH":
        httpMethod = apigatewayv2.HttpMethod.PATCH;
        break;
      case "OPTIONS":
        httpMethod = apigatewayv2.HttpMethod.OPTIONS;
        break;
      case "HEAD":
        httpMethod = apigatewayv2.HttpMethod.HEAD;
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }

    const integrationId = `${method}-${resourceName}-integration`;

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
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const stagePath = stage || this.stageName;
    return `${this.api.apiEndpoint}/${stagePath}${normalizedPath}`;
  }
}
