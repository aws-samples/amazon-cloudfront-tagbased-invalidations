import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as path from 'path';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import { KinesisEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as util from "util";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as albtargets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';

import { constants } from 'os';
export interface ALBConstructProps {
    lambdaFunction: lambda.Function;
}

export class ALBConstruct extends Construct {
    public readonly alb: elbv2.ApplicationLoadBalancer;

    constructor(scope: Construct, id: string, props: ALBConstructProps) {
        super(scope, id);
        let prefix = cdk.Stack.of(this).stackName.toLowerCase();

        const vpc1 = new ec2.Vpc(this, util.format("%s-%s", prefix, "VPC"), {
            natGateways: 0,
        });

        // Create the load balancer in a VPC. 'internetFacing' is 'false'
        // by default, which creates an internal load balancer.
        this.alb = new elbv2.ApplicationLoadBalancer(this, util.format("%s_%s", prefix, "ALB"), {
            vpc: vpc1,
            internetFacing: true,
        });

        let httpListener = this.alb.addListener('HTTPListener', { port: 80 });
        let lambdaTarget = new albtargets.LambdaTarget(props.lambdaFunction);
        httpListener.addTargets('HTTPTargets', {
            targets: [lambdaTarget],
        });
    }
}