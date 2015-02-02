var test = require('tape');
var OpenPostcodes = require('../lib');
var http = require('http');
var https = require('https');
var qs = require('querystring');
var events = require('events');
var util = require('util');

test('correct types exported', function (t) {
	t.equal(typeof OpenPostcodes, 'function');
	t.equal(typeof OpenPostcodes.prototype.lookupPostcode, 'function');
	t.equal(typeof OpenPostcodes.prototype.postcodeForLocation, 'function');

	t.end();
});

test('correct types after initialization', function (t) {
	var client = new OpenPostcodes('api-key');

	t.assert(client instanceof OpenPostcodes);
	t.equal(typeof client.lookupPostcode, 'function');
	t.equal(typeof client.postcodeForLocation, 'function');

	t.end();
});

test('correct types after calling as function', function (t) {
	var client = OpenPostcodes('api-key');

	t.assert(client instanceof OpenPostcodes);
	t.equal(typeof client.lookupPostcode, 'function');
	t.equal(typeof client.postcodeForLocation, 'function');

	t.end();
});

test('initializing without api key causes exception', function (t) {
	t.plan(1);

	t.throws(function () {
		var client = new OpenPostcodes();
	});
});

test('api key set correctly after initialization', function (t) {
	var client = new OpenPostcodes('some-arbitrary-api-key');

	t.equal(client.apiKey, 'some-arbitrary-api-key');

	t.end();
});

test('default options set after initialization', function (t) {
	var client = new OpenPostcodes('api-key');

	t.notEqual(client.options, null);
	t.equal(client.options.secure, true);
	t.equal(client.options.hostname, 'api.openpostcodes.com');
	t.equal(client.options.port, 443);
	t.deepEqual(client.options.headers, { 'Accept': 'application/json' });

	t.end();
});

test('options overridden after initialization with options', function (t) {
	var opts = {
		secure: false,
		hostname: 'example.com',
		port: 8246,
		headers: { 'Accept': 'text/xml' }
	};

	var client = new OpenPostcodes('api-key', opts);

	t.notEqual(client.options, null);
	t.deepEqual(client.options, opts);

	t.end();
});

test('correct options after initialization with secure as false', function (t) {
	var opts = {
		secure: false,
		hostname: 'example.com'
	};

	var client = new OpenPostcodes('api-key', opts);

	t.notEqual(client.options, null);
	t.equal(client.options.secure, opts.secure);
	t.equal(client.options.hostname, opts.hostname);
	t.equal(client.options.port, 80);
	t.equal(client._proto, http);

	t.end();
});

test('correct options after initialization with secure as true', function (t) {
	var opts = {
		secure: true,
		hostname: 'example.com'
	};

	var client = new OpenPostcodes('api-key', opts);

	t.notEqual(client.options, null);
	t.equal(client.options.secure, opts.secure);
	t.equal(client.options.hostname, opts.hostname);
	t.equal(client.options.port, 443);
	t.equal(client._proto, https);

	t.end();
});

test('correct headers after initialization with custom headers', function (t) {
	var opts = {
		headers: { 'Authorization': 'Bearer foobar' }
	};

	var client = new OpenPostcodes('api-key', opts);

	t.notEqual(client.options, null);

	t.deepEqual(client.options.headers, {
		'Accept': 'application/json',
		'Authorization': 'Bearer foobar'
	});

	t.end();
});

test('correct options used for when looking up postcode', function (t) {
	t.plan(3);

	var client = new OpenPostcodes('foobar');
	var origProto = client._proto;

	client._proto = {
		request: function (options, callback) {
			t.equal(typeof callback, 'function');
			t.equal(options.method, 'get');
			t.equal(options.path, '/v1/postcodes/EC1V%209LB?api_key=foobar');

			var req = function () {}
			util.inherits(req, events.EventEmitter);
			req.prototype.end = function () {};
			return new req();
		}
	}

	client.lookupPostcode('EC1V 9LB');
	client._proto = origProto;
});

test('correct options used for when looking up location', function (t) {
	t.plan(4);

	var client = new OpenPostcodes('foobar');
	var origProto = client._proto;

	client._proto = {
		request: function (options, callback) {
			t.equal(typeof callback, 'function');
			t.equal(options.method, 'get');

			var parts = options.path.split('?');
			t.equal(parts[0], '/v1/postcodes');

			t.deepEqual(qs.parse(parts[1]), {
				api_key: 'foobar',
				lonlat: '-0.23,53.5',
				limit: '1',
				radius: '1000'
			});

			return {
				end: function () {},
				on: function () {}
			};
		}
	}

	client.postcodeForLocation(53.5, -0.23);
	client._proto = origProto;
});

test('correctly handles request error', function (t) {
	t.plan(2);

	var client = new OpenPostcodes('foobar');
	var origProto = client._proto;

	var fakeError = new Error('qwerty');

	client._proto = {
		request: function (options, callback) {
			t.equal(typeof callback, 'function');

			var req = function () {}
			req.prototype = Object.create(require('events').EventEmitter.prototype);
			req.prototype.end = function () {};
			var reqInst = new req();

			setTimeout(function () {
				reqInst.emit('error', fakeError);
			}, 10);

			return reqInst;
		}
	}

	client
		.postcodeForLocation(53.5, -0.23)
		.fail(function (error) {
			t.equal(error, fakeError);
		});

	client._proto = origProto;
});

