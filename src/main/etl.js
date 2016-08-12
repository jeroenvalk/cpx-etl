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

'use strict';

/* global require */
var _ = require('underscore');
var Q = require('q');
var moment = require('moment');
var Sequelize = require('sequelize');

var instance = null;

var etlToSequelize = function ETL$etlToSequelize(query, model) {
    var includes = _.map(_.pairs(_.omit(query, '_')), function (pair) {
        return _.extend({model: model[pair[0]].sequelize}, etlToSequelize(pair[1], model));
    });
    return _.extend({}, {include: includes}, query._);
};

var applyPath = function ETL$applyPath(data, path) {
    var $ = data.$ ? data.$ : data;
    var parts = path.split('.');
    _.each(parts, function (part, index) {
        switch (part.charAt(0)) {
            case '$':
                data = $;
                break;
            case '#':
                if (index !== parts.length - 1) {
                    throw new Error("ETL$applyPath: " + parts.join('.') + ": '" + part + "' must be last element");
                }
                if (part === '#') {
                    data = data['#'];
                } else {
                    data = data[part.substr(1)];
                    if (!(data instanceof Array)) {
                        throw new Error("ETL$applyPath: " + parts.join('.') + ": array expected");
                    }
                    data = data.length;
                }
                break;
            default:
                if (data instanceof Object) {
                    data = data[part];
                } else {
                    throw new Error('ETL$applyPath: ' + parts.slice(0, index).join('.') + ': not found');
                }
                break;
        }
    });
    if (data instanceof Object) {
        if (data instanceof Array) {
            data.$ = $;
            return data;
        }
        if (data.constructor === Object)
            return _.extend({$: $}, data);
    }
    return data;
};

var applyValidation = function ETL$applyValidation(prefix, validation, data, result) {
    if (validation instanceof Array) {
        for (var i = 0; i < validation.length; ++i) {
            if (validation[i] instanceof Function) {
                if (validation[i](data) === true) {
                    return;
                }
            } else {
                if (validation[i] === data) {
                    return;
                }
            }
        }
        result[prefix.substr(1)] = null;
    } else {
        _.each(_.keys(validation), function (key) {
            if (data[key] instanceof Array) {
                for (var i = 0; i < data[key].length; ++i) {
                    applyValidation(prefix + '.' + key + '.' + i, validation[key], data[key][i], result);
                }
            } else {
                applyValidation(prefix + '.' + key, validation[key], data[key], result);
            }
        });
    }
};

var dollar = function (view, bfish, promise) {
    return function $(key) {
        if (_.has(view.validation, key)) {
            if (_.has(view.extract, key)) {
                return promise[key];
            } else {
                return Q.fcall(function () {
                    return bfish[key];
                });
            }
        } else {
            throw new Error('$: key not found');
        }
    }
};

