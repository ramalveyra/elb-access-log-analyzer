var root_dir = require('path').dirname(require.main.filename);
var fs = require('fs');
var configSettings = require(root_dir + '/config/settings');

var KnoxManager = function() {
	this.KNOX = require('knox');

	var client = this.KNOX.createClient({
    	key : configSettings.aws.access_key_id
  		, secret: configSettings.aws.secret_access_key
  		, bucket: configSettings.aws.bucket
	});

	this.listObjects = function(params, callback){
		client.list(params, function(err,data){
			if(err){
		  		return callback(err);
		  	}
		  	return callback(null,data);
		});
	}

	this.getObject = function(params,callback){
		client.getFile(params.Key,function(err,res){
			if(err){
				return callback(err);
			}
			return callback(null, res);
		})
	}

	/*this.getObject = function(params,callback){
		client.get(params.Key).on('response', function(res){
		  //console.log(res.statusCode);
		  //console.log(res.headers);
		  res.setEncoding('utf8');
		  res.on('data', function(chunk){
		    //console.log(chunk);

		  });
		}).end();
	}*/
};

module.exports = new KnoxManager();