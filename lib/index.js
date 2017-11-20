'use strict';
const DD = require('node-dogstatsd').StatsD;

module.exports = function (options) {
  let datadog = options.dogstatsd || new DD();
  let stat = options.stat || 'node.express.router';
  let tags = options.tags || [];
  let path = options.path || false;
  let base_url = options.base_url || false;
  let response_code = options.response_code || false;
  const RE_COLON = /:/g;
  const RE_PIPE = /\|/g;

  // some unicode lookalikes that won't break datadog's "parser"
  const FULL_WIDTH_BAR_CHAR = String.fromCodePoint(0xFF5C);
  const TRIANGLE_COLON_CHAR = String.fromCodePoint(0x02d0);

  function replaceDDCharacters(str) {
    return str && str.replace(RE_PIPE, FULL_WIDTH_BAR_CHAR).replace(RE_COLON, TRIANGLE_COLON_CHAR);
  }

  return function (req, res, next) {
    if (!req._startTime) {
      req._startTime = new Date();
    }

    let end = res.end;
    res.end = function (chunk, encoding) {
      res.end = end;
      res.end(chunk, encoding);

      if (!req.route || !req.route.path) {
        return;
      }

      let baseUrl = (base_url !== false) ? req.baseUrl : '';

      let dynamicTags = tags;
      if (typeof tags === 'function') {
        dynamicTags = tags(req);
      }

      let statTags = [
        `route:${baseUrl}${replaceDDCharacters(req.route.path)}`
      ].concat(dynamicTags);

      if (options.method) {
        statTags.push(`method:${req.method.toLowerCase()}`);
      }

      if (options.protocol && req.protocol) {
        statTags.push(`protocol:${req.protocol}`);
      }

      if (path !== false) {
        statTags.push(`path:${baseUrl}${req.path}`);
      }

      if (response_code) {
        statTags.push(`response_code:${res.statusCode}`);
        datadog.increment(`${stat}.response_code.${res.statusCode}` , 1, statTags);
        datadog.increment(`${stat}.response_code.all` , 1, statTags);
      }

      datadog.histogram(`${stat}.response_time`, (new Date() - req._startTime), 1, statTags);
    };

    next();
  };
};
