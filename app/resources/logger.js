var root_dir = require('path').dirname(require.main.filename);
var configSettings = require(root_dir + '/config/settings');
var logger = require('log4js');
var log_dir = root_dir + '/logs';
moment = require('moment');
var log_name = configSettings.app_log.name + '_' + moment() + '.log';

logger.configure({
  appenders: [
    { type: 'console' },
    { type: 'file', filename: log_dir +'/'+ log_name, category: 'app_log' }
  ]
});

logger.log_name = log_name;

module.exports = logger;