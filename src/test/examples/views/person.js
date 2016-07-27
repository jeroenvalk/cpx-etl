module.exports = function (cpx, _, Q) {
    return function ($) {
        return {
            Person: {
                _: {
                    unique: true,
                    required: false,
                    where: {
                        name: $.name
                    }
                },
                Entity: {
                    _: {
                        unique: true,
                        required: true,
                        where: {
                            type: 'person'
                        }
                    },
                    Belonging: {
                        _: {
                            unique: true,
                            required: false,
                            where: {
                                rank: 0
                            }
                        }
                    }
                }
            }
        };
    };
};
