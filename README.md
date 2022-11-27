## Tag based Invalidations in Amazon CloudFront

This is a reference implementation on how you could implement tag-based invalidations in CloudFront using CloudFormation template.

## Architecture

### Tag Ingest Workflow

![Tag Ingest Workflow](/images/tag-ingest-workflow.jpeg)

### Tag Purge Workflow

![Tag Purge Workflow](/images/tag-purge-workflow.jpeg)

## Pre-requisites:

1. Install 'make'.
1. Install git.

## Steps to build

1. Clone this repository using command `git clone https://github.com/aws-samples/amazon-cloudfront-tagbased-invalidations.git`

2. In the 'Makefile'
- set 'bucket' variable to the Amazon S3 bucket name prefix which will be used to create 2 Amazon S3 buckets. One of the bucket is created in the specified 'region' parameter and other bucket is created in 'us-east-1' region. These buckets will hold the build artifacts for the corresponding AWS regional resource being deployed.
- set 'region' variable to the AWS Region where you want the deployed solution to reside.
- set 'profile' variable to the AWS CLI profile which has necessary permissions to deploy AWS resources using CloudFormation.
- set 'backend_endpoint' variable to the backend system which will act as 'Origin' for CloudFront. This is the backend which is emitting the tag metadata in response headers.

3. Run `make all`. This would build the project and copy the respective artifacts into the 2 Amazon S3 bucket created and deploy the CloudFormation template in specified AWS region.

Once the deployment is done, go to the [Amazon CloudFront console](https://us-east-1.console.aws.amazon.com/cloudfront/v3/home#/distributions) to view and test tag based invalidation in the newly created distribution.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
