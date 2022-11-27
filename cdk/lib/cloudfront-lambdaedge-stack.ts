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

        // oResFunction.addToRolePolicy(oResFunctionPolicy);

        if (props?.sampleAppSetup) {

            let cachePolicy = new cloudfront.CachePolicy(this, util.format("%s%s", prefix, "CachePolicy"), {
                queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList('sample'),
                enableAcceptEncodingBrotli: true,
                enableAcceptEncodingGzip: true,
                minTtl: Duration.seconds(0),
                maxTtl: Duration.seconds(31536000),
                defaultTtl: Duration.seconds(86400),
            });

            let functionCode = fs.readFileSync(path.join(__dirname, '../src/lambda-functions/backend-origin/index.js'), "utf8");
            functionCode = functionCode.replace("${TagFieldName}", props.tagName!);

            let backendFunction = new lambda.Function(this, util.format("%s%s", prefix, "BackendFunction"), {
                runtime: lambda.Runtime.NODEJS_18_X,
                memorySize: 128,
                timeout: Duration.seconds(10),
                handler: 'index.handler',
                code: new lambda.InlineCode(functionCode),
            });

            let functionURL = backendFunction.addFunctionUrl({
                authType: lambda.FunctionUrlAuthType.NONE,
                cors: {
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                    allowedMethods: [lambda.HttpMethod.GET]
                },
            });

            let httpOrigin = new origins.HttpOrigin(cdk.Fn.select(2, cdk.Fn.split("/", functionURL.url)));

            let distribution = new cloudfront.Distribution(this, util.format("%s%s", prefix, "CloudFront"), {
                defaultBehavior: {
                    origin: httpOrigin,
                    cachePolicy: cachePolicy,
                    edgeLambdas: [
                        {
                            functionVersion: oResFunction.currentVersion,
                            eventType: cloudfront.LambdaEdgeEventType.ORIGIN_RESPONSE,
                        }
                    ],
                },
                httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
                comment: util.format("%s_%s_%s", Stack.of(this).stackName, Stack.of(this).region, "Description"),
            });

            // 👇 export CloudFront distribution
            new CfnOutput(this, `${Stack.of(this).stackName} - Distribution`, {
                value: `https://${distribution.distributionDomainName}/`,
                description: 'CloudFront distribution',
            });
        }
    }
}