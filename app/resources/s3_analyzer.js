var root_dir = require('path').dirname(require.main.filename);
var configSettings = require(root_dir + '/config/settings');
var async = require('async');
var applogger = require(root_dir + '/app/resources/logger');
var knox = require(root_dir + '/app/services/knox');
var fs = require('fs');
//var aws = require(root_dir + '/app/services/aws');
var url = require('url');
var json2csv = require('json2csv');
var common = require(root_dir + '/app/resources/common');

this.reportObject = {
	'totalDomains' : 0,
	'domains' : {}
};

this.reportObjectTmp = [];

this.evaluateLog = function(params, callback){
	var self = this;
	var logString = params.logString || null;

	//check config for paths
	var includePath = (typeof configSettings.exported_report.report_type == 'object')?true:false;
	
	if(logString!==null){
		//convert to array	
		logString = logString.split('\n');

		for(var i in logString){

			//extract the url
			var uri_pattern = /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/ig;

			var extracted_uri = logString[i].match(uri_pattern);

			if(extracted_uri !== null){
				extracted_uri = url.parse(extracted_uri[0]);
				//check and add in domains list if it does not exists
				if(self.reportObject.domains[extracted_uri.hostname] == undefined){
					self.reportObject.domains[extracted_uri.hostname] = {
						totalDomainCount : 1
					};
					//add paths (if set in option)
					if(includePath){
						self.reportObject.domains[extracted_uri.hostname]['paths']= {};
						self.reportObject.domains[extracted_uri.hostname]['paths'][extracted_uri.path] = {pathCount : 1}
					}
					self.reportObject.totalDomains+=1;
				}else{
					//increment domain count
					self.reportObject.domains[extracted_uri.hostname].totalDomainCount+=1;

					//check path (if set in option)
					if(includePath){
						if(self.reportObject.domains[extracted_uri.hostname]['paths'][extracted_uri.path] == undefined){
							//new path
							self.reportObject.domains[extracted_uri.hostname]['paths'][extracted_uri.path] = {pathCount : 1}
						}else{
							//increment path count
							self.reportObject.domains[extracted_uri.hostname]['paths'][extracted_uri.path].pathCount+=1
						}
					}
				}
			}
		}
		return callback();
	}
	return callback();
}

//exports the report to csv
this.exportReport = function(params, callback){
	json2csv({
		data: params.reportArray, 
		fields: (params.reportFields)}, 
		function(err, csv) {
			if (err) return callback(err);
			fs.writeFile(params.reportFile, csv, function(err) {
	    		if (err) return callback(err);
	    			return callback();
	  			});
	});
};

