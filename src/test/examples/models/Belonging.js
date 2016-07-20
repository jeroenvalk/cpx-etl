module.exports = function () {
    return {
        minorID: {
            type: 'STRING',
            allowNull: false
        },
        majorID: {
            type: 'STRING',
            allowNull: false
        },
        rank: {
            type: 'INTEGER',
            allowNull: false
        }
    };
};
