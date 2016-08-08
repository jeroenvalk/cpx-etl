var fs = require('fs');
var _ = require('underscore');
var libxslt;
var XLSX = require('xlsx');

var ETL = require('./etl.js');
var etl = new ETL({
    logger: require('winston')
});
etl.register(function () {
    return {
        match: {
            _: 'ETL$convert'
        },
        validate: {
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

function resolveXIncludes(json, encoding) {
    "use strict";
    function resolveIncludeSync(include) {
        "use strict";
        return fs.readFileSync(include['@href'], encoding);
    }

    if (json instanceof Array) {
        return _.map(json, function (object) {
            return resolveXIncludes(object, encoding);
        });
    } else if (json instanceof Object) {
        return _.mapObject(json, function(val, key) {
            if (key === 'xi:include') {
                if (val instanceof Array) {
                    return _.map(val, resolveIncludeSync);
                } else {
                    return resolveIncludeSync(val);
                }
            } else {
                resolveXIncludes(val)
            }
        });
    } else {
        return json;
    }
}

function callbackPromise(fn, argv) {
    "use strict";
    return new Promise(function(resolve, reject) {
        var callback = function callbackPromise$callback(error, result) {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        };
        argv.push(callback);
        fn.apply(this, argv);
    });
}

function xslPipeline(input, array, callback) {
    "use strict";
    if (!array.length) {
        callback(null, input);
    } else {
        libxslt.parse(array.shift(), function(error, xslt) {
            if (error) {
                callback(error);
            } else {
                xslt.apply(input, {}, function(error, transformedString) {
                    if (error) {
                        callback(error);
                    } else {
                        xslPipeline(transformedString, array, callback);
                    }
                });
            }
        });
    }
}

function xslTransform(transform, encoding) {
    "use strict";
    if (!libxslt) {
        libxslt = require('libxslt');
    }
    transform = resolveXIncludes(transform, encoding);
    if (transform instanceof Array) {
        _.map(transform, function (transform) {
            return xslTransform(transform, encoding);
        }).join('');
    } else {
        var includes = transform['xi:include'];
        if (includes instanceof Array) {
            return callbackPromise(xslPipeline, [includes.shift(), includes]);
        } else {
            return callbackPromise(xslPipeline, [includes, []]);
        }
    }
};

module.exports = {
    checkPromise: function cpx$checkPromise(promise, done) {
        promise.then(function () {
            done();
        }, done);
    },
    convert: function cpx$convert(buffer, mimetype) {
        "use strict";
        switch (mimetype) {
            case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                var workbook = XLSX.read(buffer);
                var result = {};
                workbook.SheetNames.forEach(function (sheetName) {
                    var roa = XLSX.utils.sheet_to_row_object_array(workbook.Sheets[sheetName]);
                    if (roa.length > 0) {
                        result[sheetName] = roa;
                    }
                });
                return result;
            default:
                throw new Error("unsupported mimetype");
        }
    },
    execute: function cpx$execute(entity, mimetype, encoding) {
        "use strict";
        var transform = entity['cpx:transform'];
        delete entity['cpx:transform'];
        if (mimetype) {
            switch (mimetype) {
                case 'application/xml':
                    return xslTransform(transform, encoding);
                default:
                    throw new Error("cpx$execute: provide mimetype 'application/xml'");
            }
        } else {
            throw new Error('cpx$execute: native XSL transform not supported');
        }
    },
    ETL: ETL
};
