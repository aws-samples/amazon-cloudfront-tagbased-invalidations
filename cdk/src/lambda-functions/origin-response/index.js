const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const util = require("util");
const tagName = "${TagFieldName}";
const tagTTL = "${TagTTLFieldName}";
const topicName = "${TopicName}";
const accountId = "${AccountId}";
const parentRegion = "${ParentRegion}";
const region = process.env.AWS_REGION;
const topicArn = util.format("arn:aws:sns:%s:%s:%s", region, accountId, topicName);
const localRegionSNS = new SNSClient({
  region
});

exports.handler = async (event) => {
  // console.log("Received event:%j", event);

  let response = event.Records[0].cf.response;
  if (response.headers[tagName]) {
    let request = event.Records[0].cf.request;
    let tagPayload = {};
    tagPayload.distributionId = event.Records[0].cf.config.distributionId;
    tagPayload.querystring = request.querystring;
    tagPayload.uri = request.uri;
    tagPayload.tags = response.headers[tagName][0].value;
    // populate the tag ttl with explicit value from tag-ttl header
    // and or Cache-Control header
    if (response.headers[tagTTL]) {
      tagPayload.tag_ttl = response.headers[tagTTL][0].value;
      delete response.headers[tagTTL];
    }
    if (response.headers['cache-control']) {
      // tagPayload.cache_ttl = parseTTL(response.headers['cache-control'][0].value);
      tagPayload.cache_ttl = response.headers['cache-control'][0].value;
    }
    // delete the tag header before sending back the response
    delete response.headers[tagName];
    //console.log("Tag payload :%j", tagPayload);

    // emit only when ttl value > 0
    // if(tagPayload.ttl > 0){
    var params = {
      Message: JSON.stringify(tagPayload),
      Subject: "PostTag" + tagPayload.distributionId,
      TopicArn: topicArn
    };
    try {
      const command = new PublishCommand(params);
      await localRegionSNS.send(command);
      // await localRegionSNS.publish(params).promise();
    }
    catch (e) {
      console.log("Trying in parent region:%s", e);
      params.TopicArn = topicArn = util.format("arn:aws:sns:%s:%s:%s", parentRegion, accountId, topicName);
      try {
        const parentRegionSNS = new SNSClient({ region: 'us-west-1' });
        const command = new PublishCommand(params);
        await parentRegionSNS.send(command);
        // await parentRegionSNS.publish(params);
      } catch (e) { console.log("Both REC and Parent SNS endpoints are not valid..skipping emitting of tags") }
    }
  }
  return response;
};