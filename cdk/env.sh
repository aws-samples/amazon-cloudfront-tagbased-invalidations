#!/usr/bin/env bash

export AWS_PROFILE="default"
export TOPIC_NAME='tag-ingest-topic'
export PRIMARY_AWS_REGION='us-west-1'
# Specify delimiter when multiple tags are passed
export TAG_DELIMITER=','
# Specify how to determine the TTL of the reocord in DynamoDB.
# whether to use Cache-Control header max-age or take the TTL specified as part of the tag 
# possible values 'Tag' | 'Cache-Control'
export TAG_NAME='Edge-Cache-Tag'
export TAG_TTL_DEFINED_BY='Cache-Control'
export SAMPLE_APP_SETUP='True'