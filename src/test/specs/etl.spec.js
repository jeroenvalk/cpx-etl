describe("etl", function() {

	var expect = require('chai').expect;
	var cpx = require('../../main');

	var example = [ {
		name : 'Sarah',
		father : 'Terah'
	}, {
		name : 'Abraham',
		father : 'Terah'
	}, {
		name : 'Nahor',
		father : 'Terah'
	}, {
		name : 'Haran',
		father : 'Terah'
	}, {
		name : 'Milcah',
		father : 'Haran'
	}, {
		name : 'Bethuel',
		mother : 'Milcah',
		father : 'Nahor'
	}, {
		name : 'Isaac',
		mother : 'Sarah',
		father : 'Abraham'
	}, {
		name : 'Rebecca',
		father : 'Bethuel'
	}, {
		name : 'Esau',
		mother : 'Rebecca',
		father : 'Isaac'
	}, {
		name : 'Jacob',
		mother : 'Rebecca',
		father : 'Isaac'
	} ];

	var etl;

	before(function(done) {
		var Sequelize = require('sequelize');

		var inject = {
			logger : require('winston'),
			sequelize : new Sequelize('CPX', 'root', '', {
				host : 'localhost',
				dialect : 'mysql',
				pool : {
					max : 5,
					min : 0,
					idle : 10000
				}
			})
		}

		cpx.checkPromise(inject.sequelize.authenticate().then(function() {
			etl = new cpx.ETL(inject);
		}), done);
	});

	it("convert", function() {
		expect(etl.convert({
			'@alice' : 'bob'
		}, {
			toBfish : false
		})).to.deep.equal({
			alice : 'bob'
		});

		expect(etl.convert({
			alice : 'bob'
		})).to.deep.equal({
			'@alice' : 'bob'
		});
	});

	it("register", function() {
		etl.registerModel('Belonging', require('../examples/models/Belonging'));
		etl.registerModel('Entity', require('../examples/models/Entity'));
		etl.registerModel('Person', require('../examples/models/Person'));
		etl.registerView('person', require('../examples/views/person'));
		etl.register(require('../examples/person.js'));
	});

	it("match", function() {
		expect(etl.match({
			_ : 'nonExisting'
		})).to.be.an['instanceof'](Error);

		expect(etl.match(example)).to.be.an['instanceof'](Error);

		expect(etl.match({
			_ : 'familyTree'
		})).to.be.undefined;
	});

	xit("validate", function() {
		var errors = etl.validate(mapping, example);
		expect(errors).to.be.an['instanceof'](Array).and.to.have.length(example.length);
		_.each(errors, function(errors) {
			expect(errors).to.deep.equal([]);
		});
	});

	xit("extract", function(done) {
		etl.extract(mapping, example).then(function(enriched) {
			expect(etl.validate(mapping, example)).to.deep.equal([]);
		});
	});
});
