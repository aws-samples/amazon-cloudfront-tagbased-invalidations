#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PrimaryStackProps, PrimaryStack } from '../lib/primary-stack';
import { LambdaEdgeStack } from '../lib/lambdaedge-stack';
import { RegionalStack } from '../lib/regional-stack';

const props = {
  terminationProtection: true,
  env: { account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION },
  profile: process.env.AWS_PROFILE!,
  topicName: process.env.TOPIC_NAME,
  primaryRegion: process.env.PRIMARY_AWS_REGION,
  tagTTLDefinedBy: process.env.TAG_TTL_DEFINED_BY,
  tagDemiliter: process.env.TAG_DELIMITER,
  tagName: process.env.TAG_NAME,
  tagTTLName: process.env.TAG_TTL_NAME,
  description: "Reference recipe to implement Tag based invalidation with Amazon CloudFront (1t9uc46o4)",
} as PrimaryStackProps;

const app = new cdk.App();
const primaryStack = new PrimaryStack(app, 'TagPrimaryStack', props);
const props1 = {
  ...props,
  tagInvalidationStackName: primaryStack.stackName,
}

new RegionalStack(app, 'TagRegionalStack', props1);

new LambdaEdgeStack(app, 'TagLambdaEdgeStack', props1);
