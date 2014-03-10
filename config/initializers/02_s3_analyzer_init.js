var root_dir = require('path').dirname(require.main.filename);
var configSettings = require(root_dir + '/config/settings');
var applogger = require(root_dir + '/app/resources/logger');
var s3analyzer = require(root_dir + '/app/resources/s3_analyzer');

module.exports = function() {
	//initialize the app logger (for errors and execution logs)
	var date = moment().format('YYYY-MM-DD'); 
	var logger = applogger.getLogger('app_log');

	//call the s3 logger resource
	s3analyzer.generateReport(function(err){
		if(err){
			logger.error('Report generation unsuccessful.');
			logger.info('An error encountered during report generation:');
			logger.error(err);
			logger.info('See log file for more details.');
		}
	});

};