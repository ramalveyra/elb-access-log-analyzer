var locomotive = require('locomotive'),
	os = require('os'),
	nconf = require('nconf').argv().env(),
	env = (typeof nconf.get('NODE_ENV') !== 'undefined' ? nconf.get('NODE_ENV') : 'default' ),
	port = process.env.PORT || 3000,
	address = '0.0.0.0';
    
var root_dir = require('path').dirname(require.main.filename);

locomotive.boot(__dirname, env, function(err, server) {
	// Basic Error Handler
	if (err) { throw err; }
	var common = require(root_dir + '/app/resources/common');
		common.createDirectory('logs',function(err, success){
			if(err){
				return callback(err);
			}
			var moment = require('moment');
			var date = moment().format('YYYY-MM-DD');
			
			var configSettings = require(root_dir + '/config/settings');
			var elb_analyzer = require(root_dir + '/app/resources/elb_analyzer'); 
			var applogger = require(root_dir + '/app/resources/logger');

			var logger = applogger.getLogger('app_log');

			//call the s3 logger resource
			elb_analyzer.generateReport(function(err){
				if(err){
					logger.error('Report generation unsuccessful.');
					logger.info('An error encountered during report generation:');
					logger.error(err);
					logger.info('See log file for more details.');
				}
			});
		});
});