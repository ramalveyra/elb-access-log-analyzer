var root_dir = require('path').dirname(require.main.filename);
var configSettings = require(root_dir + '/config/settings');
var logger = require('log4js');
var log_dir = root_dir + '/logs';
moment = require('moment');
var log_name = configSettings.app_log.name + '-' + moment().format('YYYY-MM-DD') + '.log';

logger.configure({
  appenders: [
    { type: 'console' },
    { type: 'file', filename: log_dir +'/'+ log_name, category: 'app_log' }
  ]
});

module.exports = logger;