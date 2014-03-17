var root_dir = require('path').dirname(require.main.filename);
var configSettings = require(root_dir + '/config/settings');
var async = require('async');
var applogger = require(root_dir + '/app/resources/logger');
var knox = require(root_dir + '/app/services/knox');
var fs = require('fs');
var url = require('url');
var levelup = require('levelup');
var csv = require('csv');
var common = require(root_dir + '/app/resources/common');

this.includePath = (typeof configSettings.exported_report.report_type == 'object')?true:false;
this.reportType = configSettings.exported_report.report_type.path || configSettings.exported_report.report_type;
this.reportTimeStamp = moment();

this.evaluateLog = function(params, callback){
	var self = this;
	var logString = params.logString || null;

	if(logString!==null){
		//convert to array	
		logString = logString.split('\n');

		recurseLog = function(callback,i){
			i = (i==undefined)?0:i;

			if(i<logString.length){
				var uri_pattern = /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/ig;
				var extracted_uri = logString[i].match(uri_pattern);

				if(extracted_uri !== null){
					extracted_uri = url.parse(extracted_uri[0]);

					//store using level
					if(self.includePath){
						var key = extracted_uri.hostname + ',' +extracted_uri.path;
					}else{
						key = extracted_uri.hostname;
					}

					self.db.get(key,function(err, value){
						if(err){
							//not found
							if (err.notFound) {
      							var value = 1
      							self.db.put(key,value,function(err){
      								//proceed to next;
      								return recurseLog(callback,i+1);
      							});
    						}else{
    							// I/O or other error, pass it up the callback chain
    							return callback(err)	
    						}
						}else{
							value+=1;
							
    						self.db.put(key,value,function(err){
      							//proceed to next;
      							return recurseLog(callback,i+1);
      						});
    					}
					});	

				}else{
					recurseLog(callback,i+1)	
				}
			}else{
				return callback();
			}
		};
		recurseLog(callback);
	}else{
		return callback();
	}
}

//exports the report to csv
this.exportReport = function(params, callback){
	
};

exports.generateReport = function(next){
	var self = this;
	//some init
	moment = require('moment');
	var logger = applogger.getLogger('app_log');

	//start the process
	self.startProcess = process.hrtime();
	
	logger.info('ELB Access Log Analyzer Initiated...');

	async.waterfall(
	[
		//cleanup first
		function(callback){
			//Destroy the db
			require('leveldown').destroy('db', function (err) {
				logger.info('Cleaning up old files...');
				return callback();
			})
		},
		//initialize level
		function(callback){
			logger.info('Initiating leveldb...')
			self.db = levelup('db',{ valueEncoding: 'json', keyEncoding : 'json' });
			return callback();
		},
		//create the db directory if it does not exits yet
		function(callback){
			common.createDirectory('db',function(err){
				if(err)return callback(err);
				return callback();
			})
		},
		//create the reports folder
		function(callback){
			common.createDirectory('reports',function(err){
				if(err)return callback(err);
				return callback();
			})
		},
		//create report tmp folder
		function(callback){
			common.createDirectory('reports/'+self.reportTimeStamp,function(err){
				if(err)return callback(err);
				return callback();
			})
		},
		//Fetch the S3 logs
		function(callback){
			logger.info('Connecting to S3 log directory ...');
			logger.info('Fetching logs ...');

			var current_date_str = configSettings.log_filters.date_folder || moment().format('YYYY/MM/DD');
			current_date_str = '/' + current_date_str;

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
			var elb_analyzer = self;

			var recurseBucket = function(callback, index){
				if(index == undefined)
					index = 0;
				if(index == data.Contents.length){
					//end the recursion. proceed to next waterfall
					return callback(null);
				}else{
					if(data.Contents[index].Key.match('.log$')){
						
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
								elb_analyzer.evaluateLog({logString : objectBuffer},function(){
									//proceed to next object
									recurseBucket(callback,index+1);
								});
							});
						});
					}else{
						//not a log file, proceed
						recurseBucket(callback,index+1);
					}
				}
			}
			//start the recursion
			recurseBucket(callback);
		},
		function(callback){
			//preparing the report
			logger.info('Preparing the report...');
			
			var csvReportFile = 'reports/' + self.reportTimeStamp + '/' + configSettings.exported_report.name_prefix + '.csv';
			
			if(configSettings.exported_report.report_type.path == 'singleFile'){
				var columns = ['domainName', 'path', 'pathCount'];
				//init the report
				csv().from('',{columns : columns})
				.to(csvReportFile,{flags : 'w',eof:true,header:true})
				.on('close',function(){
					csvReadStream = self.db.createReadStream()
						.on('data',function(data){
							//var csvLine = [{domainName : data.key, totalDomainCount: data.value}];
							var domain_path = data.key.split(',');
							var csvLine = [{domainName : domain_path[0], path: domain_path[1], pathCount: data.value}];
							csvReadStream.pause();
							csv().from(csvLine,{columns : columns})
							.to(csvReportFile,{flags : 'a',eof:true})
							.on('close',function(){
								csvReadStream.resume();
							})
						})
						.on('close',function(){
							return callback();
						})
				});
			}else if(configSettings.exported_report.report_type.path == 'multiFile'){
				columns = ['domainName', 'path', 'pathCount'];
				var prevDomain; 
				csvReadStream = self.db.createReadStream()
				.on('data',function(data){
					domain_path = data.key.split(',');
					var csvLine = [{domainName : domain_path[0], path: domain_path[1], pathCount: data.value}];

					csvReadStream.pause();
					if(domain_path[0] !== prevDomain){
						//create a new csv
						csv().from(csvLine,{columns : columns})
						.to('reports/'+self.reportTimeStamp+'/'+domain_path[0]+'.csv',{flags : 'w',eof:true,header:true})
						.on('close',function(){
							prevDomain = domain_path[0];
							csvReadStream.resume();
						})
					}else{
						//append to domain csv
						csv().from(csvLine,{columns : columns})
						.to('reports/'+self.reportTimeStamp+'/'+domain_path[0]+'.csv',{flags : 'a',eof:true})
						.on('close',function(){
							csvReadStream.resume();
						})
					}
				})
				.on('close',function(){
					return callback();
				})
			}else{
				columns = ['domainName', 'totalDomainCount'];
				csv().from('',{columns : columns})
				.to(csvReportFile,{flags : 'w',eof:true,header:true})
				.on('close',function(){
					csvReadStream = self.db.createReadStream()
						.on('data',function(data){
							var csvLine = [{domainName : data.key, totalDomainCount: data.value}];
							csvReadStream.pause();
							csv().from(csvLine,{columns : columns})
							.to(csvReportFile,{flags : 'a',eof:true})
							.on('close',function(){
								csvReadStream.resume();
							})
						})
						.on('close',function(){
							return callback();
						})
				});
			}
		}
	],
	function(err){
		if(err){
			return next(err);
		}
		//Done!
		self.endProcess = process.hrtime(self.startProcess);
    	var duration = self.endProcess[0] + '.' + self.endProcess[1];
    	var elapsedFormat = moment().startOf('day').add('seconds',duration);
    	logger.info('Report file generated.','See \'/reports/'+self.reportTimeStamp+'/\' for the CSV.',
    		'Time elapsed: ', elapsedFormat.format('H [hours,]'), 
    		elapsedFormat.format('mm [minutes,]'), 
    		(duration < 60 ? duration + ' seconds' : elapsedFormat.format('s [seconds]')));
    	logger.info('Log details available in:\'logs/'+applogger.log_name+'\'');
    	return next();
		
  	});
}