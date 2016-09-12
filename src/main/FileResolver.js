/**
 * Copyright © 2016 dr. ir. Jeroen M. Valk
 *
 * This file is part of ComPosiX. ComPosiX is free software: you can
 * redistribute it and/or modify it under the terms of the GNU Lesser General
 * Public License as published by the Free Software Foundation, either version 3
 * of the License, or (at your option) any later version.
 *
 * ComPosiX is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with ComPosiX. If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

var path = require('path');
var fs = require('fs');
var _ = require('underscore');
var glob = require('glob');

module.exports = class FileResolver {
    constructor(url, globs) {
        this.url = url;
        this.tree = {};
        var initialize = function FileResolver$initialize(globs, cwd, tree) {
            _.each(_.keys(globs), function (pattern) {
                var files;
                if (pattern === '_') {
                    files = glob.sync(globs._, {cwd: path.resolve(url, cwd)});
                    tree._ = _.object(files, _.map(files, function(file) {
                        return null;
                    }));
                } else {
                    files = glob.sync(pattern, {cwd: path.resolve(url, cwd)});
                    _.extend(tree, _.object(files, _.map(files, function (file) {
                        var result = {};
                        initialize(globs[pattern], path.resolve(url, cwd, file), result);
                        return result;
                    })));
                }
            })
        };
        initialize(globs, '.', this.tree);
    }

    resolve(pathname) {
        var prefix = '', fragment, tree = this.tree, index = 0;
        var parts = [{
            tree: tree,
            prefix: ''
        }];
        while (true) {
            fragment = _.find(_.keys(tree), function (prefix) {
                return pathname.substr(index, prefix.length) === prefix;
            });
            if (!fragment) {
                break;
            }
            index += fragment.length;
            prefix += fragment;
            tree = tree[fragment];
            parts.push({
                tree: tree,
                prefix: prefix
            });
        }
        var suffix = pathname.substr(index);
        for (var i = parts.length - 1; i >= 0; --i) {
            if (_.has(parts[i].tree._, suffix)) {
                return path.resolve(this.url, parts[i].prefix, suffix);
            }
        }
        throw new Error('FileResolver.resolve: file not found: ' + pathname);
    }

    read(pathname) {
        return callBackPromise(fs.readFile, [path.resolve(pathname)]).then(function (buffer) {
            var result;
            switch (path.extname(pathname)) {
                case '.json':
                    result = JSON.parse(buffer.toString(encoding));
                    break;
                case '.xml':
                    result = xml2json(libxml.parseXmlString(xml));
                    break;
            }
            _.extend(data, result);
            return result;
        });
    }
}