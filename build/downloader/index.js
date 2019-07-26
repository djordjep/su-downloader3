"use strict";

var _core = require("./core");

var _util = require("./util");

function startDownload(locations) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
      _ref$threads = _ref.threads,
      threads = _ref$threads === void 0 ? 4 : _ref$threads,
      _ref$timeout = _ref.timeout,
      timeout = _ref$timeout === void 0 ? 3 * 60 * 1000 : _ref$timeout,
      _ref$headers = _ref.headers,
      headers = _ref$headers === void 0 ? null : _ref$headers,
      _ref$throttleRate = _ref.throttleRate,
      throttleRate = _ref$throttleRate === void 0 ? 500 : _ref$throttleRate;

  var meta$;

  if (typeof locations == 'string' && (0, _util.isSudPath)(locations)) {
    //resuming download
    meta$ = (0, _core.readMetadata)(locations);
  } else if (typeof locations == 'string') {
    //starting new download without save path or save dir
    meta$ = (0, _core.getMetadata)(locations, threads);
  } else {
    //starting new download with save path
    //only one of savePath and saveDir should be defined, however, neither of them need to be defined
    var url = locations.url,
        headUrl = locations.headUrl,
        savePath = locations.savePath,
        saveDir = locations.saveDir;
    if (!headUrl) headUrl = url;
    meta$ = (0, _core.getMetadata)(url, headUrl, threads, savePath, saveDir);
  }

  var requestsAndMeta$ = (0, _core.makeRequests)(meta$, {
    timeout: timeout,
    headers: headers
  });
  var threadPositions$ = (0, _core.getThreadPositions)(requestsAndMeta$);
  var downloadProgressInfo$ = (0, _core.getDownloadProgressInfo)(threadPositions$, throttleRate); //the first value emitted is the meta data object

  return downloadProgressInfo$;
}

module.exports = {
  startDownload: startDownload,
  killFiles: _util.killFiles,
  sudPath: _util.sudPath
};
//# sourceMappingURL=index.js.map