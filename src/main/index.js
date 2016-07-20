var ETL = require('./etl.js');
var etl = new ETL({
	logger : require('winston')
});
etl.register(function() {
	return {
		match : {
			_ : 'ETL$convert'
		},
		validate : {
			sourceMsgType : [ undefined, 'JSON' ],
			targetMsgType : [ 'JSON' ],
			toBfish : [ false, true ]
		},
		defaults : {
			targetMsgType : 'JSON',
			toBfish : true
		}
	};
});

module.exports = {
	checkPromise : function cpx$checkPromise(promise, done) {
		promise.then(function() {
			done();
		}, done);
	},
	ETL : ETL
};
