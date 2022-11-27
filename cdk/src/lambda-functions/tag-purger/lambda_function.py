import json
import boto3
import os
import logging
import time
import hashlib
import uuid

sqs = boto3.client('sqs')
ssm = boto3.client('ssm')
cloudfront = boto3.client('cloudfront')

queue_url = os.environ['SQS_QUEUE_URL']
process_record_count = int(os.environ['PROCESS_RECORD_COUNT'])
invalidation_threshold = int(os.environ['INVALIDATION_THRESHOLD'])
purger_active_parameter_name = os.environ['PURGER_ACTIVE_PARAMETER_NAME']
stack_name = os.environ['STACK_NAME']
log = logging.getLogger()
log.setLevel(logging.INFO)

# invalidation_status_map = {"InProgress":0,"Completed":1}

def lambda_handler(event, context):

    # check if purger is already active
    ssm_param = get_parameter(purger_active_parameter_name)

    if ssm_param != '0':
        log.info("Purger already active..so skipping this cycle")
        return {
            'message': 'Purger already active...'
        }
    else:
        put_parameter(purger_active_parameter_name,'INPROGRESS')

    message_count = get_messages_in_queue()
    if message_count > 0:
        # loop for max of 10 times. In each sqs.receive_message call we get a max of 10 msgs
        # for x in range(10):
        messages = receive_message(process_record_count)
        # dict to hold active invalidation count by distribution
        invalidations_count = {}

        # check if any messages are in the queue
        try:
            messages['Messages']
            for msg in messages['Messages']:
                try:
                    print(msg)
                    distribution_id = msg["MessageAttributes"]["distributionId"]["StringValue"]
                    log.info(f'Distribution Id {distribution_id}')
                    if distribution_id in invalidations_count:
                        log.info(f'Already evaluated...')
                    else:
                        count = get_active_invalidations(distribution_id)
                        invalidations_count[distribution_id] = count

                    # tagPayload = json.loads(msg["Body"])
                    # sqs.delete_message(os.environ['SQS_QUEUE_URL'],msg["ReceiptHandle"])
                except Exception as e:
                    log.error(f"Error {e}")

            log.info(f'Invalidation count :%s',invalidations_count)
        except:
            print("No more messages in Queue")

        total_invalidation_possible = invalidation_threshold - count_active_invalidations(invalidations_count)
        log.info('Total invalidations possible :%s',total_invalidation_possible)

        bucket_msgs = []
        bucket_msgs.append(messages)

        total_msgs = len(messages['Messages'])
        log.info("Initial msgs in bucket :%s",total_msgs)

        # read more msgs if we are withing the threshold of active invalidations
        while total_msgs < total_invalidation_possible:
            try:
                messages = receive_message(process_record_count)
                messages['Messages']
                log.info("Length :%s",len(messages["Messages"]))
                # don't add more than what is possible to invalidate now
                if total_msgs + len(messages["Messages"]) > total_invalidation_possible:
                    break;

                total_msgs = total_msgs + len(messages["Messages"])
                bucket_msgs.append(messages)
                log.info("Total msgs in bucket :%s",total_msgs)
            except:
                log.info("No more msgs")
                break

        collated_msgs = collate_messages_by_distribution(bucket_msgs)
        log.info("Final Total msgs in collated_bucket :%s",collated_msgs)

        perform_invalidation(collated_msgs)

    delete_parameter(purger_active_parameter_name)
    return {
        'message': 'Complete'
    }

def perform_invalidation(collated_msgs):

    for distributionId,messages in collated_msgs.items():
        log.info("Processing invalidation request for :%s",distributionId)

        invalidate_url = []
        delete_messages = []

        for msg in messages:
            tagPayload = json.loads(msg["Body"])
            log.info("Tag payload :%s",tagPayload);
            uri = tagPayload["uri"]["S"]
            querystring = tagPayload["querystring"]["S"]
            if  querystring != "":
                uri = "{uri}?{qs}".format(uri=uri,qs=querystring)
            log.info("Processing invalidate_uri :%s",uri)

            # add uri only if not present already, removes duplicate submission
            if uri not in invalidate_url:
                invalidate_url.append(uri)
            else:
                log.info("URI already present :%s",uri)
            delete_messages.append({
                'Id': uuid.uuid4().hex,
                'ReceiptHandle': msg["ReceiptHandle"]
            })

        cloudfront.create_invalidation(
            DistributionId=distributionId,
            InvalidationBatch={
                'Paths': {
                    'Quantity': len(invalidate_url),
                    'Items': invalidate_url
                },
                'CallerReference': "Caller :{ts}".format(ts=time.time())
            }
        )
        delete_message_batch(delete_messages)

