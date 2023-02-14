#!/usr/bin/env bash
source ./env.sh

# install the dependancies
npm install

# Deploy the stack in the Regional Edge Cache(REC) AWS region. As of 02/14/2023 we have 
# 13 RECs. update this variable if newer RECs are added and redeploy.
REC_DEPLOY_AWS_REGIONS=('us-east-1' 'us-east-2' 'us-west-2' 'ap-south-1' 
'ap-northeast-1' 'ap-northeast-2' 'ap-southeast-1' 'ap-southeast-2' 'eu-west-1' 
'eu-west-2' 'eu-central-1' 'sa-east-1')

REC_DEPLOY_AWS_REGIONS=('us-east-1' 'us-east-2')

# Deploy the stack in the primary AWS Region
export CDK_DEPLOY_REGION=$PRIMARY_AWS_REGION
npx cdk bootstrap --profile $AWS_PROFILE
npx cdk deploy TagInvalidationPrimaryStack1 --profile $AWS_PROFILE --require-approval never

# Deploy the stack in the Regional Edge Cache AWS Region
for region in "${REC_DEPLOY_AWS_REGIONS[@]}"
do
  export CDK_DEPLOY_REGION=$region
  npx cdk bootstrap --profile $AWS_PROFILE
  npx cdk deploy TagInvalidationRegionalStack1 --profile $AWS_PROFILE --require-approval never
done

# Lambda@Edge needs to be deployed in us-east-1 AWS Region
export CDK_DEPLOY_REGION='us-east-1'
npx cdk bootstrap --profile $AWS_PROFILE
npx cdk deploy TagInvalidationEdgeFunctionsStack1 --profile $AWS_PROFILE --require-approval never