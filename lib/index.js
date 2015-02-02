"use strict";

var http = require('http');
var https = require('https');
var qs = require('querystring');
var objectMerge = require('object-merge');
var Q = require('q');

var OpenPostcodes = module.exports = function (apiKey, opts) {
	if (!(this instanceof OpenPostcodes))
		return new OpenPostcodes(apiKey, opts);

	if (!apiKey)
		throw new Error('No API key provided');

	this.apiKey = apiKey;

	opts = opts || {};
	opts.secure = typeof opts.secure !== 'undefined' ? opts.secure : true;
	opts.hostname = opts.hostname || 'api.openpostcodes.com';
	opts.port = opts.port || (opts.secure ? 443 : 80);
	opts.headers = objectMerge({ 'Accept': 'application/json' }, opts.headers || {});

	this.options = opts;

	this._proto = opts.secure ? https : http;
}

OpenPostcodes.prototype._request = function (method, path, params, options) {
	params = objectMerge({ api_key: this.apiKey }, params || {});

	options = objectMerge(this.options, options || {}, {
		method: method,
		path: '/v1/' + path + '?' + qs.stringify(params)
	});

	var deferred = Q.defer();

	var request = this._proto.request(options, function (response) {
		var data = '';
		response.setEncoding('utf8');

		response.on('data', function (chunk) {
			data += chunk;
		});

		response.on('end', function () {
			try {
				var output = JSON.parse(data);
			} catch (ex) {
				deferred.reject(new Error('Invalid JSON'));
				return;
			}

			if (response.statusCode < 200 || response.statusCode >= 300) {
				var error = new Error(output.message + ' (' + output.code + ')');
				error._internalCode = output.code;
				error.code = response.statusCode;
				error.statusCode = response.statusCode;
				deferred.reject(error);
				return;
			}

			return deferred.resolve(output.result);
		});
	});

	request.end();

	request.on('error', function (error) {
		deferred.reject(error);
	});

	return deferred.promise;
}

OpenPostcodes.prototype.lookupPostcode = function (postcode, callback) {
	return this
		._request('get', 'postcodes/' + qs.escape(postcode))
		.fail(function (error) {
			if (error._internalCode === 4040)
				return [];

			throw error;
		})
		.nodeify(callback);
}

OpenPostcodes.prototype.postcodeForLocation = function (latitude, longitude, callback) {
	var params = {
		lonlat: longitude + ',' + latitude,
		radius: 1000,
		limit: 1
	};

	return this
		._request('get', 'postcodes', params)
		.then(function (data) {
			if (!data.length)
				return null;

			return data[0];
		})
		.nodeify(callback);
}
