var AWS = require("aws-sdk");
var util = require("util");
var parentRegionSNS = new AWS.SNS({ region: '${ParentRegion}' });
var localRegionSNS = new AWS.SNS();
var tagName = "${TagFieldName}";
var tagTTL = "${TagTTLFieldName}";
var topicName = "${TopicName}";
var accountId = "${AccountId}";
var parentRegion = "${ParentRegion}";
var region = process.env.AWS_REGION;
var topicArn = util.format("arn:aws:sns:%s:%s:%s", region, accountId, topicName);

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
      tagPayload.cache_ttl = parseTTL(response.headers['cache-control'][0].value);
    }
    // delete the tag header before sending back the response
    delete response.headers[tagName];
    console.log("Tag payload :%j", tagPayload);

    // emit only when ttl value > 0
    // if(tagPayload.ttl > 0){
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
      params.TopicArn = topicArn = util.format("arn:aws:sns:%s:%s:%s", parentRegion, accountId, topicName);
      try {
        await parentRegionSNS.publish(params).promise();
      } catch (e) { console.log("Both REC and Parent SNS endpoints are not valid..skipping emitting of tags") }
    }
    // }
    // else{
    //   console.log("Tag TTL is '0', not emitting");
    // }
  }
  return response;
};
function parseTTL(cacheControlValue) {
  console.log("In parseTTL :%s", cacheControlValue);
  let ttl = 0;
  if (cacheControlValue.includes("max-age") || cacheControlValue.includes("s-maxage")) {
    // cache control header of format max-age=5, s-maxage=7, public
    let cacheValues = cacheControlValue.split(",");
    // we don't know the order in which the headers will come but
    // return if there's s-maxage as that takes precedence over max-age
    for (let i = 0; i < cacheValues.length; i++) {
      let value = cacheValues[i];
      if (value.includes("s-maxage")) {
        ttl = value.split("=")[1];
        break;
      }
      else if (value.includes("max-age")) {
        ttl = value.split("=")[1];
      }
    }
  }
  return ttl;
};