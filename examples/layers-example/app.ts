import { CdkLess } from 'cdkless';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';

// Create the CDKless application
const app = new CdkLess('layers-example');

// Configure shared layer that will be automatically added to ALL Lambda functions
// This layer contains common utilities like logging, response formatting, and validation
app.setSharedLayer('./layers/common-utilities', {
  description: 'Common utilities and dependencies used across all Lambda functions',
  compatibleRuntimes: [
    lambda.Runtime.NODEJS_18_X,
    lambda.Runtime.NODEJS_20_X,
    lambda.Runtime.NODEJS_22_X
  ],
  layerVersionName: 'common-utilities-layer'
});

// Get an existing layer for different purposes
const databaseLayer = lambda.LayerVersion.fromLayerVersionArn(
  app,
  "DatabaseHandlerLayer",
  "arn:aws:lambda:us-east-1:3123213123:layer:mysql-layer"
);

// Create specialized layers for specific functionality
const imageProcessingLayer = new lambda.LayerVersion(app, 'image-processing-layer', {
  code: lambda.Code.fromAsset('./layers/image-processing'),
  description: 'Image processing and manipulation utilities',
  compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
  layerVersionName: 'image-processing-layer'
});

// User Management Functions
// These functions need database access, so they get the shared layer + database layer

app.lambda('src/handlers/users/get-user')
  .name('layers-example-get-user')
  .get('/users/:id')
  .addLayers([databaseLayer])
  .environment({
    TABLE_NAME: 'users-table',
    LOG_LEVEL: 'INFO'
  });

// This function needs both database AND image processing capabilities
app.lambda('src/handlers/users/upload-avatar')
  .name('layers-example-upload-avatar')
  .post('/users/:id/avatar')
  .addLayers([databaseLayer, imageProcessingLayer])
  .environment({
    TABLE_NAME: 'users-table',
    BUCKET_NAME: 'avatars-bucket',
    MAX_FILE_SIZE: '5MB',
    LOG_LEVEL: 'INFO'
  })
  .memory(512) // More memory for image processing
  .timeout(Duration.seconds(30));
