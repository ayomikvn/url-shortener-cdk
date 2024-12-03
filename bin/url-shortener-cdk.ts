#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { UrlShortenerCdkStack } from '../lib/url-shortener-cdk-stack';
import { UrlShortenerDynamoDBStack } from '../lib/url-shortener-dynamodb-stack';
import { UrlShortenerLambdaLayerStack } from '../lib/url-shortener-lambda-layer-stack';

const app = new cdk.App();
const dynamodbStack = new UrlShortenerDynamoDBStack(app, 'UrlShortenerDynamoDBStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

const lambdaLayerStack = new UrlShortenerLambdaLayerStack(app, 'UrlShortenerLambdaLayerStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

new UrlShortenerCdkStack(app, 'UrlShortenerCdkStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  urlShortenerDDBTableArn: dynamodbStack.urlShortenerDDBTableArn,
  urlShortenerFunctionLayerArn: lambdaLayerStack.urlShortenerFunctionLayerArn,
});