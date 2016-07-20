var myModule, proto;

var _define = GLOBAL.define;

GLOBAL.define = function(fn) {
	proto = {};
	myModule = fn.call(proto);
	proto.constructor.prototype = proto;
};

var views = [];

require('./etl.js');
proto.constructor.initialize();
proto.constructor.register(function() {
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
proto.constructor({
	info : function(msg) {
		console.log('[INFO] ' + msg);
	}
}, views);

module.exports = proto.constructor;

GLOBAL.define = _define;
