import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as logs from "aws-cdk-lib/aws-logs";

interface UrlShortenerCdkStackProps extends cdk.StackProps {
  urlShortenerFunctionLayerArn: string;
  urlShortenerDDBTableArn: string;
}

export class UrlShortenerCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: UrlShortenerCdkStackProps) {
    super(scope, id, props);

    // Import the DynamoDB table
    const importedUrlShortenerDDBTable = dynamodb.TableV2.fromTableAttributes(
      this,
      "ImportedUrlShortenerDDBTable",
      {
        tableArn: props.urlShortenerDDBTableArn,
      }
    );

    // Import Lambda layer
    const importedUrlShortenerFunctionLayer =
      lambda.LayerVersion.fromLayerVersionArn(
        this,
        "ImportedUrlShortenerFunctionLayer",
        props.urlShortenerFunctionLayerArn
      );

    // LAMBDA RESOURCES
    const urlShortenerFunctionRole = new iam.Role(
      this,
      "UrlShortenerFunctionRole",
      {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      }
    );

    const urlShortenerFunction = new lambda.Function(
      this,
      "UrlShortenerFunction",
      {
        runtime: lambda.Runtime.PYTHON_3_13,
        handler: "lambda_function.lambda_handler",
        code: lambda.Code.fromAsset("lib/lambda"),
        role: urlShortenerFunctionRole,
        layers: [importedUrlShortenerFunctionLayer],
        environment: {
          URL_SHORTENER_DDB_TABLE: importedUrlShortenerDDBTable.tableArn,
        },
      }
    );

    urlShortenerFunctionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaBasicExecutionRole"
      )
    );
    urlShortenerFunctionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem",
        ],
        resources: [importedUrlShortenerDDBTable.tableArn],
      })
    );

    // API GATEWAY REST API RESOURCES
    const UrlShortenerApiAccessLogsLogGroup = new logs.LogGroup(
      this,
      "UrlShortenerApiAccessLogs",
      {
        retention: logs.RetentionDays.ONE_DAY,
      }
    );

    const urlShortenerApi = new apigateway.LambdaRestApi(
      this,
      "UrlShortenerApi",
      {
        handler: urlShortenerFunction,
        proxy: false,
        cloudWatchRole: true,
        cloudWatchRoleRemovalPolicy: cdk.RemovalPolicy.DESTROY,
        deployOptions: {
          accessLogDestination: new apigateway.LogGroupLogDestination(
            UrlShortenerApiAccessLogsLogGroup
          ),
          accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        },
      }
    );

    urlShortenerApi.root.addMethod("OPTIONS")

    // User makes POST request, passing in original URL to be shortened
    urlShortenerApi.root.addMethod("POST");

    // User makes GET /{shortUrlId} request to get redirected to original destination
    const shortUrlIdResource = urlShortenerApi.root.addResource("{shortUrlId}");
    shortUrlIdResource.addMethod("GET");
  }
}
