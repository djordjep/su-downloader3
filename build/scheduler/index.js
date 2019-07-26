"use strict";

var _downloader = require("../downloader/");

var _temp, _taskQueue, _downloadSubscriptions, _countStatus, _countTasks, _keyIsUnique, _canStartNext, _startNextInQueue, _tryNextInQueue, _getTaskQueueItem, _removeTaskQueueItem, _wrapInternalObserver, _countStatus2, _countTasks2, _keyIsUnique2, _canStartNext2, _startNextInQueue2, _tryNextInQueue2, _getTaskQueueItem2, _removeTaskQueueItem2, _wrapInternalObserver2;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _classPrivateFieldLooseBase(receiver, privateKey) { if (!Object.prototype.hasOwnProperty.call(receiver, privateKey)) { throw new TypeError("attempted to use private field on non-instance"); } return receiver; }

var id = 0;

function _classPrivateFieldLooseKey(name) { return "__private_" + id++ + "_" + name; }

var SuDScheduler = (_temp =
/*#__PURE__*/
function () {
  //holds all download tasks as objects with status and params fields
  //holds objects that have a key and a subscription field
  //the subscription field holds the flowing download subscription
  //set maxConcurrentDownloads to 0 for unlimited concurrent downloads
  function SuDScheduler() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$autoStart = _ref.autoStart,
        autoStart = _ref$autoStart === void 0 ? true : _ref$autoStart,
        _ref$maxConcurrentDow = _ref.maxConcurrentDownloads,
        _maxConcurrentDownloads = _ref$maxConcurrentDow === void 0 ? 4 : _ref$maxConcurrentDow,
        _ref$downloadOptions = _ref.downloadOptions,
        downloadOptions = _ref$downloadOptions === void 0 ? {} : _ref$downloadOptions;

    _classCallCheck(this, SuDScheduler);

    Object.defineProperty(this, _wrapInternalObserver, {
      value: _wrapInternalObserver2
    });
    Object.defineProperty(this, _removeTaskQueueItem, {
      value: _removeTaskQueueItem2
    });
    Object.defineProperty(this, _getTaskQueueItem, {
      value: _getTaskQueueItem2
    });
    Object.defineProperty(this, _tryNextInQueue, {
      value: _tryNextInQueue2
    });
    Object.defineProperty(this, _startNextInQueue, {
      value: _startNextInQueue2
    });
    Object.defineProperty(this, _canStartNext, {
      value: _canStartNext2
    });
    Object.defineProperty(this, _keyIsUnique, {
      value: _keyIsUnique2
    });
    Object.defineProperty(this, _countTasks, {
      value: _countTasks2
    });
    Object.defineProperty(this, _countStatus, {
      value: _countStatus2
    });
    Object.defineProperty(this, _taskQueue, {
      writable: true,
      value: []
    });
    Object.defineProperty(this, _downloadSubscriptions, {
      writable: true,
      value: {}
    });
    this.options = {};
    this.options.autoStart = autoStart;
    this.options.maxConcurrentDownloads = _maxConcurrentDownloads;
    this.options.downloadOptions = downloadOptions;
  } //PUBLIC METHODS
  //returns the task queue


  _createClass(SuDScheduler, [{
    key: "queueDownload",
    //adds a download task to the queue
    //an observer object MUST be provided as the 3rd or 4th positional argument
    //this method is used to add new downloads or resume from pre existing .sud files
    //if the intention is to queue a download from a pre existing .sud file, locations should be
    //the .sud file path and options.threads will be unnecessary
    //key should be unique
    value: function queueDownload(key, locations, options, userObserver) {
      var _this = this;

      if (!_classPrivateFieldLooseBase(this, _keyIsUnique)[_keyIsUnique](key)) throw 'KEYS MUST BE UNIQUE'; //if options is omitted, assume it is the observer

      if (options.next) var userObserver = options;
      var taskQueueItem = {
        key: key,
        status: 'queued',
        params: {
          locations: locations,
          options: options.next ? {} : options
        },
        userObserver: userObserver
      };

      _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].push(taskQueueItem);

      _classPrivateFieldLooseBase(this, _tryNextInQueue)[_tryNextInQueue]();

      if (!this.options.autoStart) {
        //convenience object to allow the user to dot chain start()
        return {
          start: function start() {
            return _this.startDownload(key);
          }
        };
      }

      return true;
    } //starts a download task, or resumes an active download
    //starting a new download task using this methods will ignore
    //the max concurrent download limit
    //returns false if a download task with the provided key doesn't exist
    //returns true otherwise

  }, {
    key: "startDownload",
    value: function startDownload(key) {
      var taskQueueItem = _classPrivateFieldLooseBase(this, _getTaskQueueItem)[_getTaskQueueItem](key);

      if (!taskQueueItem) return false;
      var userObserver = taskQueueItem.userObserver,
          _taskQueueItem$params = taskQueueItem.params,
          locations = _taskQueueItem$params.locations,
          options = _taskQueueItem$params.options;
      taskQueueItem.status = 'active';

      var wrappedObserver = _classPrivateFieldLooseBase(this, _wrapInternalObserver)[_wrapInternalObserver](key, userObserver);

      var dlOptions = Object.assign(this.options.downloadOptions, options);
      var dlSubscription = (0, _downloader.startDownload)(locations, dlOptions).subscribe(wrappedObserver);
      _classPrivateFieldLooseBase(this, _downloadSubscriptions)[_downloadSubscriptions][key] = dlSubscription;
      return true;
    } //pauses an active download and stops if the second parameter is true
    //an active download that is paused is still considered active
    //stopping a download task allows for more tasks to be auto started
    //as a stopped task is not considered active
    //returns false if the download task is already paused/stopped or has not yet started or does not exist
    //returns true otherwise

  }, {
    key: "pauseDownload",
    value: function pauseDownload(key) {
      var stop = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      var taskQueueItem = _classPrivateFieldLooseBase(this, _getTaskQueueItem)[_getTaskQueueItem](key);

      var dlSubscription = _classPrivateFieldLooseBase(this, _downloadSubscriptions)[_downloadSubscriptions][key];

      if (!dlSubscription || !taskQueueItem) return false;
      taskQueueItem.status = stop ? 'stopped' : taskQueueItem.status;
      dlSubscription.unsubscribe();
      delete _classPrivateFieldLooseBase(this, _downloadSubscriptions)[_downloadSubscriptions][key];

      _classPrivateFieldLooseBase(this, _tryNextInQueue)[_tryNextInQueue]();

      return true;
    } //stops an active download and removes associated .sud and .PARTIAL files, or
    //removes queued download task from queue
    //returns false if a download task with the provided key doesn't exist
    //returns true otherwise

  }, {
    key: "killDownload",
    value: function killDownload(key) {
      var taskQueueItem = _classPrivateFieldLooseBase(this, _getTaskQueueItem)[_getTaskQueueItem](key);

      if (!taskQueueItem) return false;
      var status = taskQueueItem.status;

      var dlSubscription = _classPrivateFieldLooseBase(this, _downloadSubscriptions)[_downloadSubscriptions][key];

      if (dlSubscription) {
        _classPrivateFieldLooseBase(this, _downloadSubscriptions)[_downloadSubscriptions][key].unsubscribe();

        delete _classPrivateFieldLooseBase(this, _downloadSubscriptions)[_downloadSubscriptions][key];
      }

      _classPrivateFieldLooseBase(this, _removeTaskQueueItem)[_removeTaskQueueItem](key);

      (0, _downloader.killFiles)(key);

      _classPrivateFieldLooseBase(this, _tryNextInQueue)[_tryNextInQueue]();

      return true;
    } //starts downloading as many as possible, limited by the maxConcurrentDownloads option

  }, {
    key: "startQueue",
    value: function startQueue() {
      _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].forEach(function (taskQueueItem) {
        if (taskQueueItem.status == 'stopped') {
          taskQueueItem.status = 'queued';
        }
      });

      var activeCount = _classPrivateFieldLooseBase(this, _countStatus)[_countStatus]('active');

      var maxConcurrentDownloads = this.options.maxConcurrentDownloads;

      while (activeCount < maxConcurrentDownloads && _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue][activeCount + 1]) {
        var _classPrivateFieldLoo = _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue][activeCount],
            key = _classPrivateFieldLoo.key,
            status = _classPrivateFieldLoo.status;

        if (status == 'active') return;
        this.startDownload(key);
        activeCount++;
      }
    } //pauses/stops all active downloads

  }, {
    key: "pauseAll",
    value: function pauseAll() {
      var _this2 = this;

      var stop = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

      _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].forEach(function (taskQueueItem) {
        return _this2.pauseDownload(taskQueueItem.key, stop);
      });
    } //returns the status of the download task associated with the provided key or false if the download task doesn't exist

  }, {
    key: "getStatus",
    value: function getStatus(key) {
      var taskQueueItem = _classPrivateFieldLooseBase(this, _getTaskQueueItem)[_getTaskQueueItem](key);

      if (!taskQueueItem) return false;
      return taskQueueItem.status;
    } //PRIVATE METHODS

  }, {
    key: "taskQueue",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue];
    }
  }, {
    key: "queuedCount",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _countTasks)[_countTasks]('queued');
    }
  }, {
    key: "activeCount",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _countTasks)[_countTasks]('active');
    }
  }, {
    key: "stoppedCount",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _countTasks)[_countTasks]('stopped');
    }
  }, {
    key: "taskCount",
    get: function get() {
      return _classPrivateFieldLooseBase(this, _countTasks)[_countTasks]();
    }
  }]);

  return SuDScheduler;
}(), _taskQueue = _classPrivateFieldLooseKey("taskQueue"), _downloadSubscriptions = _classPrivateFieldLooseKey("downloadSubscriptions"), _countStatus = _classPrivateFieldLooseKey("countStatus"), _countTasks = _classPrivateFieldLooseKey("countTasks"), _keyIsUnique = _classPrivateFieldLooseKey("keyIsUnique"), _canStartNext = _classPrivateFieldLooseKey("canStartNext"), _startNextInQueue = _classPrivateFieldLooseKey("startNextInQueue"), _tryNextInQueue = _classPrivateFieldLooseKey("tryNextInQueue"), _getTaskQueueItem = _classPrivateFieldLooseKey("getTaskQueueItem"), _removeTaskQueueItem = _classPrivateFieldLooseKey("removeTaskQueueItem"), _wrapInternalObserver = _classPrivateFieldLooseKey("wrapInternalObserver"), _countStatus2 = function _countStatus2(status) {
  return _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].filter(function (taskQueueItem) {
    return taskQueueItem.status == status;
  }).length;
}, _countTasks2 = function _countTasks2() {
  return _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].length;
}, _keyIsUnique2 = function _keyIsUnique2(key) {
  return _classPrivateFieldLooseBase(this, _getTaskQueueItem)[_getTaskQueueItem](key) == undefined;
}, _canStartNext2 = function _canStartNext2() {
  var maxConcurrentDownloads = this.options.maxConcurrentDownloads;
  var nextExists = _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].findIndex(function (taskQueueItem) {
    return taskQueueItem.status == 'queued';
  }) != -1;
  return (maxConcurrentDownloads == 0 || _classPrivateFieldLooseBase(this, _countStatus)[_countStatus]('active') < maxConcurrentDownloads) && nextExists;
}, _startNextInQueue2 = function _startNextInQueue2() {
  var _classPrivateFieldLoo2 = _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].find(function (taskQueueItem) {
    return taskQueueItem.status == 'queued';
  }),
      key = _classPrivateFieldLoo2.key;

  this.startDownload(key);
}, _tryNextInQueue2 = function _tryNextInQueue2() {
  if (this.options.autoStart && _classPrivateFieldLooseBase(this, _canStartNext)[_canStartNext]()) {
    _classPrivateFieldLooseBase(this, _startNextInQueue)[_startNextInQueue]();
  }
}, _getTaskQueueItem2 = function _getTaskQueueItem2(key) {
  return _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].find(function (taskQueueItem) {
    return taskQueueItem.key == key;
  });
}, _removeTaskQueueItem2 = function _removeTaskQueueItem2(key) {
  var index = _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].findIndex(function (taskQueueItem) {
    return taskQueueItem.key == key;
  });

  _classPrivateFieldLooseBase(this, _taskQueue)[_taskQueue].splice(index, 1);
}, _wrapInternalObserver2 = function _wrapInternalObserver2(key, userObservable) {
  var _this3 = this;

  var taskQueueItem = _classPrivateFieldLooseBase(this, _getTaskQueueItem)[_getTaskQueueItem](key);

  var status = taskQueueItem.status;
  return {
    next: userObservable.next,
    error: userObservable.error,
    complete: function complete() {
      userObservable.complete(); //remove the useless dead subscription and internal reference

      _classPrivateFieldLooseBase(_this3, _removeTaskQueueItem)[_removeTaskQueueItem](key);

      delete _classPrivateFieldLooseBase(_this3, _downloadSubscriptions)[_downloadSubscriptions][key]; //emit event for empty queue

      _classPrivateFieldLooseBase(_this3, _tryNextInQueue)[_tryNextInQueue]();
    }
  };
}, _temp);
module.exports = SuDScheduler;
//# sourceMappingURL=index.js.map