const style = "<style> body { \
  padding: 3rem; \
  font-size: 16px; \
} \
textarea { \
  width: 100%; \
  min-height: 30rem; \
  font-family: \"Lucida Console\", Monaco, monospace; \
  font-size: 0.8rem; \
  line-height: 1.2; \
}</style>";

exports.handler = async (event) => {

  let modified_body = JSON.stringify(event);

  let template = "<pre><code>" + modified_body + "</code></pre></body></ht";

  let headers = {};
  headers['content-type'] = "text/html";
  headers['Edge-Cache-Tag'] = "tag1, tag2, tag3";
  headers['cache-control'] = "max-age=300, s-maxage=86400";

  const response = {
    statusCode: 200,
    headers: headers,
    body: template,
  };
  return response;
};