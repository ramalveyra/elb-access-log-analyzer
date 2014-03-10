var root_dir = require('path').dirname(require.main.filename);
var fs = require('fs');
var moment = require('moment');
var configSettings = require(root_dir + '/config/settings');

module.exports.createDirectory = function(dir, callback) {
    fs.exists(dir, function(exists) {
        if(!exists) {
            fs.mkdir(dir, '0755', function(error) {
                if(error) {
                    return callback(error, false);
                }
                return callback(null, true);
            });
        } else {
            return callback(null, true);
        }
    });
};