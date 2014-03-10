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
	/*server.listen(port, address, function() {
		var addr = this.address();
		console.log('listening on %s:%d', addr.address, addr.port);
	});*/
});