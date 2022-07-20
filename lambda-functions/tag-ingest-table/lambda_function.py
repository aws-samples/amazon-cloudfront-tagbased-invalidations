import json
import boto3
import os
import logging
import datetime
from datetime import datetime
import hashlib
import time

sqs = boto3.client('sqs')
queue_url = os.environ['SQS_QUEUE_URL']
process_record_count = int(os.environ['PROCESS_RECORD_COUNT'])
tag_delimiter = os.environ['TAG_DELIMITER']
precedence = os.environ['PRECEDENCE_TTL']
dynamodb = boto3.resource('dynamodb')

log = logging.getLogger()
log.setLevel(logging.INFO)

def lambda_handler(event, context):
    # TODO implement
    message_count = get_messages_in_queue(queue_url)
    if message_count > 0:
        # loop for max of 10 times. In each sqs.receive_message call we get a max of 10 msgs
        for x in range(10):
            messages = receive_message(queue_url,process_record_count)
            # check if any messages are in the queue
            try:
                messages['Messages']
                for msg in messages['Messages']:
                    try:
                        tagPayload = json.loads(json.loads(msg["Body"])["Message"])
                        log.info("Message body :%s",tagPayload)
                        log.info("Distribution Id :%s",tagPayload["distributionId"])
                        updateTable(tagPayload)
                        delete_message(os.environ['SQS_QUEUE_URL'],msg["ReceiptHandle"])
                    except Exception as e:
                        log.info("Error while updating DynamoDB table :%s",e)
                        break
            except:
                log.info("No more messages in Queue after loop %s",x)
                break
    else:
        log.info("No messages in queue")

    return {
        'statusCode': 200,
        'body': json.dumps('Hello from Lambda!')
    }

def updateTable(payload):
    try:
        table = checkCreateTable(payload["distributionId"])

        tags = payload["tags"].split(tag_delimiter)
        tag_ttl = determineTagTTL(payload)
        log.info("Tag ttl :%s",tag_ttl)

        if tag_ttl is not None:
            tag_ttl = int(time.time()) + int(tag_ttl)

        for tag in tags:
            tag = tag.strip()
            log.info(f"Updating item for tag ${tag}")

            hash = {"p" : payload["uri"], "u": payload["querystring"]}
            hash = json.dumps(hash, sort_keys = True).encode("utf-8")
            expr = {}
            expr[":updated_at"] = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
            expr[":uri"] = payload["uri"]
            expr[":querystring"] = payload["querystring"]
            expr[":tag_ttl"] = tag_ttl

            # log.info("Expression :%s",expr)
            table.update_item(
                 Key={
                    'tag': tag,
                    'uri_hash': hashlib.md5(hash).hexdigest()
                },
                UpdateExpression="set updated_at = :updated_at, uri = :uri, querystring = :querystring, tag_ttl = :tag_ttl",
                ExpressionAttributeValues = expr
                # ExpressionAttributeValues={
                #     ':updated_at': datetime.now().strftime("%m/%d/%Y, %H:%M:%S"),
                #     ':uri': payload["uri"],
                #     ':querystring': payload["querystring"]
                # }

            )

    except Exception as e:
        log.info(f"Exception while updating DynamoDB table: ${e}")
        raise e


def determineTagTTL(payload):
    ttl = None

    if precedence == "None":
        ttl = None
    elif precedence == "Tag":
        if "cache_ttl" in payload:
            ttl = payload["cache_ttl"]
        if "tag_ttl" in payload:
            ttl = payload["tag_ttl"]
    elif precedence == "Cache-Control":
        if "tag_ttl" in payload:
            ttl = payload["tag_ttl"]
        if "cache_ttl" in payload:
            ttl = payload["cache_ttl"]
    return ttl

def checkCreateTable(distributionId):
    log.info("In checkCreateTable %s %s",os.environ['TABLE_PREFIX'],distributionId)
    table_name = "{}-{}".format(os.environ['TABLE_PREFIX'],distributionId)
    try:
        log.info("Checking if table exists %s",table_name)
        table = dynamodb.Table(table_name)
        log.info("DynamoDB Table status :%s",table)
        assert (table.table_status == 'ACTIVE'), table.table_status

        checkEnableTTL(table_name)
        return table
    except Exception as e:
        log.info(f'In checkCreateTable.error {e} :{table_name}')
        if e != "INPROGRESS":
            table = createTable(table_name)
            assert (table.table_status == 'ACTIVE'), "Tables does not exist..creating it. Try in next cycle.."

def checkEnableTTL(table_name):
    log.info("In checkEnableTTL :%s",table_name)
    client = boto3.client('dynamodb')

    response = client.describe_time_to_live(
        TableName=table_name
    )
    log.info("DynamoDB Table TTL status :%s",response['TimeToLiveDescription']['TimeToLiveStatus'])

    ttl_status = response['TimeToLiveDescription']['TimeToLiveStatus']
    try:
        assert ('ENABLED' == ttl_status),ttl_status
    except Exception as e:
        log.info("In checkEnableTTL.error %s , %s",e,table_name)
        if e != "ENABLING":
            try:
                log.info("Updating TTL column")
                response = client.update_time_to_live(
                    TableName=table_name,
                    TimeToLiveSpecification={
                        'Enabled': True,
                        'AttributeName': 'tag_ttl'
                    }
                )
                log.info("DynamoDB Table TTL status updated :%s",response)
            except Exception as e1:
                log.error("Exception while enabling TTL %s",e1)
        else:
            log.info("TTL check is false")

def createTable(table_name):
    try:
        return dynamodb.create_table(
            AttributeDefinitions=[
                {
                    'AttributeName': 'tag',
                    'AttributeType': 'S'
                },
                {
                    'AttributeName': 'uri_hash',
                    'AttributeType': 'S'
                }
            ],
            TableName=table_name,
            BillingMode='PAY_PER_REQUEST',
            KeySchema=[
                {
                    'AttributeName': 'tag',
                    'KeyType': 'HASH'
                },
                 {
                    'AttributeName': 'uri_hash',
                    'KeyType': 'RANGE'
                }
            ])
    except Exception as e:
        log.info(f'Exception while creating table :{table_name} - {e}')

def get_messages_in_queue(queue_url):
    try:
        queue_attr = sqs.get_queue_attributes(QueueUrl=queue_url,AttributeNames=['ApproximateNumberOfMessages'])
        no_of_messages = int(queue_attr["Attributes"]["ApproximateNumberOfMessages"])
        log.info("No of messages in Queue {}".format(no_of_messages))
        return no_of_messages
    except:
        log.error("Exception while get_messages_in_queue")
        return -1;

def receive_message(queue_url,process_record_count):
     return sqs.receive_message(QueueUrl=queue_url,
        MessageAttributeNames=['All'],
        MaxNumberOfMessages=process_record_count,
        WaitTimeSeconds=5)

def delete_message(queue_url,receipt_handle):
    log.info("In delete_message")
    sqs.delete_message(QueueUrl=queue_url,ReceiptHandle=receipt_handle)
