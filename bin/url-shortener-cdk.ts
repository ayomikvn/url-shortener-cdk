#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { UrlShortenerCdkStack } from '../lib/url-shortener-cdk-stack';

const app = new cdk.App();
new UrlShortenerCdkStack(app, 'UrlShortenerCdkStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});