"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getMetadata = getMetadata;
exports.readMetadata = readMetadata;
exports.makeRequests = makeRequests;
exports.getThreadPositions = getThreadPositions;
exports.getDownloadProgressInfo = getDownloadProgressInfo;

var _rxjs = require("rxjs");

var _operators = require("rxjs/operators");

var _util = require("./util");

var fs = require('graceful-fs');

var path = require('path');

var Url = require('url');

var request = require('request');

//the observable created from the requestHead function will emit the array [response, ''] if no error is caught
//because the parameters for the request callback are (err, response, body) and body is empty
//see https://rxjs.dev/api/index/function/bindNodeCallback for more info
var requestHead = (0, _rxjs.bindNodeCallback)(request.head);

function getMetadata(url, headUrl, threads, savePath, saveDir) {
  return requestHead(headUrl).pipe((0, _operators.mergeMap)(function (x) {
    var response = x[0];
    var statusCode = response.statusCode;

    if (statusCode >= 400 && statusCode <= 512) {
      return (0, _rxjs.throwError)(response);
    } else {
      return (0, _rxjs.of)(parseInt(response.headers['content-length']));
    }
  }), (0, _operators.map)(function (filesize) {
    var ranges = (0, _util.calculateRanges)(filesize, threads);
    savePath = savePath || path.join(saveDir || process.cwd(), path.basename(Url.parse(url).path));
    var meta = {
      url: url,
      savePath: savePath,
      sudPath: (0, _util.sudPath)(savePath),
      filesize: filesize,
      ranges: ranges
    };
    return meta;
  }), //write data to .sud meta file side effect
  (0, _operators.tap)(function (meta) {
    fs.writeFile(meta.sudPath, JSON.stringify(meta));
  }));
}

function readMetadata(sudPath) {
  return (0, _util.fsReadFile)(sudPath).pipe((0, _operators.map)(function (rawMeta) {
    return JSON.parse(rawMeta);
  }));
} //calculate ranges based on existing .PARTIAL files
//and transform the meta object into an object holding an array of request observables
//and the meta data object


function makeRequests(meta$, options) {
  return meta$.pipe((0, _operators.map)(function (meta) {
    var url = meta.url,
        savePath = meta.savePath,
        ranges = meta.ranges;
    var rangeHeaders = (0, _util.getRangeHeaders)(savePath, ranges);
    var request$s = new Array(rangeHeaders.length);
    rangeHeaders.forEach(function (rangeHeader, index) {
      if (rangeHeader) {
        var headers = Object.assign(options.headers || {}, {
          range: rangeHeader
        });
        var requestOptions = {
          headers: headers,
          timeout: options.timeout
        };
        request$s[index] = (0, _util.createRequest)(url, requestOptions);
      } else {
        request$s[index] = (0, _rxjs.empty)();
      }
    });
    return {
      request$s: request$s,
      meta: meta
    };
  }));
} //write to buffer within and rebuild upon completion
//a separate meta$ observable created from the passed meta object is concatenated to the front
//the first item emitted from the returned variable will be the meta object


function getThreadPositions(requestsAndMeta$) {
  return requestsAndMeta$.pipe((0, _operators.concatMap)(function (requestsAndMeta) {
    var request$s = requestsAndMeta.request$s,
        meta = requestsAndMeta.meta,
        _requestsAndMeta$meta = requestsAndMeta.meta,
        savePath = _requestsAndMeta$meta.savePath,
        ranges = _requestsAndMeta$meta.ranges;
    var transformedRequest$s = request$s.map(function (request$, index) {
      var partialFile = (0, _util.partialPath)(savePath, index);
      var startPos = ranges[index][0] + (0, _util.getLocalFilesize)(partialFile);
      var writeStream = fs.createWriteStream(partialFile, {
        flags: 'a',
        start: startPos
      });
      var writeToStream = (0, _rxjs.bindCallback)(writeStream.write).bind(writeStream);
      return request$.pipe((0, _operators.filter)(function (x) {
        return x;
      }), //the nested concatMap ensures the buffer is written and that this writing completes
      //before the thread position is updated
      //this is necessary to ensure the .PARTIAL files rebuild correctly
      //we need it to be nested as the values emitted by writeToStream are not useful
      (0, _operators.concatMap)(function (data) {
        return (0, _rxjs.of)(data).pipe((0, _operators.concatMap)(function (data) {
          return writeToStream(data);
        }), (0, _operators.map)(function () {
          return Buffer.byteLength(data);
        }));
      }), (0, _operators.scan)(function (threadPosition, chunkSize) {
        return threadPosition + chunkSize;
      }, startPos), (0, _operators.finalize)(function () {
        return writeStream.end();
      }));
    }); //setup mergedTransformedRequests$ to rebuild on completion of ALL inner observables
    //merge flattens the higher-order observable into a single observable

    var mergedTransformedRequests$ = (0, _rxjs.from)(transformedRequest$s).pipe((0, _operators.mergeAll)(), //once the source observable finishes, rebuild the files
    (0, _operators.concat)((0, _util.rebuildFiles)(meta)));
    var meta$ = (0, _rxjs.of)(meta);
    return (0, _rxjs.of)(meta$, mergedTransformedRequests$);
  }), //merge the meta observable and the already flattened position observables into one observable
  (0, _operators.mergeAll)());
} //use the meta data object (first item to be emitted) and the thread positions
//to calculate various information about the download progress


function getDownloadProgressInfo(threadPositions$, throttleRate) {
  return threadPositions$.pipe((0, _operators.throttleTime)(throttleRate), (0, _operators.scan)(function (acc, threadPosition) {
    //initialise the accumulator to hold the meta data object and initial download progress info
    if (acc == 0) {
      var meta = threadPosition;
      var initialDownloadProgressInfo = (0, _util.getInitialDownloadProgressInfo)(meta); //the downloadProgressInfo field is also set to the meta data object so that
      //the meta data object is available (as the first item emitted) once plucked

      acc = {
        meta: meta,
        initialDownloadProgressInfo: initialDownloadProgressInfo,
        downloadProgressInfo: meta
      };
    } else {
      //threadPosition is an actual thread position and not the meta data object, calculate the download progress info
      var downloadProgressInfo = (0, _util.calculateDownloadProgressInfo)(acc, threadPosition); //set initialDownloadProgressInfo to null so the next iteration of calculateDownloadProgressInfo
      //knows to use the accumulator's downloadProgressInfo instead

      acc = Object.assign(acc, {
        initialDownloadProgressInfo: null,
        downloadProgressInfo: downloadProgressInfo
      });
    }

    return acc;
  }, 0), (0, _operators.pluck)('downloadProgressInfo'));
}
//# sourceMappingURL=core.js.map