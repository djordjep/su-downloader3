"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createRequest = createRequest;
exports.calculateRanges = calculateRanges;
exports.toRangeHeader = toRangeHeader;
exports.getRangeHeaders = getRangeHeaders;
exports.rebuildFiles = rebuildFiles;
exports.calculateDownloadProgressInfo = calculateDownloadProgressInfo;
exports.killFiles = killFiles;
exports.getInitialDownloadProgressInfo = exports.fsReadFile = exports.getLocalFilesize = exports.isSudPath = exports.partialPath = exports.sudPath = void 0;

var _rxjs = require("rxjs");

var _operators = require("rxjs/operators");

var fs = require('graceful-fs');

var request = require('request');

var sudPath = function sudPath(filename) {
  return filename + '.sud';
};

exports.sudPath = sudPath;

var partialPath = function partialPath(filename, index) {
  return "".concat(filename, ".").concat(index, ".PARTIAL");
};

exports.partialPath = partialPath;

var isSudPath = function isSudPath(filename) {
  return /.sud$/.test(filename);
};

exports.isSudPath = isSudPath;

function createRequest(url, requestOptions) {
  return _rxjs.Observable.create(function (observer) {
    var req = request(url, requestOptions).on('data', function (data) {
      return observer.next(data);
    }).on('error', function (error) {
      return observer.error(error);
    }).on('complete', function () {
      return observer.complete();
    }); //clean up function called when unsubscribed

    return function () {
      return req.abort();
    };
  });
}

var getLocalFilesize = function getLocalFilesize(filename) {
  return fs.existsSync(filename) ? fs.statSync(filename).size : 0;
}; //takes a file size and the number of partial files (threads) to be used
//and calculates the ranges in bytes for each thread


exports.getLocalFilesize = getLocalFilesize;

function calculateRanges(filesize, threads) {
  var ranges = new Array(threads);

  if (threads == 1) {
    ranges = [[0, filesize]];
  } else {
    var partitionSize = Math.floor(filesize / threads);
    ranges[0] = [0, partitionSize];

    for (var i = 1; i < threads - 1; i++) {
      ranges[i] = [partitionSize * i + 1, partitionSize * (i + 1)];
    }

    ranges[threads - 1] = [ranges[threads - 2][1] + 1, filesize];
  }

  return ranges;
} //position in this context starts counting at 0, i.e. the size of the .PARTIAL file


function toRangeHeader(range, position) {
  var start = range[0] + position;
  var end = range[1];
  return "bytes=".concat(start, "-").concat(end);
}

function getRangeHeaders(savePath, ranges) {
  return ranges.map(function (range, index) {
    var position = getLocalFilesize(partialPath(savePath, index));
    return range[0] + position >= range[1] ? 0 : toRangeHeader(range, position);
  });
}

var fsReadFile = (0, _rxjs.bindNodeCallback)(fs.readFile);
exports.fsReadFile = fsReadFile;
var fsAppendFile = (0, _rxjs.bindNodeCallback)(fs.appendFile);
var fsUnlink = (0, _rxjs.bindNodeCallback)(fs.unlink); //concatenates all .PARTIAL files and renames the resulting file
//cleans up by deleting .PARTIAL files and .sud meta data file

function rebuildFiles(meta) {
  var savePath = meta.savePath,
      ranges = meta.ranges;
  var sudFile = sudPath(savePath); //check if the files actually need to be rebuilded
  //if each partial file is complete, the file size in bytes add the range lower bound should
  //differ from the range upper bound by no more than 1 byte (this only occurs for the first partial file
  //as it starts at 0)

  var notCompleted = ranges.some(function (range, index) {
    return Math.abs(range[0] + getLocalFilesize(partialPath(savePath, index)) - range[1]) > 1;
  });
  if (notCompleted) (0, _rxjs.throwError)('REBUILD ERROR: INCORRECT PARTIAL FILE SIZEZ'); //if an entity at the save path already exists, delete it
  //the user should be responsbile for ensuring this does not happen if they do not want it to

  if (fs.existsSync(savePath)) fs.unlinkSync(savePath);
  return (0, _rxjs.range)(0, ranges.length).pipe((0, _operators.map)(function (index) {
    return partialPath(savePath, index);
  }), //transform each partial file name into an observable that when subscribed to appends data to
  //the save file and deletes it
  //concatMap ensures this is done in order
  (0, _operators.concatMap)(function (partialFile) {
    return (0, _rxjs.of)(partialFile).pipe((0, _operators.concatMap)(function (partialFile) {
      return fsReadFile(partialFile);
    }), (0, _operators.concatMap)(function (partialData) {
      return fsAppendFile(savePath, partialData);
    }), (0, _operators.concatMap)(function () {
      return fsUnlink(partialFile);
    }));
  }), (0, _operators.concat)(fsUnlink(sudFile)), //we don't care about the output, we just wanted to perform the actions
  //and put them in observables so the observable chain isn't interrupted
  (0, _operators.ignoreElements)());
}

