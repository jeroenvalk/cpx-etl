var myModule, proto;

var _define = GLOBAL.define;

GLOBAL.define = function(fn) {
	proto = {};
	myModule = fn.call(proto);
};

var views = [];

require('./etl.js');
proto.constructor({
	info : function(msg) {
		console.log('[INFO] ' + msg);
	}
}, views);

module.exports = proto;

GLOBAL.define = _define;
