describe("etl", function () {

    var _ = require('underscore');
    var expect = require('chai').expect;
    var cpx = require('../../main');

    var example = [{
        name: 'Sarah',
        father: 'Terah'
    }, {
        name: 'Abraham',
        father: 'Terah'
    }, {
        name: 'Nahor',
        father: 'Terah'
    }, {
        name: 'Haran',
        father: 'Terah'
    }, {
        name: 'Milcah',
        father: 'Haran'
    }, {
        name: 'Bethuel',
        mother: 'Milcah',
        father: 'Nahor'
    }, {
        name: 'Isaac',
        mother: 'Sarah',
        father: 'Abraham'
    }, {
        name: 'Rebecca',
        father: 'Bethuel'
    }, {
        name: 'Esau',
        mother: 'Rebecca',
        father: 'Isaac'
    }, {
        name: 'Jacob',
        mother: 'Rebecca',
        father: 'Isaac'
    }];

    var etl;

    before(function (done) {
        var Sequelize = require('sequelize');

        var inject = {
            logger: require('winston'),
            sequelize: new Sequelize('CPX', 'root', '', {
                host: 'localhost',
                dialect: 'mysql',
                pool: {
                    max: 5,
                    min: 0,
                    idle: 10000
                }
            })
        }

        cpx.checkPromise(inject.sequelize.authenticate().then(function () {
            etl = new cpx.ETL(inject);
        }), done);
    });

    it("convert", function () {
        expect(etl.convert({
            '@alice': 'bob'
        }, {
            toBfish: false
        })).to.deep.equal({
            alice: 'bob'
        });

        expect(etl.convert({
            alice: 'bob'
        })).to.deep.equal({
            '@alice': 'bob'
        });
    });

    it("register", function () {
        etl.registerModel('Belonging', require('../examples/models/Belonging'));
        var Entity = etl.registerModel('Entity', require('../examples/models/Entity')).sequelize;
        var Person = etl.registerModel('Person', require('../examples/models/Person')).sequelize;
        Person.belongsTo(Entity, {foreignKey: 'ID'});
        //Entity.hasOne(Person);
        etl.registerView('person', require('../examples/views/person'));
        etl.register(require('../examples/person.js'));
    });

    it("applyView", function (done) {
        cpx.checkPromise(etl.applyView('person', {name: 'Terah'}).then(function (result) {
            expect(result).to.deep.equal({Person: null});
        }), done);
    });

    it("match", function () {
        expect(etl.match({
            _: 'nonExisting'
        })).to.be.an['instanceof'](Error);

        expect(etl.match(example)).to.be.an['instanceof'](Error);

        expect(etl.match({
            _: 'familyTree'
        })).to.be.undefined;

        expect(etl.match(_.extend(etl.convert(example), {_: 'familyTree'}))).to.be.undefined;
    });

    it("execMatchValidate", function () {
        console.log(etl.message);
        _.each(etl.execMatchValidate(), function(validation) {
            _.each(_.pairs(validation), function (pair) {
                expect(pair).to.deep.equal([pair[0], false]);
            });
        });
    });

    xit("extract", function (done) {
        etl.extract(mapping, example).then(function (enriched) {
            expect(etl.validate(mapping, example)).to.deep.equal([]);
        });
    });
});
