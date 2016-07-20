describe("etl", function() {

	var expect = require('chai').expect;
	var ETL = require('../../main');
	var etl = new ETL();

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

	it("register", function() {
		require('../examples/person.js');
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

	it("match", function() {
		expect(etl.match({
			_ : 'nonExisting'
		})).to.be.an['instanceof'](Error);

		expect(etl.match(example)).to.be.an['instanceof'](Error);

		expect(etl.match({
			_ : 'familyTree'
		})).to.be.undefined;
	});

	it("validate", function() {
		var errors = etl.validate(mapping, example);
		expect(errors).to.be.an['instanceof'](Array).and.to.have.length(example.length);
		_.each(errors, function(errors) {
			expect(errors).to.deep.equal([]);
		});
	});

	it("extract", function(done) {
		etl.extract(mapping, example).then(function(enriched) {
			expect(etl.validate(mapping, example)).to.deep.equal([]);
		});
	});
});
