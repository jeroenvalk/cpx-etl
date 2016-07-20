module.exports = function() {
	return {
		ID : {
			type : 'STRING',
			allowNull : false,
			primaryKey : true
		},
		name : {
			type : 'STRING'
		}
	};
};