module.exports = class ETL {

    constructor(inject) {
        if (!instance) {
            instance = this;
        }
        // defaults
        this.model = {};
        this.view = {};
        this.schema = {};
        this.validation = {};
        this.views = [];
        this.mapping = null;
        this.phase = 0;
        this.sequelizeConfig = {};

        _.extend(this, inject);
    };

    register(fn) {
        this.views.push(fn());
    };

    registerModel(key, fn) {
        var val = fn();
        if (!(val instanceof Object)) {
            throw new Error("ETL$registerModel: 'model.schema' must be an object");
        }
        var attributes = _.mapObject(val, function (val, key) {
            if (!(val instanceof Object)) {
                throw new Error("ETL$registerModel: field definition must be an object");
            }
            return _.mapObject(val, function (val, key) {
                switch (key) {
                    case 'type':
                        return Sequelize[val];
                    default:
                        return val;
                }
            })
        });
        return this.model[key] = {
            source: val,
            sequelize: this.sequelize.define(key.charAt(0).toLowerCase() + key.substr(1), attributes, _.extend({
                freezeTableName: true
            }, this.sequelizeConfig))
        };
    };

    registerSchema(key, fn) {
        throw new Error('not yet implemented');
    };

    registerTransform(key, fn) {
        var transform = fn(_);
        if (!(transform instanceof Object)) {
            throw new Error('etl.registerTransform: mapping must be object or array');
        }
        this.transform[key] = fn(_);
    };

    registerValidation(key, fn) {
        this.validation[key] = fn(_, moment);
    };

    registerView(key, fn) {
        this.view[key] = {
            _: fn()
        };
    };

    applySchema(name, data, force, schema, trail) {
        var original = data;
        if (!trail) {
            trail = '';
        }
        if (name) {
            if (schema) {
                this.schema[name] = schema;
            } else {
                schema = this.schema[name];
            }
        }
        if (schema instanceof Array) {
            if (typeof schema[0] === 'string') {
                var size = schema[1] ? schema[1].size : undefined;
                switch (schema[0]) {
                    case '*':
                        break;
                    case 'Boolean':
                        if (data === '') data = null;
                        if (data === null) {
                            if (force === 'TRUE' && !isNaN(size)) {
                                data = Array(size + 1).join(' ');
                                break;
                            }
                        }
                    case 'boolean':
                        if (force && (typeof data === 'string' || typeof data === 'number')) {
                            if (data === 'false') {
                                data = false;
                            } else {
                                data = !!data;
                            }
                        }
                        if (typeof data !== 'boolean') {
                            throw new Error('applySchema: ' + trail + ': boolean expected but got ' + data);
                        }
                        if (force === 'TRUE' && !isNaN(size)) {
                            switch (data) {
                                case false:
                                    data = Array(size + 1).join('0');
                                    break;
                                case true:
                                    data = Array(size).join('0') + '1';
                                    break;
                                default:
                                    throw new Error('internal error');
                            }
                        }
                        break;
                    case 'Number':
                        if (data === '') data = null;
                        if (data === null) {
                            if (force === 'TRUE' && !isNaN(size)) {
                                data = Array(size + 1).join(' ');
                            }
                            break;
                        }
                    case 'number':
                        if (force && typeof data === 'string') {
                            data = parseInt(data);
                        }
                        if (typeof data !== 'number' || isNaN(data) || data === Infinity) {
                            throw new Error('applySchema: ' + trail + ': number expected but got ' + JSON.stringify(original));
                        }
                        if (force === 'TRUE' && !isNaN(size)) {
                            data = (data + '').substr(0, size);
                            data = Array(size - data.length + 1).join('0') + data;
                        }
                        break;
                    case 'Date':
                        if (data === '0000-00-00') data = null;
                        if (data === null) {
                            if (force === 'TRUE' && !isNaN(size)) {
                                data = '00000000';
                            }
                            break;
                        }
                    case 'date':
                        if (data instanceof Date) {
                            data = moment(data);
                        }
                        if (!data || !data.isValid || !data.isValid()) {
                            throw new Error('applySchema: ' + trail + ': date expected');
                        }
                        if (force === 'TRUE' && !isNaN(size)) {
                            data = data.format('YYYYMMDD');
                        }
                        break;
                    case 'String':
                        if (data === null) {
                            if (force === 'TRUE' && !isNaN(size)) {
                                data = Array(size + 1).join(' ');
                            }
                            break;
                        }
                    case 'string':
                        if (typeof data !== 'string') {
                            throw new Error('applySchema: ' + trail + ': string expected but got ' + JSON.stringify(original));
                        }
                        if (force === 'TRUE' && !isNaN(size)) {
                            data = data.substr(0, size);
                            data += Array(size - data.length + 1).join(' ');
                        }
                        break;
                    default:
                        throw new Error('applySchema: ' + trail + ': invalid type: ' + schema[0]);
                }
                return data;
            } else {
                if (data instanceof Array) {
                    _.each(data, function (data, index) {
                        this.applySchema(null, data, force, schema[0], [trail, index].join('.'));
                    }, this);
                } else {
                    throw new Error('applySchema: ' + trail + ': array expected');
                }
            }
        } else {
            if (data instanceof Array) {
                throw new Error('applySchema: ' + trail + ': object expected');
            }
            _.each(_.keys(data), function (key) {
                if (!_.has(data, key)) throw new Error('applySchema: ' + trail + ': invalid property: ' + key);
            });
            _.each(_.keys(schema), function (key) {
                if (!_.has(data, key)) throw new Error('applySchema: ' + trail + ': property missing: ' + key);
                var result = this.applySchema(null, data[key], force, schema[key], [trail, key].join('.'));
                if (result !== undefined) data[key] = result;
            }, this);
        }
    };

    applyTransform(name, data, transform, trail) {
        //console.log('applyTransform: ' + trail);
        //console.log(transform);
        if (!trail) {
            trail = '';
        } else {
            if (!data.$) {
                console.log(data);
                throw new Error('etl.applyTransform: root not defined');
            }
        }
        if (name) {
            transform = this.transform[name] = transform || this.transform[name];
            if (!transform) {
                throw new Error("etl.applyTransform: mapping '" + name + "' not found");
            }
        } else {
            if (!transform) {
                throw new Error('etl.applyTransform: "' + trail + '": no mapping specified');
            }
        }
        if (!(data instanceof Object)) {
            throw new Error('etl.applyTransform: "' + trail + '": invalid data');
        }
        if (transform instanceof Array) {
            var options = {
                unique: false,
                required: false
            };
            switch (transform.length) {
                case 0:
                    return undefined;
                case 1:
                    break;
                case 2:
                    _.extend(options, transform[1]);
                    break;
                default:
                    throw new Error('etl.applyTransform: syntax error');
            }
            transform = transform[0];
            if (!(transform instanceof Object)) {
                throw new Error('etl.applyTransform: syntax error');
            }
            if (!options.unique) {
                if (data instanceof Array) {
                    var $ = data.$;
                    return _.map(data, function (data, index) {
                        data.$ = $;
                        data['#'] = index;
                        return this.applyTransform(null, data, transform, trail);
                    }, this);
                }
                console.log(data);
                throw new Error('etl.applyTransform: "' + trail + '": array expected');
            }
        }
        if (data instanceof Array) {
            throw new Error('etl.applyTransform: "' + trail + '": object expected');
        }
        return _.mapObject(transform, function (val, key) {
            if (val instanceof Array && !(val[0] instanceof Object)) {
                var path = val.shift();
                if (path) {
                    if (val.length) {
                        return this.applyTransform(null, applyPath(data, path), val, trail + path);
                    } else {
                        var result = applyPath(data, path);
                        if (result instanceof Array || (result && result.constructor === Object)) {
                            console.log(data);
                            throw new Error('etl.applyTransform: "' + trail + '": value expected @ ' + path);
                        }
                        return result;
                    }
                }
            } else if (val instanceof Object) {
                return this.applyTransform(null, data, val, trail);
            } else {
                return val;
            }
        }, this);
    };

    applyValidation(name, data, validation, trail, root) {
        if (!trail) {
            trail = [];
            root = data;
        }
        trail.value = function () {
            var path = _.flatten(Array.prototype.slice.call(arguments));
            return _.reduce(path, function (data, key) {
                return key === '$' ? root : data[key];
            }, data);
        }
        if (name) {
            if (validation) {
                this.validation[name] = validation;
            } else {
                validation = this.validation[name];
            }
        }
        if (validation instanceof Array) {
            return _.find(validation, function (clause) {
                var expr = clause.expr;
                if (clause instanceof Array) {
                    expr = clause;
                }
                return !_.some(expr, function (literal) {
                    if (literal instanceof Function) {
                        return literal.call({
                            value: function () {
                                var path = _.flatten(Array.prototype.slice.call(arguments));
                                return _.reduce(path, function (data, key) {
                                    return path[key];
                                }, root);
                            }
                        }, data, trail);
                    }
                    return data === literal;
                });
            });
        }
        if (data instanceof Array) {
            _.each(data, function (data, index) {
                this.applyValidation(null, data, validation, trail.concat([index]), root);
            }, this);
            return;
        }
        data._ = _.mapObject(_.clone(validation), function (val, key) {
            var result = this.applyValidation(null, data[key], val, trail.concat([key]), root);
            if (result instanceof Array) {
                return null;
            }
            return result;
        }, this);
        _.each(_.keys(data._), function (key) {
            if (data._[key] === undefined) {
                delete data._[key];
            } else {
                if (data._[key])
                    delete data._[key].expr;
            }
        });
        if (_.isEmpty(data._)) {
            delete data._;
        }
    };

    applyView(key, $) {
        var self = this;
        var view = this.view[key]._;
        return Q.all(_.map(_.pairs(view($)), function (pair) {
            var query = etlToSequelize(pair[1], self.model);
            if (pair[1]._.unique) {
                return self.model[pair[0]].sequelize.findOne(query).then(function (result) {
                    return [pair[0].charAt(0).toLowerCase() + pair[0].substr(1), result ? result.get({plain: true}) : null];
                });
            } else {
                return self.model[pair[0]].sequelize.findAll(query).then(function (results) {
                    return [pair[0].charAt(0).toLowerCase() + pair[0].substr(1), _.map(results, function (result) {
                        return result.get({plain: true})
                    })];
                });
            }
        })).then(function (result) {
            return _.object(result);
        });
    };

    attributes(bfish) {
        var result = {};
        _.each(_.filter(_.keys(bfish), function (key) {
            return key.charAt(0) === '@';
        }), function (key) {
            result[key.substr(1)] = bfish[key];
        });
        return result;
    };

    convertJSONtoJSON(data, options) {
        if (data instanceof Array) {
            return _.map(data, function (data) {
                return this.convertJSONtoJSON(data, options);
            }, this);
        } else if (data instanceof Object) {
            return _.object(_.map(_.pairs(data), function (entry) {
                if (entry[1] instanceof Object) {
                    entry[1] = this.convertJSONtoJSON(entry[1]);
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
            }, this));
        } else {
            throw new Error("ETL$convertJSONtoJSON: array or object required");
        }
    };

    toBadgerfish(data) {
        convertJSONtoJSON(data);
    };

    detectMessageType(msg) {
        return 'JSON';
    };

    reset() {
        this.phase = 0;
        this.mapping = null;
        this.message = null;
    };

    match(msg, mapping) {
        this.reset();
        ++this.phase;
        if (!mapping) {
            var meta = _.pick(msg, _.filter(_.keys(msg), function (key) {
                return key.charAt(0) === '_';
            }));
            if (_.isEmpty(meta)) {
                return new Error('ETL$match: no meta information available');
            }
            mapping = _.find(this.views, function (mapping) {
                return _.isMatch(mapping.match, meta);
            });
        }
        if (!mapping) {
            return new Error('ETL$match: no match among ' + this.views.length + ' mappings');
        }
        this.message = msg;
        this.mapping = mapping;
    };

    getValue(key, index) {
        var result = isNaN(index) ? this.message : this.message[index];
        var part = key.split('.');
        for (var i = 0; i < part.length; ++i) {
            if (result instanceof Object) {
                result = result[part[i]];
            } else {
                throw new Error('ETL$getValue: key not found: ' + key);
            }
        }
        return result;
    };

    execMatchValidate(index) {
        if (isNaN(index) && this.message instanceof Array) {
            return _.map(_.range(this.message.length), function (index) {
                return this.execMatchValidate(index);
            }, this);
        }
        return _.mapObject(this.mapping.match.validate, function (val, key) {
            var value = this.getValue(key, index);
            return !_.some(val, function (val) {
                if (typeof val === 'function') {
                    return val(value);
                } else {
                    return value === val;
                }
            });
        }, this);
    };

    applyPatch(message, patch) {
        if (message instanceof Array) {
            _.each(message, function (msg) {
                this.applyPatch(msg, path);
            }, this);
            return message;
        }
        _.each(_.keys(patch), function (key) {
            this.apply(message, key.split('.'), patch[key]);
        }, this);
    };

    defaults(message, mapping) {
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
        this.applyPatch(this.message, this.mapping.defaults);
        return this.message;
    };

    convert(source, options) {
        options = instance.defaults(_.extend({
            _: 'ETL$convert'
        }, options));
        if (!options.sourceMsgType) {
            options.sourceMsgType = this.detectMessageType(source);
        }
        switch (options.sourceMsgType) {
            case 'JSON':
                switch (options.targetMsgType) {
                    case 'JSON':
                    default:
                        return this.convertJSONtoJSON(source, options);
                }
            default:
                throw new Error('ETL$convert: unknown message type');
        }
    };

    isValid(key, value, fn) {
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

    makeValid(value, fn) {
        if (_.isFunction(fn)) {
            return fn(value);
        } else {
            return value;
        }
    };

    validate(view, sample) {
        var self = this;
        return _.map(_.filter(_.keys(view.validation), function (key) {
            return key.charAt(0) === '@' && !self.isValid(key, sample[key], view.validation[key]);
        }), function (key) {
            return new Error("field '" + key + "' missing or invalid");
        });
    };

    getMapping(sample, metaOnly) {
        return _.find(this.views, function (view) {
            return _.every(_.keys(view.validation), function (key) {
                return ((metaOnly || key.charAt(0) !== '@') && key.charAt(0) !== '_') || (this.isValid(key, sample[key], view.validation[key]));
            }, this);
        }, this);
    };

    apply(result, path, value) {
        if (path.length > 1) {
            var part = path.shift();
            if (!isNaN(part))
                part = parseInt(part);
            if (!result[part]) {
                result[part] = (isNaN(path[0]) ? {} : []);
            }
            result = result[part];
            this.apply(result, path, value);
        } else {
            if (result[path[0]] === undefined)
                result[path[0]] = value;
        }
    };

    transform(view, data, isPlain) {
        if (data instanceof Array) {
            return _.map(data, function (data) {
                return this.transform(view, data, isPlain);
            }, this);
        } else if (data instanceof Object) {
            var result = {};
            _.each(_.keys(view.validation), function (key) {
                var target = view.transform[key];
                if (target) {
                    if (target instanceof Array) {
                        _.each(target, function (target) {
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

    extract(bfish, mapping) {
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
            return Q.all(_.map(bfish, function (bfish) {
                return this.extract(view, bfish);
            }, this));
        }
        if (bfish instanceof Object) {
            var promise = {};
            _.each(_.keys(view.extract), function (key) {
                promise[key] = view.extract[key](dollar(view, bfish, promise));
            });
            return Q.all(_.values(promise)).then(function (values) {
                return _.extend({}, bfish, _.object(_.keys(promise), values))
            });
        }
        throw new Error("ETL$extract: array or object required");
    };

    runSQL(sql) {
        var deferred = Q.defer();
        mysqlLib.query(sql, function (err, detailRows, fields) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(detailRows);
            }
        });
        return deferred.promise;
    };

    insertRelated(table, bfish, logger) {
        if (bfish instanceof Array) {
            return Q.all(_.map(bfish, function (bfish) {
                return insertRelated(table, bfish, logger);
            }));
        } else if (bfish instanceof Object) {
            var keys = _.map(_.filter(_.keys(bfish), function (key) {
                return key.charAt(0) === '@';
            }), function (key) {
                return key.substr(1);
            });
            var values = _.map(keys, function (key) {
                return mysql.escape(bfish['@' + key]);
            });
            var sql = "INSERT INTO " + table + "(" + keys.join(',') + ") VALUES (" + values.join(',') + ");";
            logger.info(sql);
            return runSQL(sql);
        } else {
            throw new Error("ETL$insertRelated: array or object required");
        }
    };

    load(view, table, target, source) {
        console.log(view.load);
        console.log(table);
        var fn = view.load[table];
        if (fn) {
            try {
                var argv = Array.prototype.slice.call(arguments, 2);
                return fn.apply(this, argv)['catch'](function (error) {
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
                return Q.all(_.map(bfish, function (bfish) {
                    return this.load(table, bfish);
                }, this))
            }
            if (bfish instanceof Object) {
                var keys = _.keys(bfish);
                var related = _.filter(keys, function (key) {
                    return key.charAt(0) !== '@';
                });
                return insertRelated(table, bfish, self.logger).then(function () {
                    return Q.all(_.map(related, function (table) {
                        return insertRelated(table, bfish[table], self.logger);
                    })).then(function () {
                        return bfish;
                    });
                })
            }
        }
    };

}

