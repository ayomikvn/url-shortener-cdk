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
      partitionKey: { name: 'short-url-id', type: dynamodb.AttributeType.STRING },
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

    const urlShortenerFunction = new lambda.Function(this, 'UrlShortenerFunction', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset('lib/lambda'),
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

    // API GATEWAY REST API RESOURCES
    const UrlShortenerApiAccessLogsLogGroup = new logs.LogGroup(this, "UrlShortenerApiAccessLogs", {
      retention: logs.RetentionDays.ONE_DAY,
    });

    const urlShortenerApi = new apigateway.LambdaRestApi(this, 'UrlShortenerApi', {
      handler: urlShortenerFunction,
      proxy: false,
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(UrlShortenerApiAccessLogsLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields()
      }
    });
        
    // User makes GET request, passing in original URL to be shortened
    urlShortenerApi.root.addMethod('GET');

    // User makes GET {short-url-id} request to get redirected to original destination
    const shortUrlIdResource = urlShortenerApi.root.addResource('{short-url-id}');
    shortUrlIdResource.addMethod('GET');
  }
}
