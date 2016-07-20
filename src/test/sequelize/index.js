var _ = require('underscore');
var Sequelize = require('sequelize');
var model = require('./model');

var sequelize = new Sequelize('CPX', 'root', '', {
	host : 'localhost',
	dialect : 'mysql',
	pool : {
		max : 5,
		min : 0,
		idle : 10000
	}
});

module.exports = sequelize.authenticate()['catch'](function(e) {
	console.log("ERROR");
	throw e;
}).then(function() {
	var result = _.mapObject(model.schemas, function(val, key) {
		if (!(val instanceof Object)) {
			throw new Error("sequelizeModel: 'model.schema' must be an object");
		}
		var attributes = _.mapObject(val, function(val, key) {
			if (!(val instanceof Object)) {
				throw new Error("sequelizeModel: field definition must be an object");
			}
			return _.mapObject(val, function(val, key) {
				switch (key) {
				case 'type':
					return Sequelize[val];
				default:
					return val;
				}
			})
		});
		return null;
		// TODO: fix this line below
		return sequelize.define(key.toLowerCase(), attributes, {
			freezeTableName : true
		});
	});
	console.log(result);
	return result;
}).then(function(models) {
	return models;
	// TODO: fix this code below
	_.each(_.keys(models), function(key) {
		_.each(_.filter(model.associations, function(association) {
			return association.minor[0] === key;
		}), function(association) {
			if (_.has(association[1], 'through')) {
				models[key].belongsToMany(association.major[0], association.minor[1]);
			} else {
				console.log(models[key]);
				models[key].belongsTo(association.major[0], association.minor[1]);
			}
		});
		_.each(_.filter(model.associations, function(association) {
			return association.major[0] === key && (!_.has(assocation[1], 'through' || association.minor[key] !== key));
		}), function(association) {
			if (_.has(association[1], 'through')) {
				models[key].belongsToMany(association.minor[0], association.major[1]);
			} else {
				models[key].hasMany(association.minor[0], association.major[1]);
			}
		});
	});
	return models;
});
