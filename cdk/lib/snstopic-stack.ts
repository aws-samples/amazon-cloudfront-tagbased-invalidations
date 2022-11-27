import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as util from "util";
import { CloudFrontTagBasedInvalidationProps } from './cdk-stack';
import { SSMParameterConstruct, SSMParameterConstructProps } from './SSMParameterConstruct';

export class CloudFrontTagBasedInvalidationSNSTopicStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: CloudFrontTagBasedInvalidationProps) {
        super(scope, id, props);
        let prefix = 'Regional';
        let topicName = util.format("%s-%s", props?.tagInvalidationStackName, props?.topicName);
        let topic = new sns.Topic(this,
            util.format("%s%s", prefix, 'Topic'), {
            topicName: topicName
        });

        let ingestQueueParam = util.format("/%s/%s/%s",
            props?.tagInvalidationStackName,
            props?.primaryRegion,
            "ingestQueueArn");

        let ingestQueueArnParam = new SSMParameterConstruct(this, util.format("%s%s", prefix, 'IngestQueueSSM'), {
            parameterName: ingestQueueParam,
            region: props?.primaryRegion,
        } as SSMParameterConstructProps);

        let queueDLQ = new sqs.Queue(this, util.format("%s%s", prefix, 'IngestTopicDLQ'), {
            retentionPeriod: cdk.Duration.seconds(1209600),
        });

        // Allow SNS topic to send messages to the SQS Queue
        let sqsPolicy1 = new iam.PolicyStatement({ // Restrict to SendMessage
            principals: [new iam.AnyPrincipal()],
            actions: ['SQS:SendMessage'],
            resources: [queueDLQ.queueArn],
            conditions: {
                'ArnLike': {
                    'aws:SourceArn': topic.topicArn,
                },
            },
        });

        queueDLQ.addToResourcePolicy(sqsPolicy1);

        new sns.Subscription(this, util.format("%s%s", prefix, 'Subscription'), {
            topic,
            endpoint: ingestQueueArnParam.getParameterValue(),
            protocol: sns.SubscriptionProtocol.SQS,
            deadLetterQueue: queueDLQ,
            // subscriptionRoleArn: "SAMPLE_ARN", //role with permissions to send messages to a firehose delivery stream
        });
    }
}