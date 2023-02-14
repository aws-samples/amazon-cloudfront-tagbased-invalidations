#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CloudFrontTagBasedInvalidationProps, CloudFrontTagBasedInvalidationStack } from '../lib/cdk-stack';
import { CloudFrontLambdaEdgeStack } from '../lib/cloudfront-lambdaedge-stack';
import { CloudFrontTagBasedInvalidationSNSTopicStack } from '../lib/snstopic-stack';

const props = {
  // terminationProtection: true,
  env: { account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION },
  profile: process.env.AWS_PROFILE!,
  topicName: process.env.TOPIC_NAME,
  primaryRegion: process.env.PRIMARY_AWS_REGION,
  tagTTLDefinedBy: process.env.TAG_TTL_DEFINED_BY,
  tagDemiliter: process.env.TAG_DELIMITER,
  tagName: process.env.TAG_NAME,
  tagTTLName: process.env.TAG_TTL_NAME,
  description: "Reference recipe to implement Tag based invalidation with Amazon CloudFront (1t9uc46o4)",
} as CloudFrontTagBasedInvalidationProps;

const app = new cdk.App();
const tagInvalidationStack = new CloudFrontTagBasedInvalidationStack(app, 'TagInvalidationPrimaryStack1', props);
const props1 = {
  ...props,
  tagInvalidationStackName: tagInvalidationStack.stackName,
}
const topicStack = new CloudFrontTagBasedInvalidationSNSTopicStack(app, 'TagInvalidationRegionalStack1', props1);

const cloudFrontLambdaEdgeStack = new CloudFrontLambdaEdgeStack(app, 'TagInvalidationEdgeFunctionsStack1', props1);