def collate_messages_by_distribution(bucket_msgs):

    collated_bucket = {}
    log.info("In collate_messages_by_distribution with :%s",bucket_msgs)

    for message in bucket_msgs:
        for msg in message['Messages']:
            log.info('In collate_messages_by_distribution.msg %s',msg)
            distribution_id = msg["MessageAttributes"]["distributionId"]["StringValue"]
            log.info(f'Distribution Id {distribution_id}')
            if not distribution_id in collated_bucket:
                collated_bucket[distribution_id] = []

            collated_bucket[distribution_id].append(msg)

    return collated_bucket


def count_active_invalidations(invalidations_count):
    total = 0

    for value in invalidations_count.values():
        total = total + value

    return total

def get_active_invalidations(distribution_id):
    log.info(f'In get_active_invalidations {distribution_id}')
    paginator = cloudfront.get_paginator('list_invalidations')

    response_iterator = paginator.paginate(
        DistributionId=distribution_id,
        PaginationConfig={
            'MaxItems': 10,
            'PageSize': 100

        }
    )

    count = 0
    for invalidation in response_iterator:
        log.info('list of invalidations :%s',invalidation["InvalidationList"])
        for item in invalidation["InvalidationList"]["Items"]:
            log.info('Invalidation Id %s',item["Id"])
            status = item["Status"]
            if status == "In progress":
                response = cloudfront.get_invalidation(
                        DistributionId=distribution_id,
                        Id=item["Id"]
                )
                count = count + response["Invalidation"]["InvalidationBatch"]["Paths"]["Quantity"]
                log.info('Invalidation Id count :%s',response["Invalidation"]["InvalidationBatch"]["Paths"]["Quantity"])
                # for "Completed"
            elif status == "Completed":
                log.info("The invalidation status is 'Completed'..stopping here")
                break

    return count

def get_messages_in_queue():
    try:
        queue_attr = sqs.get_queue_attributes(QueueUrl=queue_url,AttributeNames=['ApproximateNumberOfMessages'])
        no_of_messages = int(queue_attr["Attributes"]["ApproximateNumberOfMessages"])
        print("No of messages in Queue {}".format(no_of_messages))
        return no_of_messages
    except:
        print("Exception while get_messages_in_queue")
        return -1;

def receive_message(process_record_count):
     return sqs.receive_message(QueueUrl=queue_url,
        MessageAttributeNames=['All'],
        MaxNumberOfMessages=process_record_count,
        WaitTimeSeconds=5)

def delete_message_batch(delete_messages):
    log.info("In delete_messages with %s msgs",len(delete_messages))
    batch_size = 10
    for i in range(0, len(delete_messages), batch_size):
        log.info("Index %s",i)
        tmp_msg = delete_messages[i:i + batch_size]
        log.info("Length :%s",len(tmp_msg))
        log.info(tmp_msg)
        sqs.delete_message_batch(QueueUrl=queue_url,
        Entries=tmp_msg)

def put_parameter(key,value):
    log.info("In put_parameter :%s = %s",key,value)
    name = prepare_key_name(key)
    log.info("In put_parameter :%s",name)
    ssm.put_parameter(
        Name=name,
        Value='{}'.format(value),
        Overwrite=True,
        Tier='Standard',
        Type='String'
    )

#get the value of the key (timestamp) from SSM
def get_parameter(key):
    return '0'
    try:
        param = ssm.get_parameter(Name=prepare_key_name(key))
        return param["Parameter"]["Value"]
    except:
        return '0'

#delete the channel start time once we have computed the channel duration triggered by STREAM_END event
def delete_parameter(key):
    try:
        ssm.delete_parameter(Name=prepare_key_name(key))
    except:
        log.info("Parameter not found :%s",key)

#prepare key name consistently
def prepare_key_name(key):
    return "/{}/CloudFront/TagInvalidation/{}".format(stack_name,key)
