var ETL = require('./etl.js');

ETL.initialize();
ETL.register(function() {
	return {
		match: {
			_: 'ETL$convert'
		},
		validate : {
			sourceMsgType: [undefined, 'JSON'],
			targetMsgType: ['JSON'],
			toBfish: [false, true]
		},
		defaults: {
			targetMsgType: 'JSON',
			toBfish: true
		}
	};
});

module.exports = ETL;