var getInitialDownloadProgressInfo = function getInitialDownloadProgressInfo(meta) {
  return {
    time: {
      start: Date.now(),
      //timestamp
      elapsed: 0,
      //milliseconds
      eta: 0 //seconds

    },
    //bytes
    total: {
      filesize: meta.filesize,
      downloaded: 0,
      percentage: 0
    },
    instance: {
      downloaded: 0,
      percentage: 0
    },
    //bytes per second
    speed: 0,
    avgSpeed: 0,
    //[bytes]
    threadPositions: meta.ranges.map(function (range, index) {
      return range[0] + getLocalFilesize(partialPath(meta.savePath, index));
    })
  };
}; //calculates the index of a thread based on its position


exports.getInitialDownloadProgressInfo = getInitialDownloadProgressInfo;

function getThreadIndexFromPosition(ranges, threadPosition) {
  return ranges.findIndex(function (range) {
    return threadPosition > range[0] && threadPosition <= range[1] + 1;
  });
}

function initialiseDownloaded(ranges, threadPositions) {
  return threadPositions.reduce(function (downloaded, threadPosition, index) {
    return downloaded + threadPosition - ranges[index][0];
  }, 0);
}

function calculateDownloadProgressInfo(prev, threadPosition) {
  //return object of the same form as initialDownloadProgressInfo
  //check if the initialDownloadProgressInfo object exists, if it does, use that
  //instead of the 'previous' downloadProgressInfo object
  var meta = prev.meta,
      initialDownloadProgressInfo = prev.initialDownloadProgressInfo,
      downloadProgressInfo = prev.downloadProgressInfo;
  var prevDownloadProgressInfo = initialDownloadProgressInfo || downloadProgressInfo;
  var _prevDownloadProgress = prevDownloadProgressInfo.time,
      start = _prevDownloadProgress.start,
      elapsed = _prevDownloadProgress.elapsed,
      _prevDownloadProgress2 = prevDownloadProgressInfo.total,
      filesize = _prevDownloadProgress2.filesize,
      downloaded = _prevDownloadProgress2.downloaded,
      instance = prevDownloadProgressInfo.instance,
      threadPositions = prevDownloadProgressInfo.threadPositions;
  var ranges = meta.ranges; //initialise downloaded if necessary

  downloaded = initialDownloadProgressInfo ? initialiseDownloaded(ranges, threadPositions) : downloaded;
  var currentTimestamp = Date.now();
  var deltaTime = currentTimestamp - start - elapsed;
  var newElapsed = elapsed + deltaTime;
  var threadIndex = getThreadIndexFromPosition(ranges, threadPosition);
  var deltaDownloaded = threadPosition - threadPositions[threadIndex];
  var newDownloaded = downloaded + deltaDownloaded;
  var newInstanceDownloaded = instance.downloaded + deltaDownloaded;
  var newPercentage = 100 * newDownloaded / filesize;
  var newInstancePercentage = 100 * newInstanceDownloaded / filesize;
  var newSpeed = 1000 * (deltaDownloaded / deltaTime);
  threadPositions[threadIndex] = threadPosition;
  var avgSpeed = 1000 * newInstanceDownloaded / newElapsed;
  var newEta = (filesize - newDownloaded) / avgSpeed;
  var newDownloadProgressInfo = {
    time: {
      start: start,
      elapsed: newElapsed,
      eta: newEta
    },
    total: {
      filesize: filesize,
      downloaded: newDownloaded,
      percentage: newPercentage
    },
    instance: {
      downloaded: newInstanceDownloaded,
      percentage: newInstancePercentage
    },
    speed: newSpeed,
    avgSpeed: avgSpeed,
    threadPositions: threadPositions
  };
  return newDownloadProgressInfo;
}

function killFiles(sudPath) {
  if (!fs.existsSync(sudPath)) return false;
  var meta = JSON.parse(fs.readFileSync(sudPath));
  var savePath = meta.savePath,
      ranges = meta.ranges;

  for (var index = 0; index < ranges.length; index++) {
    fs.unlinkSync(partialPath(savePath, index));
  }

  fs.unlinkSync(sudPath);
  return true;
}
//# sourceMappingURL=util.js.map