import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CloudFrontTagBasedInvalidationProps } from './cdk-stack';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Fn, Duration, Stack, CfnOutput } from 'aws-cdk-lib';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import * as path from 'path';
import * as util from "util";
import { ALBConstruct } from './ALBConstruct';
import fs = require('fs');
import * as iam from 'aws-cdk-lib/aws-iam';

export class CloudFrontLambdaEdgeStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: CloudFrontTagBasedInvalidationProps) {
        super(scope, id, props);
        let prefix = 'Global';
        let topicName = util.format("%s-%s", props?.tagInvalidationStackName, props?.topicName);

        let functionCode = fs.readFileSync(path.join(__dirname, '../src/lambda-functions/origin-response/index.js'), "utf8");
        functionCode = functionCode.replace("${ParentRegion}", props.primaryRegion!);
        functionCode = functionCode.replace("${TagFieldName}", props.tagName!.toLowerCase());
        functionCode = functionCode.replace("${TopicName}", topicName);
        functionCode = functionCode.replace("${AccountId}", Stack.of(this).account);
        functionCode = functionCode.replace("${ParentRegion}", props.primaryRegion!);
        functionCode = functionCode.replace("${TagTTLFieldName}", props.tagTTLName);

        // 👇 Create IAM Permission Policy for oResFunction
        let oResFunctionPolicyStmt = new iam.PolicyStatement({
            resources: [`arn:aws:sns:*:${Stack.of(this).account}:${topicName}`],
            actions: [
                'sns:Publish',
            ],
        });

        const oResFunctionPolicy = new iam.PolicyDocument({
            statements: [oResFunctionPolicyStmt]
        });

        // 👇 Create IAM Permission Role for oResFunction
        let oResFunctionRole = new iam.Role(this, util.format("%s%s", prefix, "oResFunctionRole"), {
            assumedBy: new iam.ServicePrincipal('edgelambda.amazonaws.com'),
            inlinePolicies: {
                customPolicy: oResFunctionPolicy,
            },
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                    'service-role/AWSLambdaBasicExecutionRole',
                ),]
        });

        let oResFunction = new cloudfront.experimental.EdgeFunction(this, util.format("%s%s", prefix, 'oResFunction'), {
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'index.handler',
            // role: oResFunctionRole,
            initialPolicy: [oResFunctionPolicyStmt],
            code: new lambda.InlineCode(functionCode),
        });

        new CfnOutput(this, 'OriginResponseLambda@Edge', {
            value: oResFunction.functionArn,
            description: "Lambda@Edge function that needs to associated to Origin Response on CloudFront behavior where tag based invalidation is required."
        });
        // oResFunction.addToRolePolicy(oResFunctionPolicy);
    }
}