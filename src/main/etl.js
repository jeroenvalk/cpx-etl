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
//	var mysqlLib = require('../../mySQLlibrary');
//	var mysql = require('mysql');
	var _ = require('underscore');
	var Q = require('q');

	this.constructor = function ETL(logger, views) {
		this.logger = logger;
		this.views = views;
	};

	this.register = function ETL$register(fn) {
		this.views.push(fn());
	};
	
	this.toBadgerfish = function ETL$toBadgerfish(data) {
		if (data instanceof Array) {
			return _.map(data, function(data) {
				return this.toBadgerfish(data);
			}, this);
		} else if (data instanceof Object) {
			return _.object(_.map(_.pairs(data), function(entry) {
				if (entry[1] instanceof Object) {
					entry[1] = this.toBadgerfish(entry[1]);
				} else {
					entry[0] = '@' + entry[0];
				}
				return entry;
			}, this));
		} else {
			throw new Error("ETL$toBadgerfish: array or object required");
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

	this.extract = function ETL$extract(view, bfish) {
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

	this.load = function ETL$load(table, bfish) {
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
	};
});
