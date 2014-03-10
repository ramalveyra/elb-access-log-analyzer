var nconf = require('nconf');
nconf.argv().env();
var env = (typeof nconf.get('NODE_ENV') !== 'undefined' ? nconf.get('NODE_ENV') : 'default' );
var config_file = process.cwd() + '/config/config.json';
nconf.use('file', { file: config_file});

var config = nconf.get(env);

module.exports = config;