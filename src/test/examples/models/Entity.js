module.exports = function() {
	return {
		ID : {
			type : 'STRING',
			allowNull : false,
			primaryKey : true
		},
		type : {
			type : 'STRING'
		}
	};
};
