var AWS = require("aws-sdk");
var util = require("util");
var parentRegionSNS = new AWS.SNS({ region: '${ParentRegion}' });
var localRegionSNS = new AWS.SNS();
var tagName = "${TagFieldName}";
var topicName = "${TopicName}";
var accountId = "${AccountId}";
var parentRegion = "${ParentRegion}";
var region = process.env.AWS_REGION;
var topicArn = util.format("arn:aws:sns:%s:%s:%s", region, accountId, topicName);

exports.handler = async (event) => {
  console.log("Received event:%j", event);
  let response = event.Records[0].cf.response
  if (response.headers[tagName]) {
    let request = event.Records[0].cf.request;
    let tagPayload = {};
    tagPayload.distributionId = event.Records[0].cf.config.distributionId;
    tagPayload.querystring = request.querystring;
    tagPayload.uri = request.uri;
    tagPayload.tags = response.headers[tagName][0].value;
    // delete the tag header before sending back the response
    delete response.headers[tagName];
    console.log("Tag payload :%j", tagPayload);
    var params = {
      Message: JSON.stringify(tagPayload),
      Subject: "PostTag" + tagPayload.distributionId,
      TopicArn: topicArn
    };
    try {
      await localRegionSNS.publish(params).promise();
    }
    catch (e) {
      console.log("Trying in parent region:%s", e);
      params.TopicArn = util.format("arn:aws:sns:%s:%s:%s", parentRegion, accountId, topicName);
      await parentRegionSNS.publish(params).promise();
    }
  }
  return response;
};
