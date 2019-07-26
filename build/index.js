"use strict";

var _downloader = require("./downloader");

var _scheduler = _interopRequireDefault(require("./scheduler"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  startDownload: _downloader.startDownload,
  killFiles: _downloader.killFiles,
  sudPath: _downloader.sudPath,
  SuDScheduler: _scheduler.default
};
//# sourceMappingURL=index.js.map