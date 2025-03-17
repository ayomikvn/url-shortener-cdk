# URL Shortener CDK Back-end

<p align="center">
  <img src="https://github.com/ayomikvn/url-shortener-cdk/blob/main/url-shortener-architecture.png" alt="URL Shortener Architecture"/>
</p>

This is the REST API infrastructure back-end for a URL shortener, built with AWS CDK, in TypeScript. Amazon API Gateway handles the HTTP requests and forwards them to an AWS Lambda function for processing. The function performs CRUD operations on an Amazon DynamoDB database, where the original-short URL mappings are stored.

The `cdk.json` file tells the CDK Toolkit how to execute the app.

## How it works

### Short URL creation

A user sends a POST request to the REST API, on the base path, to shorten a URL. The request is forwarded to Lambda which checks to see if there is an existing valid entry in the DynamoDB database for the specified URL. If an entry exists, Lambda returns the value to the user via API Gateway. A valid entry is one where the `createdAt+timeToLiveInSeconds` is less than the current time in UTC. If there is no valid short URL, Lambda creates one, stores it in the database, and returns it to the user. Currently, `timeToLiveInSeconds` is 259200 seconds (3 days) by default and is not configurable.

### Using the short URL

A user sends a GET request, specifying the short URL as a path parameter like this `/{shortUrlId}`. This could be done by pasting the URL (`https://api-id.execute-api.region.amazonaws.com/{stage}/{shortUrlId}`, where stage could be `prod`, `dev` etc.) in the browser, or using client tools like *cURL* or *Postman*. The function then parses the URL for the string after the base URL. It checks that there is a value that exists for this short URL and responds to with a HTTP 301 redirect if there is a valid entry. If there is no valid value for that short URL, it tells the user that it is an invalid short URL or that it has expired, depending on if there is an unexpired database entry or not.

## Setup and deployment

### Prerequisites

1. [Install Node.js and npm](https://nodejs.org/en/download/package-manager) on your computer.
2. Install AWS CDK CLI globally.

```bash
npm install -g aws-cdk
```

3. An AWS account.

### Project Setup

1. Clone this repository.

```bash
git clone https://github.com/ayomikvn/url-shortener-cdk.git
cd url-shortener-cdk
```

2. Install dependencies.

```bash
npm install
```

### AWS Credentials Configuration

1. Login to your AWS console and create an AWS IAM User with programmatic access.
2. Attach an IAM policy to the user. The policy should contain necessary IAM permissions. Alternatively, you add the user to an IAM group that has required permissions.
3. In the AWS IAM console, create access keys for the user you created in step 1.
4. In your computer's terminal, configure AWS Credentials

```bash
# Option 1: AWS CLI Configuration
aws configure
# Enter Access Key ID
# Enter Secret Access Key
# Enter default region (e.g., us-east-1)
# Enter output format (json)

# Option 2: Environment Variables
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-east-1
```

### CDK Bootstrapping

1. In your computer terminal, bootstrap the AWS account and region.

```bash
# Bootstrap for the first time
cdk bootstrap aws://your-account-number/your-region

# If using multiple accounts/regions
cdk bootstrap aws://account-1/region-1 aws://account-2/region-2
```

### Project Deployment

1. Generate CloudFormation templates.

```bash
cdk synth
```

2. Deploy CDK stack.

```bash
# Deploy all stacks
cdk deploy --all

# Deploy specific stack
cdk deploy StackName

# Deploy with approval
cdk deploy --require-approval never
```

### Useful commands

```bash
# List all stacks in the application
cdk list

# Diff between deployed and current stack
cdk diff

# Destroy deployed resources
cdk destroy
```

## Troubleshooting

- Ensure AWS credentials have sufficient permissions.
- Check AWS CLI and CDK CLI versions.
- Verify network connectivity from your computer.
- Review CloudFormation events for deployment errors.
