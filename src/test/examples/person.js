module.exports = function (_) {
    var isName = function person$isName(val) {
        return val && /^\w+$/.test(val) && val.charAt(0).toUpperCase() === val.charAt(0) && val.substr(1).toLowerCase() === val.substr(1);
    };

    return {
        match: {
            _: 'familyTree',
            validate: {
                '@name': [isName],
                '@mother': [undefined, isName],
                '@father': [undefined, isName],
                '@type': [undefined]
            },
            defaults: {
                '@type': 'person'
            }
        },
        extract: {
            person: {
                $: {name: '@name'},
                view: 'person'
            },
            mother: {
                $: {name: '@mother'},
                view: 'person'
            },
            father: {
                $: {name: '@father'},
                view: 'person'
            },
            '@motherIsFemale': {
                $: {entity: 'mother.Person.Entity.Entity'},
                _: function ($) {
                    return !$ || $.entity === null || $.entity.minorID !== $.entity.majorID;
                }
            },
            '@fatherIsMale': {
                $: {entity: 'father.Person.Entity.Entity'},
                _: function ($) {
                    return !$ || ($.entity !== null && $.entity.minorID === $.entity.majorID);
                }
            }
        },
        validate: {
            '@motherIsFemale': true,
            '@fatherIsMale': true
        }
    };
};
