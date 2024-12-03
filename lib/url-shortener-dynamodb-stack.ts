import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class UrlShortenerDynamoDBStack extends cdk.Stack {
    public readonly urlShortenerDDBTableArn: string;

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

        this.urlShortenerDDBTableArn = urlShortenerDDBTable.tableArn;

        // Stack Output
        new cdk.CfnOutput(this, 'UrlShortenerDDBTableArnOutput', {
            value: this.urlShortenerDDBTableArn,
            exportName: 'UrlShortenerDDBTableArn',
        });
    }
}