exports.generateReport = function(next){
	var self = this;
	//some init
	moment = require('moment');
	var date = moment().format('YYYY-MM-DD'); 
	var logger = applogger.getLogger('app_log');

	//check config for paths
	var includePath = (typeof configSettings.exported_report.report_type == 'object')?true:false;

	//start the process
	self.startProcess = process.hrtime();
	
	logger.info('S3 Log Analyzer Initiated...');

	async.waterfall(
	[
		//Fetch the S3 logs
		function(callback){
			logger.info('Connecting to S3 log directory ...');
			logger.info('Fetching logs ...');

			//limit objects processing to the current date
			var current_date_str = '/' + moment().format('YYYY/MM/DD');

			var params = {
				'prefix' : configSettings.aws.folder + configSettings.aws.region + current_date_str,
				'max-keys' : configSettings.log_filters.max_keys
			}

			knox.listObjects(params,function(err, data){
				if(err){
					return callback(err);
				}
				return callback(null, data);
			});

		},
		// Analyze the logs
		function(data, callback){
			var s3_analyzer = self;

			var recurseBucket = function(callback, index){
				if(index == undefined)
					index = 0;
				if(index == data.Contents.length){
					//end the recursion. proceed to next waterfall
					return callback(null);
				}else{
					if(data.Contents[index].Key.match('.log$')){
						var current_date_str = moment().format('YYYY/MM/DD');
						var tmpLogKey = data.Contents[index].Key;

						logger.info('Processing \''+ tmpLogKey +'\'');
						
						//set object buffer
						var objectBuffer = '';
						//get the object
						knox.getObject({'Key':tmpLogKey},function(err,res){
							if(err){
								return callback(err);
							}
							res.setEncoding('utf8');
							res.on('data', function(chunk){
								//build the chunk
								objectBuffer+=chunk.toString();
							});
							res.on('end',function(){
								s3_analyzer.evaluateLog({logString : objectBuffer},function(){
									//proceed to next object
									recurseBucket(callback,index+1);
								});
							})
						});
					}else{
						//not a log file, proceed
						recurseBucket(callback,index+1);
					}
				}
			}
			//start the recursion
			recurseBucket(callback);
		}
	],
	function(err){
		if(err){
			return next(err);
		}

		//prepare the report
		var reportArray = [];
		var reportHeader = {
			'by_domain' : ['domainName', 'totalDomainCount'],
			'by_path'	: ['domainName', 'path' , 'pathCount']
		}

		for(var domain in self.reportObject.domains){
			//if paths are enabled
			if(self.reportObject.domains[domain].paths !== undefined && includePath){
				for(var path in self.reportObject.domains[domain].paths){
					reportArray.push({
						'domainName' : domain,
						'path'	: path,
						'pathCount' : self.reportObject.domains[domain].paths[path].pathCount
					});
				}
			}else{
				reportArray.push({
					'domainName' : domain,
					'totalDomainCount' : self.reportObject.domains[domain].totalDomainCount
				});
			}
		}
		
		logger.info('Generating report file ...');

		var reportTimeStamp = moment();

		var reportType = 'domain (default)';

		if(includePath){
			reportType = 'path - ' + configSettings.exported_report.report_type.path;
		}

		logger.info('Report type option:',reportType);

		if(configSettings.exported_report.report_type == 'domain' || configSettings.exported_report.report_type.path == 'singleFile'){
			var exportReportParams = {
				reportFile : 'reports/' + reportTimeStamp + '/' + configSettings.exported_report.name_prefix + '.csv',
				reportArray : reportArray,
				reportFields : (configSettings.exported_report.report_type == 'domain' ? reportHeader['by_domain'] : reportHeader['by_path'])
			}

			//create the report timestamp directory if it does not exists
			common.createDirectory('reports/' + reportTimeStamp,function(err, success){
				if(err){
					return next(err);
				}
				//generate the report csv
				self.exportReport(exportReportParams,function(err){
					if(err) return next(err);
					self.endProcess = process.hrtime(self.startProcess);
			    	var duration = self.endProcess[0] + '.' + self.endProcess[1];
			    	var elapsedFormat = moment().startOf('day').add('seconds',duration)
			    	logger.info('Report file generated.','See \''+exportReportParams.reportFile+'\'',
			    		'Time elapsed: ', elapsedFormat.format('H [hours,]'), 
			    		elapsedFormat.format('mm [minutes,]'), 
			    		(duration < 60 ? duration + ' seconds' : elapsedFormat.format('s [seconds]')));
			    	logger.info('Log available in:\'logs/'+applogger.log_name+'\'');
			    	return next();
				});
			});

		}else if(configSettings.exported_report.report_type.path == 'multiFile'){
			//generate reports per domain

			//recurse through domains on reportArray

			var prevDomain = reportArray[0].domainName; //set the first domain
			var domainArr = []; //domains buffer
			
			var recurseDomain = function(callback,index){
				
				if(index==reportArray.length){
					//I'm done
					self.endProcess = process.hrtime(self.startProcess);
			    	var duration = self.endProcess[0] + '.' + self.endProcess[1];
			    	var elapsedFormat = moment().startOf('day').add('seconds',duration)
			    	logger.info('Report files generated.','See \'reports/'+reportTimeStamp+'\' folder for reports per domain',
			    		'Time elapsed: ', elapsedFormat.format('H [hours,]'), 
			    		elapsedFormat.format('mm [minutes,]'), 
			    		(duration < 60 ? duration + ' seconds' : elapsedFormat.format('s [seconds]')));
			    	logger.info('Log available in:\'logs/'+applogger.log_name+'\'');
					return callback();
				}
				if(reportArray[index].domainName == prevDomain){
					//queue domain
					domainArr.push(reportArray[index]);
					recurseDomain(callback,index+1);
				}else{
					//generate the report csv
					//this is a new one, create a new file from prevDomain
					//single path found, reference the previous array
					if(domainArr.length == 0){
						domainArr.push(reportArray[index-1]);
					}
					//create the report timestamp directory if it does not exists
					common.createDirectory('reports/' + reportTimeStamp,function(err, success){
						if(err){
							return callback(err);
						}
						var exportReportParams = {
							reportFile : 'reports/' + reportTimeStamp + '/' + prevDomain + '.csv',
							reportArray : domainArr,
							reportFields : reportHeader['by_path']
						}
						self.exportReport(exportReportParams,function(err){
							if(err) return callback(err);
							//reset prevDomain
							prevDomain = reportArray[index].domainName;
							//flush the domain buffer
							domainArr = [];
							//done report proceed to next log
							recurseDomain(callback,index+1);
						});
					});
				}
			};

			var domainArr = [];

			recurseDomain(next,0);
		}
  	});
}