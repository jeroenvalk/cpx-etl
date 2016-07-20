/**
 * Copyright © 2016 dr. ir. Jeroen M. Valk
 * 
 * This file is part of ComPosiX. ComPosiX is free software: you can
 * redistribute it and/or modify it under the terms of the GNU Lesser General
 * Public License as published by the Free Software Foundation, either version 3
 * of the License, or (at your option) any later version.
 * 
 * ComPosiX is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU Lesser General Public License
 * along with ComPosiX. If not, see <http://www.gnu.org/licenses/>.
 */

define(function() {
	'use strict';

	//	var mysqlLib = require('../../mySQLlibrary');
	//	var mysql = require('mysql');
	var _ = require('underscore');
	var Q = require('q');
	var logger = require('winston');
	//logger.level = 'info';
	logger.info('Hello World');

	this.constructor = function ETL() {
		this.logger = logger;
		this.views = [];
		this.mapping = null;
		this.phase = 0;
		this.setAsRegistry();
	};

	var etl = null;
	var registry = null;

	this.constructor.initialize = function ETL$initialize() {
		if (etl) {
			throw new Error('ETL$initialize: already initialized');
		}
		etl = new this();
	};

	this.constructor.register = function ETL$register(fn) {
		registry.register(fn);
	};

	this.register = function ETL$register(fn) {
		this.views.push(fn());
	};

	this.setAsRegistry = function ETL$setAsRegistry() {
		registry = this;
	};

	this.attributes = function attributes(bfish) {
		var result = {};
		_.each(_.filter(_.keys(bfish), function(key) {
			return key.charAt(0) === '@';
		}), function(key) {
			result[key.substr(1)] = bfish[key];
		});
		return result;
	};

	var convertJSONtoJSON = function ETL$convertJSONtoJSON(data, options) {
		if (data instanceof Array) {
			return _.map(data, function(data) {
				return convertJSONtoJSON(data);
			});
		} else if (data instanceof Object) {
			return _.object(_.map(_.pairs(data), function(entry) {
				if (entry[1] instanceof Object) {
					entry[1] = convertJSONtoJSON(entry[1]);
				} else {
					if (entry[0].charAt(0) === '@') {
						if (!options.toBfish) {
							entry[0] = entry[0].substr(1);
						}
					} else {
						if (options.toBfish) {
							entry[0] = '@' + entry[0];
						}
					}
				}
				return entry;
			}));
		} else {
			throw new Error("ETL$convertJSONtoJSON: array or object required");
		}
	};

	this.toBadgerfish = function ETL$toBadgerfish(data) {
		convertJSONtoJSON(data);
	};

	this.detectMsgType = function ETL$detectMessageType(msg) {
		return 'JSON';
	};

	this.reset = function ETL$reset() {
		this.phase = 0;
		this.mapping = null;
		this.message = null;
	};
	
	this.match = function ETL$match(msg, mapping) {
		this.reset(); ++this.phase;
		if (!mapping) {
			var meta = _.pick(msg, _.filter(_.keys(msg), function(key) {
				return key.charAt(0) === '_';
			}));
			if (_.isEmpty(meta)) {
				return new Error('ETL$match: no meta information available');
			}
			mapping = _.find(this.views, function(mapping) {
				return _.isMatch(mapping.match, meta);
			});
		}
		if (!mapping) {
			return new Error('ETL$match: no match among ' + this.views.length + ' mappings');
		}
		this.message = msg;
		this.mapping = mapping;
	};

	var applyPatch = function ETL$patch(message, patch) {
		if (message instanceof Array) {
			_.each(message, function(msg) {
				applyPatch(msg, path);
			});
			return message;
		}
		_.each(_.keys(patch), function(key) {
			apply(message, key.split('.'), patch[key]);
		});
	};

	this.defaults = function ETL$defaults(message, mapping) {
		var error;
		switch (this.phase) {
		case 0:
			error = this.match(message, mapping);
		case 1:
			this.phase = 0;
			break;
		default:
			throw new Error('ETL$defaults: called at wrong phase');
		}
		if (error) {
			throw error;
		}
		applyPatch(this.message, this.mapping.defaults);
		return this.message;
	};

	this.convert = function ETL$convert(source, options) {
		options = etl.defaults(_.extend({
			_ : 'ETL$convert'
		}, options));
		if (!options.sourceMsgType) {
			options.sourceMsgType = this.detectMsgType(source);
		}
		switch (options.sourceMsgType) {
		case 'JSON':
			switch (options.targetMsgType) {
			case 'JSON':
			default:
				return convertJSONtoJSON(source, options);
			}
		default:
			throw new Error('ETL$convert: unknown message type');
		}
	};

	this.isValid = function ETL$isValid(key, value, fn) {
		var result;
		if (_.isFunction(fn)) {
			result = fn(value) !== undefined;
		} else {
			result = fn ? value !== undefined : true;
		}
		if (!result) {
			this.logger.info(key + ': validation failed');
		}
		return result;
	};

	this.makeValid = function ETL$makeValid(value, fn) {
		if (_.isFunction(fn)) {
			return fn(value);
		} else {
			return value;
		}
	};

	this.validate = function ETL$validate(view, sample) {
		var self = this;
		return _.map(_.filter(_.keys(view.validation), function(key) {
			return key.charAt(0) === '@' && !self.isValid(key, sample[key], view.validation[key]);
		}), function(key) {
			return new Error("field '" + key + "' missing or invalid");
		});
	};

	this.getMapping = function ETL$getMapping(sample, metaOnly) {
		return _.find(this.views, function(view) {
			return _.every(_.keys(view.validation), function(key) {
				return ((metaOnly || key.charAt(0) !== '@') && key.charAt(0) !== '_') || (this.isValid(key, sample[key], view.validation[key]));
			}, this);
		}, this);
	};

	var apply = function ETL$apply(result, path, value) {
		if (path.length > 1) {
			var part = path.shift();
			if (!isNaN(part))
				part = parseInt(part);
			if (!result[part]) {
				result[part] = (isNaN(path[0]) ? {} : []);
			}
			result = result[part];
			apply(result, path, value);
		} else {
			if (result[path[0]] === undefined)
				result[path[0]] = value;
		}
	};

	this.transform = function ETL$transform(view, data, isPlain) {
		if (data instanceof Array) {
			return _.map(data, function(data) {
				return this.transform(view, data, isPlain);
			}, this);
		} else if (data instanceof Object) {
			var result = {};
			_.each(_.keys(view.validation), function(key) {
				var target = view.transform[key];
				if (target) {
					if (target instanceof Array) {
						_.each(target, function(target) {
							apply(result, target.split('.'), data[key]);
						});
					} else {
						if (target) {
							if (target === true) {
								target = key;
							}
							apply(result, target.split('.'), data[key]);
						}
					}
				}
			});
			return result;
		} else {
			throw new Error("ETL$applyMapping: array or object required");
		}
	};

	var dollar = function(view, bfish, promise) {
		return function $(key) {
			if (_.has(view.validation, key)) {
				if (_.has(view.extract, key)) {
					return promise[key];
				} else {
					return Q.fcall(function() {
						return bfish[key];
					});
				}
			} else {
				throw new Error('$: key not found');
			}
		}
	};

	this.extract = function ETL$extract(bfish, mapping) {
		var view;
		switch (this.phase) {
		case 0:
			view = this.match(bfish);
		case 1:
			this.validate(bfish);
		case 2:
			break;
		default:
			throw new Error('ETL$extract: called at wrong phase');
		}
		if (bfish instanceof Array) {
			return Q.all(_.map(bfish, function(bfish) {
				return this.extract(view, bfish);
			}, this));
		}
		if (bfish instanceof Object) {
			var promise = {};
			_.each(_.keys(view.extract), function(key) {
				promise[key] = view.extract[key](dollar(view, bfish, promise));
			});
			return Q.all(_.values(promise)).then(function(values) {
				return _.extend({}, bfish, _.object(_.keys(promise), values))
			});
		}
		throw new Error("ETL$extract: array or object required");
	};

	var runSQL = function ETL$runSQL(sql) {
		var deferred = Q.defer();
		mysqlLib.query(sql, function(err, detailRows, fields) {
			if (err) {
				deferred.reject(err);
			} else {
				deferred.resolve(detailRows);
			}
		});
		return deferred.promise;
	};

	var insertRelated = function ETL$insertRelated(table, bfish, logger) {
		if (bfish instanceof Array) {
			return Q.all(_.map(bfish, function(bfish) {
				return insertRelated(table, bfish, logger);
			}));
		} else if (bfish instanceof Object) {
			var keys = _.map(_.filter(_.keys(bfish), function(key) {
				return key.charAt(0) === '@';
			}), function(key) {
				return key.substr(1);
			});
			var values = _.map(keys, function(key) {
				return mysql.escape(bfish['@' + key]);
			});
			var sql = "INSERT INTO " + table + "(" + keys.join(',') + ") VALUES (" + values.join(',') + ");";
			logger.info(sql);
			return runSQL(sql);
		} else {
			throw new Error("ETL$insertRelated: array or object required");
		}
	};

	this.load = function ETL$load(view, table, target, source) {
		console.log(view.load);
		console.log(table);
		var fn = view.load[table];
		if (fn) {
			try {
				var argv = Array.prototype.slice.call(arguments, 2);
				return fn.apply(this, argv)['catch'](function(error) {
					logger.error(error);
					throw error;
				});
			} catch (e) {
				logger.error(e);
				throw e;
			}
		} else {
			var self = this;
			self.logger.info('ETL$load: ' + table + ' ' + JSON.stringify(bfish));
			if (bfish instanceof Array) {
				return Q.all(_.map(bfish, function(bfish) {
					return this.load(table, bfish);
				}, this))
			}
			if (bfish instanceof Object) {
				var keys = _.keys(bfish);
				var related = _.filter(keys, function(key) {
					return key.charAt(0) !== '@';
				});
				return insertRelated(table, bfish, self.logger).then(function() {
					return Q.all(_.map(related, function(table) {
						return insertRelated(table, bfish[table], self.logger);
					})).then(function() {
						return bfish;
					});
				})
			}
		}
	};

});
