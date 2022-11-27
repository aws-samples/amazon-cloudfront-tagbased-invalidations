import * as cdk from 'aws-cdk-lib';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as util from "util";
import { CfnStateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import fs = require('fs');

export interface CloudFrontTagBasedInvalidationProps extends StackProps {
  profile?: string;
  primaryRegion?: string;
  tagInvalidationStackName?: string;
  topicName?: string;
  sampleAppSetup?: boolean;
  tagTTLDefinedBy?: string;
  tagDemiliter?: string;
  tagName?: string;
}

export class CloudFrontTagBasedInvalidationStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: CloudFrontTagBasedInvalidationProps) {
    super(scope, id, props);
    let prefix = 'Primary';

    let ingestQueueDLQ = new sqs.Queue(this,
      util.format("%s%s", prefix, "IngestQueueDLQ"), {
      retentionPeriod: Duration.seconds(1209600),
    });

    let ingestQueue = new sqs.Queue(this,
      util.format("%s%s", prefix, "IngestQueue"), {
      visibilityTimeout: Duration.seconds(60),
      retentionPeriod: Duration.seconds(1209600),
      deadLetterQueue: {
        queue: ingestQueueDLQ,
        maxReceiveCount: 10
      }
    });

    // 👇 Create IAM Permission Policy for TagIngestFunction
    const tagIngestFunctionPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [`arn:aws:dynamodb:${Stack.of(this).region}:${Stack.of(this).account}:table/${Stack.of(this).stackName}*`],
          actions: [
            'dynamodb:UpdateItem',
            'dynamodb:CreateTable',
            'dynamodb:DescribeTable',
            'dynamodb:DescribeTimeToLive',
            'dynamodb:UpdateTimeToLive'
          ],
        }),
        new iam.PolicyStatement({
          resources: ['*'],
          actions: ['iam:PassRole'],
          conditions: {
            "StringEquals": {
              "iam:PassedToService": "lambda.amazonaws.com"
            }
          }
        }),
      ],
    });

    // 👇 Create IAM Permission Role for TagIngestFunction
    let tagIngestFunctionRole = new iam.Role(this, util.format("%s%s", prefix, "IngestFunctionRole"), {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        customPolicy: tagIngestFunctionPolicy,
      },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),]
    });

    // Allow SNS topic to send messages to the SQS Queue
    let sqsPolicy1 = new iam.PolicyStatement({ // Restrict to SendMessage
      principals: [new iam.AnyPrincipal()],
      actions: ['SQS:SendMessage'],
      resources: [ingestQueue.queueArn],
      conditions: {
        'ArnLike': {
          'aws:SourceArn': `arn:aws:sns:*:${Stack.of(this).account}:${util.format("%s-%s", Stack.of(this).stackName, props?.topicName)}`,
        },
      },
    });

    // Allow SNS topic to send messages to the SQS Queue
    let sqsPolicy2 = new iam.PolicyStatement({ // Restrict to SendMessage
      principals: [new iam.ArnPrincipal(tagIngestFunctionRole.roleArn)],
      actions: [
        "SQS:ChangeMessageVisibility",
        "SQS:DeleteMessage",
        "SQS:ReceiveMessage",
      ],
      resources: [ingestQueue.queueArn],
    });

    ingestQueue.addToResourcePolicy(sqsPolicy1);
    ingestQueue.addToResourcePolicy(sqsPolicy2);

    let tagIngestFunction = new lambda.Function(this, util.format("%s%s", prefix, "IngestFunction"), {
      runtime: lambda.Runtime.PYTHON_3_9,
      memorySize: 254,
      role: tagIngestFunctionRole,
      timeout: cdk.Duration.seconds(60),
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/lambda-functions/tag-ingest/')),
      environment: {
        PROCESS_RECORD_COUNT: cdk.numberToCloudFormation("10"),
        SQS_QUEUE_URL: ingestQueue.queueUrl,
        TABLE_PREFIX: Stack.of(this).stackName,
        TAG_DELIMITER: props.tagDemiliter!,
        TAG_TTL_DEFINED_BY: props.tagTTLDefinedBy!,
      },
    });

    ingestQueue.grantConsumeMessages(tagIngestFunction);
    ingestQueue.grantPurge(tagIngestFunction);
    ingestQueue.grantSendMessages(tagIngestFunction);

    new Rule(this, util.format("%s%s", prefix, "IngestScheduler"), {
      schedule: Schedule.rate(cdk.Duration.minutes(1)),
      targets: [new targets.LambdaFunction(tagIngestFunction)],
    });

    // store the Ingest Queue ARN into SSM
    let parameterName = util.format("/%s/%s/%s",
      Stack.of(this).stackName,
      Stack.of(this).region,
      "ingestQueueArn");

    new ssm.StringParameter(this, util.format("%s%s", prefix, "IngestQueueSSM"), {
      parameterName,
      stringValue: ingestQueue.queueArn,
    });

    // // store the Ingest Queue ARN into SSM
    // let parameterName1 = util.format("/%s/%s/%s",
    //   Stack.of(this).stackName,
    //   Stack.of(this).region,
    //   "ingestQueueDLQArn");

    // new ssm.StringParameter(this, 'PurgerQueueSSM', {
    //   parameterName: parameterName1,
    //   stringValue: ingestQueueDLQ.queueArn,
    // });

    let purgeQueueDLQ = new sqs.Queue(this, util.format("%s%s", prefix, "PurgeQueueDLQ"), {
      retentionPeriod: Duration.seconds(1209600),
    });

    let purgeQueue = new sqs.Queue(this, util.format("%s%s", prefix, "PurgeQueue"), {
      visibilityTimeout: Duration.seconds(60),
      retentionPeriod: Duration.seconds(1209600),
      deadLetterQueue: {
        queue: purgeQueueDLQ,
        maxReceiveCount: 10
      }
    });

    // 👇 Create IAM Permission Policy for TagPurgerFunction
    const tagPurgerFunctionPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [purgeQueue.queueArn],
          actions: [
            'sqs:DeleteMessage',
            'sqs:ReceiveMessage',
            'sqs:GetQueueAttributes'
          ],
        }),
        new iam.PolicyStatement({
          resources: [`arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter/*`],
          actions: [
            'ssm:PutParameter',
            'ssm:DeleteParameter',
            'ssm:GetParameterHistory',
            'ssm:GetParametersByPath',
            'ssm:GetParameters',
            'ssm:DeleteParameters'
          ],
        }),
        new iam.PolicyStatement({
          resources: [`arn:aws:cloudfront::${Stack.of(this).account}:distribution/*`],
          actions: ['cloudfront:ListInvalidations',
            'cloudfront:GetInvalidation',
            'cloudfront:CreateInvalidation'
          ],
        }),
        new iam.PolicyStatement({
          resources: ['*'],
          actions: ['iam:PassRole'],
          conditions: {
            "StringEquals": {
              "iam:PassedToService": "lambda.amazonaws.com"
            }
          }
        }),
      ],
    });

    // 👇 Create IAM Permission Role for TagIngestFunction
    let tagPurgerFunctionRole = new iam.Role(this, util.format("%s%s", prefix, "PurgerFunctionRole"), {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        customPolicy: tagPurgerFunctionPolicy,
      },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),]
    });

    let tagPurgerFunction = new lambda.Function(this, util.format("%s%s", prefix, "PurgerFunction"), {
      runtime: lambda.Runtime.PYTHON_3_9,
      memorySize: 254,
      role: tagPurgerFunctionRole,
      timeout: cdk.Duration.seconds(60),
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/lambda-functions/tag-purger/')),
      environment: {
        PROCESS_RECORD_COUNT: cdk.numberToCloudFormation("10"),
        INVALIDATION_THRESHOLD: cdk.numberToCloudFormation("1000"),
        SQS_QUEUE_URL: purgeQueue.queueUrl,
        PURGER_ACTIVE_PARAMETER_NAME: 'purger_lambda',
        STACK_NAME: Stack.of(this).stackName,
      },
    });

    new Rule(this, util.format("%s%s", prefix, "PurgerScheduler"), {
      schedule: Schedule.rate(cdk.Duration.minutes(2)),
      targets: [new targets.LambdaFunction(tagPurgerFunction)],
    });

    // 👇 Create IAM Permission Policy for TagIngestFunction
    const stateFunctionPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [`arn:aws:dynamodb:${Stack.of(this).region}:${Stack.of(this).account}:table/${Stack.of(this).stackName}*`],
          actions: [
            'dynamodb:Query',
          ],
        }),
        new iam.PolicyStatement({
          resources: [purgeQueue.queueArn],
          actions: ['sqs:SendMessage'],
        }),
        new iam.PolicyStatement({
          resources: [tagPurgerFunction.functionArn],
          actions: ['lambda:InvokeFunction'],
        }),
      ],
    });

    // 👇 Create IAM Permission Role for TagIngestFunction
    let stateFunctionRole = new iam.Role(this, util.format("%s%s", prefix, "PurgeWorkflowRole"), {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
      inlinePolicies: {
        customPolicy: stateFunctionPolicy,
      },
    });

    // Allow SNS topic to send messages to the SQS Queue
    let purgeQueuePolicy = new iam.PolicyStatement({ // Restrict to Send Message
      principals: [new iam.ArnPrincipal(stateFunctionRole.roleArn)],
      actions: ['SQS:SendMessage'],
      resources: [purgeQueue.queueArn],
      conditions: {
        'ArnLike': {
          'aws:SourceArn': `arn:aws:sns:*:${Stack.of(this).account}:${util.format("%s-%s", props?.tagInvalidationStackName, props?.topicName)}`,
        },
      },
    });
    purgeQueue.addToResourcePolicy(purgeQueuePolicy);

    let stepFunctionDefinition = fs.readFileSync(path.join(__dirname, './stepfunction.json'), "utf8");
    stepFunctionDefinition = stepFunctionDefinition.replace("${StackName}", Stack.of(this).stackName);
    stepFunctionDefinition = stepFunctionDefinition.replace("${TagPurgeQueue}", purgeQueue.queueUrl);
    stepFunctionDefinition = stepFunctionDefinition.replace("${TagPurgerFunctionArn}", tagPurgerFunction.functionArn);

    let tagPurgeWorkflow = new CfnStateMachine(this, util.format("%s%s", prefix, "PurgeWorkflow"), {
      definitionString: stepFunctionDefinition,
      stateMachineName: util.format("%s%s", Stack.of(this).stackName, "PurgeWorkflow"),
      roleArn: stateFunctionRole.roleArn
    });
  }
}