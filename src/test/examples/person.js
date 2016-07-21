module.exports = function (_) {
    var isName = function person$isName(val) {
        return /^\w+$/.test(val) && val.charAt(0).toUpperCase() === val.charAt(0) && val.substr(1).toLowerCase() === val.substr(1);
    };

    return {
        match: {
            _: 'familyTree',
            validate: {
                '_META.@type': true,
                '_META.@force': [false, 'boolean'],
                '@name': isName,
                '@mother': [false, isName],
                '@father': [false, isName],
                '@type': false
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
