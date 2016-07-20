var _ = require('underscore');
var model = require('model');

var sequelize = new Sequelize('CPX', 'root', '', {
	host : 'localhost',
	dialect : 'mysql' | 'sqlite' | 'postgres' | 'mssql',
	pool : {
		max : 5,
		min : 0,
		idle : 10000
	}
});

module.exports = sequelize.authenticate().then(function() {
	return _.mapObject(model.schemas, function(val, key) {
		return sequelize.define(key.toLowerCase(), _.mapObject(val, function(val, key) {
			return _.mapObject(val, function(val, key) {
				switch (key) {
				case 'type':
					return Sequelize[val];
				default:
					return val;
				}
			})
		}), {
			freezeTableName : true
		});
	}).then(function(models) {
		_.each(_.keys(models), function(key) {
			_.each(_.filter(model.associations, function(association) {
				return association.minor[0] === key;
			}), function(association) {
				if (_.has(association[1], 'through')) {
					models[key].belongsToMany(association.major[0], association.minor[1]);
				} else {
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
});
