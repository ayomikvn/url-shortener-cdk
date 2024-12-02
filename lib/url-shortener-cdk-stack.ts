import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';

export class UrlShortenerCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DYNAMODB RESOURCE
    const urlShortenerDDBTable = new dynamodb.TableV2(this, 'UrlShortenerTable', {
      partitionKey: { name: 'shortUrlId', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand({
        maxReadRequestUnits: 100,
        maxWriteRequestUnits: 100,
      }),
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // LAMBDA RESOURCES
    const urlShortenerFunctionRole = new iam.Role(this, 'UrlShortenerFunctionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    const UrlShortenerFunctionLayer = new lambda.LayerVersion(this, 'UrlShortenerFunctionLayer', {
      description: "Layer contains URL validation dependency",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      code: lambda.Code.fromAsset('lib/layer-contents'),
      compatibleArchitectures: [lambda.Architecture.X86_64, lambda.Architecture.ARM_64],
    });
    
    const urlShortenerFunction = new lambda.Function(this, 'UrlShortenerFunction', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset('lib/lambda'),
      role: urlShortenerFunctionRole,
      layers: [UrlShortenerFunctionLayer],
      environment: {
        'URL_SHORTENER_DDB_TABLE': urlShortenerDDBTable.tableArn
      }
    });

    urlShortenerFunctionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
    urlShortenerFunctionRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:PutItem',
        'dynamodb:GetItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:UpdateItem',
    ],
      resources: [ urlShortenerDDBTable.tableArn ],
    }));

    // API GATEWAY REST API RESOURCES
    const UrlShortenerApiAccessLogsLogGroup = new logs.LogGroup(this, "UrlShortenerApiAccessLogs", {
      retention: logs.RetentionDays.ONE_DAY,
    });

    const urlShortenerApi = new apigateway.LambdaRestApi(this, 'UrlShortenerApi', {
      handler: urlShortenerFunction,
      proxy: false,
      cloudWatchRole: true,
      cloudWatchRoleRemovalPolicy: cdk.RemovalPolicy.DESTROY,
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(UrlShortenerApiAccessLogsLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields()
      }
    });
        
    // User makes POST request, passing in original URL to be shortened
    urlShortenerApi.root.addMethod('POST');

    // User makes GET /{shortUrlId} request to get redirected to original destination
    const shortUrlIdResource = urlShortenerApi.root.addResource('{shortUrlId}');
    shortUrlIdResource.addMethod('GET');
  }
}
