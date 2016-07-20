require('../index').register(function() {
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