test('correctly handles invalid json', function (t) {
	t.plan(3);

	var client = new OpenPostcodes('foobar');
	var origProto = client._proto;

	client._proto = {
		request: function (options, callback) {
			t.equal(typeof callback, 'function');

			setTimeout(function () {
				var res = function () {}
				res.prototype = Object.create(require('events').EventEmitter.prototype);

				res.prototype.setEncoding = function (encoding) {
					t.equal(encoding, 'utf8');
				}

				var resInst = new res();
				callback(resInst);

				setTimeout(function () {
					resInst.emit('data', ';{]]');
					resInst.emit('end');
				}, 10);
			}, 10);

			return {
				end: function () {},
				on: function () {}
			};
		}
	}

	client
		.postcodeForLocation(53.5, -0.23)
		.fail(function (error) {
			t.equal(error.message, 'Invalid JSON');
		});

	client._proto = origProto;
});

test('correctly handles failed request', function (t) {
	t.plan(5);

	var client = new OpenPostcodes('foobar');
	var origProto = client._proto;

	client._proto = {
		request: function (options, callback) {
			t.equal(typeof callback, 'function');

			setTimeout(function () {
				var res = function () {}
				res.prototype = Object.create(require('events').EventEmitter.prototype);

				res.prototype.setEncoding = function (encoding) {
					t.equal(encoding, 'utf8');
				}

				var resInst = new res();
				resInst.statusCode = 401;
				callback(resInst);

				setTimeout(function () {
					resInst.emit('data', '{"message":"foo","code":4010}');
					resInst.emit('end');
				}, 10);
			}, 10);

			return {
				end: function () {},
				on: function () {}
			};
		}
	}

	client
		.lookupPostcode('EC1V 9LB')
		.fail(function (error) {
			t.equal(error.message, 'foo (4010)');
			t.equal(error.code, 401);
			t.equal(error.statusCode, 401);
		});

	client._proto = origProto;
});

test('correctly handles empty array', function (t) {
	t.plan(3);

	var client = new OpenPostcodes('foobar');
	var origProto = client._proto;

	client._proto = {
		request: function (options, callback) {
			t.equal(typeof callback, 'function');

			setTimeout(function () {
				var res = function () {}
				res.prototype = Object.create(require('events').EventEmitter.prototype);

				res.prototype.setEncoding = function (encoding) {
					t.equal(encoding, 'utf8');
				}

				var resInst = new res();
				resInst.statusCode = 404;
				callback(resInst);

				setTimeout(function () {
					resInst.emit('data', '{"message":"foo","code":4040}');
					resInst.emit('end');
				}, 10);
			}, 10);

			return {
				end: function () {},
				on: function () {}
			};
		}
	}

	client
		.lookupPostcode('EC1V 9LB')
		.then(function (data) {
			t.deepEqual(data, []);
		});

	client._proto = origProto;
});

test('correctly handles success', function (t) {
	t.plan(3);

	var client = new OpenPostcodes('foobar');
	var origProto = client._proto;

	client._proto = {
		request: function (options, callback) {
			t.equal(typeof callback, 'function');

			setTimeout(function () {
				var res = function () {}
				res.prototype = Object.create(require('events').EventEmitter.prototype);

				res.prototype.setEncoding = function (encoding) {
					t.equal(encoding, 'utf8');
				}

				var resInst = new res();
				resInst.statusCode = 200;
				callback(resInst);

				setTimeout(function () {
					resInst.emit('data', '{"result":["foo","bar"]}');
					resInst.emit('end');
				}, 10);
			}, 10);

			return {
				end: function () {},
				on: function () {}
			};
		}
	}

	client
		.lookupPostcode('EC1V 9LB')
		.then(function (data) {
			t.deepEqual(data, ["foo", "bar"]);
		});

	client._proto = origProto;
});

test('works with callback success', function (t) {
	t.plan(4);

	var client = new OpenPostcodes('foobar');
	var origProto = client._proto;

	client._proto = {
		request: function (options, callback) {
			t.equal(typeof callback, 'function');

			setTimeout(function () {
				var res = function () {}
				res.prototype = Object.create(require('events').EventEmitter.prototype);

				res.prototype.setEncoding = function (encoding) {
					t.equal(encoding, 'utf8');
				}

				var resInst = new res();
				resInst.statusCode = 200;
				callback(resInst);

				setTimeout(function () {
					resInst.emit('data', '{"result":["foo","bar"]}');
					resInst.emit('end');
				}, 10);
			}, 10);

			return {
				end: function () {},
				on: function () {}
			};
		}
	}

	client.lookupPostcode('EC1V 9LB', function (err, data) {
		t.equal(err, null);
		t.deepEqual(data, ["foo", "bar"]);
	});

	client._proto = origProto;
});

test('works with callback failure', function (t) {
	t.plan(7);

	var client = new OpenPostcodes('foobar');
	var origProto = client._proto;

	client._proto = {
		request: function (options, callback) {
			t.equal(typeof callback, 'function');

			setTimeout(function () {
				var res = function () {}
				res.prototype = Object.create(require('events').EventEmitter.prototype);

				res.prototype.setEncoding = function (encoding) {
					t.equal(encoding, 'utf8');
				}

				var resInst = new res();
				resInst.statusCode = 401;
				callback(resInst);

				setTimeout(function () {
					resInst.emit('data', '{"message":"foo","code":4010}');
					resInst.emit('end');
				}, 10);
			}, 10);

			return {
				end: function () {},
				on: function () {}
			};
		}
	}

	client.lookupPostcode('EC1V 9LB', function (err, data) {
		t.equal(typeof data, 'undefined');
		t.notEqual(err, null);
		t.equal(err.message, 'foo (4010)');
		t.equal(err.code, 401);
		t.equal(err.statusCode, 401);
	});

	client._proto = origProto;
});
