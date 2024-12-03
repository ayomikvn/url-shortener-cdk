import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class UrlShortenerLambdaLayerStack extends cdk.Stack {
    public readonly urlShortenerFunctionLayerArn: string;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const UrlShortenerFunctionLayer = new lambda.LayerVersion(this, 'UrlShortenerFunctionLayer', {
            description: "Layer contains URL validation dependency",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            code: lambda.Code.fromAsset('lib/layer-contents'),
            compatibleArchitectures: [lambda.Architecture.X86_64, lambda.Architecture.ARM_64],
        });

        this.urlShortenerFunctionLayerArn = UrlShortenerFunctionLayer.layerVersionArn;

        // Stack Output
        new cdk.CfnOutput(this, 'UrlShortenerFunctionLayerArnOutput', {
            value: this.urlShortenerFunctionLayerArn,
            exportName: 'UrlShortenerFunctionLayerArn',
        });
    }
}