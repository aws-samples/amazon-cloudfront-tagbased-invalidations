## Tag based Invalidations in Amazon CloudFront

This is a reference implementation on how you could implement tag-based invalidations in CloudFront using CDK.

## Architecture

### Tag Ingest Workflow

![Tag Ingest Workflow](/images/tag-ingest-workflow.jpeg)

### Tag Purge Workflow

![Tag Purge Workflow](/images/tag-purge-workflow.jpeg)

## Pre-requisites

1. Install [CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html)
1. Install [NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)

## Steps to build

1. Clone this repository and change into `cdk` directory.
1. Set below environment variables in env.sh
```
# Required: set the AWS CLI profile name
export AWS_PROFILE="default"
# Optional: set the SNS topic name
export TOPIC_NAME='tag-ingest-topic'
# Required: set the AWS region where the primary deployment of solution resides.
export PRIMARY_AWS_REGION='us-west-1'
# Required: Specify delimiter when multiple tags are passed, possible values ',' or ' ' (space)
export TAG_DELIMITER=','
# Required: Specify the response header name where tags are present
export TAG_NAME='Edge-Cache-Tag'
# Optional: Specify how to determine the TTL of the Tag reocord in DynamoDB.
# whether to use Cache-Control header max-age or take the TTL specified as part of the tag
# leave it empty if you do not want to set a TTL 
# possible values 'Tag' or 'Cache-Control' or ''
export TAG_TTL_DEFINED_BY='Cache-Control'
# deploy a sample application that consists of CloudFront + Lambda Function as origin
export SAMPLE_APP_SETUP='True'
```
3. Run ./deploy.sh


## Pricing Calculations

|Assumptions/Parameters|---|

| ***Traffic***    | --- |
| CloudFront requests per month | 100,000,000            |
| Cache Hit Ratio               | 80%                    |
| Origin requests per month     | 20,000,000             |

| ***Tag volume***      | ---|
| Tags per URL                  | 3                      |
| Tag invalidations per month   | 1000                   |
| URLs per cache tag            | 20                     |

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
