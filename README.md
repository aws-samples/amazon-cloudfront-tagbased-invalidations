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

### Assumptions
| Assumption | Parameters |
| --- | --- |
| ***Traffic***  |  |
| CloudFront requests per month | 100,000,000  |
| Cache Hit Ratio | 80%  |
| Origin requests per month  | 20,000,000  |
| ***Tag volume***      |  |
| Tags per URL                  | 3                      |
| Tag invalidations per month   | 1000                   |
| URLs per cache tag            | 20                     |

### AWS Service wise calculations

| Lambda@Edge Pricing (compute+request)	| $27.00 |
| --- | --- |
| Number of invocations	| 20,000,000 |	
| Compute price per 128MB-second (USD) | $0.00000625125	|
| Function execution duration (ms)|	120ms |	
| Total compute seconds	| 2,400,000 GBsec |	
| Request cost per million Lambda@Edge invocations (USD) | $0.60 |
| ***Compute cost*** |	$15.00 |
| ***Request cost***	|	$12.00 |

| SNS Pricing |		$0.34 |
| --- | --- |
| Number of SNS requests |	20,000,000 |	
| Cost per million requests (USD) |	$0.00 (No charge for deliveries to SQS)|	
| Request cost (USD)	|	$0.00 |
| Payload size (Bytes)	| 200 |	
| Data transfer to SQS (GB)	| 3.725290298 |	
| Data transfer cost per GB (USD) |	$0.09 |	
| ***Total Data transfer cost (GB)***	| $0.34 |


| SQS Pricing |		$7.60 |
| --- | --- |
| Number of SQS requests |	20,000,000 |	
| Cost per million requests (USD) |	$0.40 (First million requests free per month)|	
| Data transfer cost to Lambda (GB)	 |	$0.00 |
| ***Request cost (USD)*** | 	$7.60 |

| DynamoDB Pricing |	$75.01 |
| --- | --- |
| Number of items in table	| 60,000,000	|
| Average size per item (Bytes)	| 400 Bytes |	
| Storage volume (GB) |	22.35174179	|
| Storage cost per GB (USD)	| $0.25 (First 25 GB free)|	
| Storage cost (USD)	|	$0.00 | 
| Number of writes	| 60,000,000 | 	
| Cost per million write request (USD) | $1.25000000 |	
| ***Write cost (USD)***	| 	$75.00 | 
| Number of reads	| 20,000 | 	
| Cost per read request (USD)	| $0.00000025| 	
| ***Read cost (USD)*** |		$0.01 | 

| EventBridge scheduler (Ingest+Purge)	|	$0.04 | 
| --- | --- |
| Custom events per month (Ingest/2 min interval) |	21600 |	
| Custom events per month (Purge/2min interval) |	21600 |
| Cost per million custom events (USD)	| $1.00 | 	
| Scheduler cost |		$0.04 |

| Ingest/Purge Lambda cost	|	$0.01 |
| --- | --- |
| Number of invocations (Ingest@2 min interval) |	21600 |	
| Avg  function  duration in ms (Ingest) | 1240 |	
| Number of invocations (Purge@2 min interval) |	21600 |	
| Avg  function  duration in ms (Purge)	| 701 |	
| Total GB-seconds (w/254MB function memory) |	10,402 |	
| Compute cost  per GB-second (USD)	| $0.0000166667	|
| Total compute cost (USD)	|	$0.00 |
| Request cost per million requests (USD) |	$0.20 |	
| Total request cost (USD)	|	$0.01 |
| Ephemeral storage cost 512MB (USD) |	$0.00 |

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
