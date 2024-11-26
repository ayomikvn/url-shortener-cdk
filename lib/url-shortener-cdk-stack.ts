import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class UrlShortenerCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamDB resource
    const urlShortenerDDBTable = new dynamodb.TableV2(this, 'UrlShortenerTable', {
      partitionKey: { name: 'url-hash', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand({
        maxReadRequestUnits: 100,
        maxWriteRequestUnits: 100,
      }),
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Resources
    const urlShortenerFunctionRole = new iam.Role(this, 'UrlShortenerFunctionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    const urlShortenerFunction = new lambda.Function(this, 'UrlShortenerFunction', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset('lambda'),
      role: urlShortenerFunctionRole
    });

    urlShortenerFunctionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
    urlShortenerFunctionRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'dynamdob:PutItem',
        'dynamdob:GetItem',
        'dynamdob:Query',
        'dynamdob:Scan',
        'dynamdob:UpdateItem',
    ],
      resources: [ urlShortenerDDBTable.tableArn ],
    }));

    // API Gateway with Lambda backing
    const urlShortenerApi = new apigateway.LambdaRestApi(this, 'UrlShortenerApi', {
      handler: urlShortenerFunction,
      proxy: false,
    });
        
    // Define the '/hello' resource with a GET method
    const shortUrlResource = urlShortenerApi.root.addResource('short-url');
    shortUrlResource.addMethod('GET');
  }
}
