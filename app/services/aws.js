var root_dir = require('path').dirname(require.main.filename);
var fs = require('fs');
var configSettings = require(root_dir + '/config/settings');

var AWSManager = function() {
	
	this.AWS = require('aws-sdk');

	this.AWS.config.update({
		region: configSettings.aws.region,
		accessKeyId: configSettings.aws.access_key_id,
		secretAccessKey: configSettings.aws.secret_access_key
	});

	//method to fetch the bucket content
	this.listObjects = function(params, callback){
		var s3 = new this.AWS.S3();
		s3.listObjects(params, function(err, data) {
		  if(err){
		  	return callback(err);
		  }
		  return callback(null,data); 
		});
	}

	//method to fetch the object
	this.getObject = function(params, callback){
		var s3 = new this.AWS.S3();
		s3.getObject({Bucket: configSettings.aws.bucket, Key: params.Key}, function(err, res) {
		  if(err){
		  	return callback(err);
		  }
		  return callback(null, this);
		});
	}
};

module.exports = new AWSManager();