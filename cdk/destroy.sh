#!/usr/bin/env bash

export AWS_PROFILE="default"
export TOPIC_NAME='tag-ingest-topic'
export PRIMARY_AWS_REGION=('us-west-1' )
export BACKEND_ENDPOINT='https://post-tag-alb-457863598.us-east-1.elb.amazonaws.com/'
REC_DEPLOY_AWS_REGIONS=('us-east-1' 'us-east-2' 'us-west-2' 'ap-south-1' 
'ap-northeast-1' 'ap-northeast-2' 'ap-southeast-1' 'ap-southeast-2' 'eu-west-1' 
'eu-west-2' 'eu-central-1' 'sa-east-1')
REC_DEPLOY_AWS_REGIONS=('us-east-1' 'us-east-2' 'us-west-2' 'ap-south-1')
export SAMPLE_APP_SETUP='True'

# Deploy the stack in the primary AWS region
export CDK_DEPLOY_REGION=${PRIMARY_AWS_REGION}
npx cdk bootstrap --profile $AWS_PROFILE
npx cdk destroy CloudFrontTagBasedInvalidationStack --profile $AWS_PROFILE --require-approval never

for region in "${REC_DEPLOY_AWS_REGIONS[@]}"
do
  export CDK_DEPLOY_REGION=$region
  shift; shift
  npx cdk bootstrap --profile $AWS_PROFILE
  npx cdk destroy CloudFrontTagBasedInvalidationSNSTopicStack --profile $AWS_PROFILE --require-approval never 
done

# CloudFront and Lambda@Edge needs to be deployed in us-east-1 region
export CDK_DEPLOY_REGION=us-east-1
npx cdk bootstrap --profile $AWS_PROFILE
npx cdk destroy CloudFrontLambdaEdgeStack --profile $AWS_PROFILE --require-approval never 
