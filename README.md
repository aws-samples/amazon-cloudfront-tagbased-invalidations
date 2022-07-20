## Tag based Invalidations - Amazon CloudFront

This is a reference implementation on how you could implement 'Tag-based' invalidations in CloudFront.

## Architecture

# Tag Ingest Workflow

![Tag Ingest Workflow](/images/tag-ingest-workflow.jpeg)

# Tag Purge Workflow

![Tag Purge Workflow](/images/tag-purge-workflow.jpeg)

## Pre-requisites:

1. Install 'make'.
1. Install git.


## Steps to build

1. Clone this repository using command `git clone https://github.com/aws-samples/amazon-cloudfront-tagbased-invalidations.git`

2. In the 'Makefile'
- set 'bucket' variable to the Amazon S3 bucket which will hold your build artifacts.
- set 'region' variable to the AWS Region where you want the deployed solution to reside.
- set 'profile' variable to the AWS CLI profile which has necessary permissions to deploy AWS resources using CloudFormation.
- set 'backend_endpoint' variable to the backend system which will act as 'Origin' for CloudFront. This is the backend which is emitting the tag metadata in response headers.

3. Run `make all`. This would build the project and copy the assets into an S3 bucket and deploy the CloudFormation template in the AWS region set..

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
