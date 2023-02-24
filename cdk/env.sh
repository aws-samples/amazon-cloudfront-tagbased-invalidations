#!/usr/bin/env bash

# Required: set the AWS CLI profile name
export AWS_PROFILE="default"

# Optional: set the SNS topic name
export TOPIC_NAME='tag-ingest-topic'

# Required: set the AWS region where the primary deployment of solution resides.
export PRIMARY_AWS_REGION=''

# Required: Specify delimiter when multiple tags are passed, possible values ',' or ' ' (space)
export TAG_DELIMITER=','

# Required: Specify the response header name where tags are present
export TAG_NAME='Edge-Cache-Tag'

# Optional: Specify the response header name where tag Time-to-Live (TTL) in seconds 
# will be specified from origin.
export TAG_TTL_NAME='tag-ttl'

# Optional: Specify how to determine the TTL of the Tag reocord in DynamoDB.
# whether to use Cache-Control header max-age or take the TTL specified as part of the tag
# leave it empty if you do not want to set a TTL 
# possible values 'Tag' or 'Cache-Control' or ''
export TAG_TTL_DEFINED_BY='Cache-Control'