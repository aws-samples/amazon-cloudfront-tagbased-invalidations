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

1. Clone the repository and change into `cdk` directory.
1. Set the environment variables in env.sh
1. Run ./deploy.sh
