import { StackProps } from "aws-cdk-lib";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { AwsCustomResource, AwsSdkCall } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

export interface SSMParameterConstructProps extends StackProps {
    parameterName: string;
    region: string;
}

export class SSMParameterConstruct extends AwsCustomResource {
    constructor(scope: Construct, name: string, props?: SSMParameterConstructProps) {

        const ssmAwsSdkCall: AwsSdkCall = {
            service: 'SSM',
            action: 'getParameter',
            parameters: {
                Name: props?.parameterName
            },
            region: props?.region,
            physicalResourceId: { id: Date.now().toString() } // Update physical id to always fetch the latest version
        };

        super(scope, name, {
            onUpdate: ssmAwsSdkCall, policy: {
                statements: [new PolicyStatement({
                    resources: ['*'],
                    actions: ['ssm:GetParameter'],
                    effect: Effect.ALLOW,
                }
                )]
            }
        });
    }

    public getParameterValue(): string {
        return this.getResponseField('Parameter.Value').toString();
    }
}