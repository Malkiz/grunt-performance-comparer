module.exports = function(grunt) {
	var parser = require('junit-xml-parser');
	var comparer = require('../lib/index.js');
	var fs = require('fs');

	grunt.registerMultiTask('performance-comparer', 'compare performance results', function(){
		var _this = this;
		var options = _this.options();
		var xmlFilePaths = _this.files.reduce(function(arr, file) {
			return arr.concat(file.src);
		}, []);

		console.log('The threshold is ' + options.threshold + ' ms');

		console.log('Parsing files:\n  ' + xmlFilePaths.join('\n  '));

		var parsedData = xmlFilePaths.reduce(function(map, filepath) {
			map[filepath] = parser.parse(filepath, options.warnings ? console : {log:function(){}});
			return map;
		}, {});

		var xmlPathToFilename = {};

		if (options.aggregate) {
			console.log('Aggregating to ' + options.aggregate);
			parsedData = comparer.aggregate(parsedData, options.aggregate);
		}

		var isPrevPrefix = false;
		var prev = grunt.file.expand(options.prev);
		if (prev && prev.length) {
			prev = prev.reduce(function(map, filepath) {
				try {
					var matched = filepath.match(/\/([^\/]*)\.([^\.]*)$/);
					var ext = matched[2];
					if (ext && ext.toLowerCase() == 'xml') {
						map[filepath] = parser.parse(filepath, options.warnings ? console : {log:function(){}});
					} else {
						map[filepath] = JSON.parse(fs.readFileSync(filepath).toString());
					}
					xmlPathToFilename[filepath] = filepath;
				} catch(ex) {
					delete map[filepath];
				}
				return map;
			}, {});

			if (options.aggregate) {
				prev = comparer.aggregate(prev, options.aggregate);
				xmlPathToFilename[options.aggregate] = options.aggregate;
			}
		} else {
			isPrevPrefix = true;
			prev = Object.keys(parsedData).reduce(function(map, filepath) {
				var filename = filepath.substring(filepath.lastIndexOf('/') + 1, filepath.lastIndexOf('.'));
				xmlPathToFilename[filepath] = filename;
				var path = options.prev + filename + '.js';
				try {
					map[filepath] = JSON.parse(fs.readFileSync(path).toString());
				} catch(ex) {
					delete map[filepath];
				}
				return map;
			}, {});
		}

		console.log('Comparing to:\n  ' + Object.keys(prev).map(function(filepath){
			var filename = (!isPrevPrefix ? 
				xmlPathToFilename[filepath] : 
				options.prev + xmlPathToFilename[filepath] + '.js')
			return filename;
		}).join('\n  '));

		if (Object.keys(prev).length > 0) {
			var tooSlow = comparer.compare(prev, parsedData, (options.threshold || 0) / 1000);
			var pathsArr = [];

			var count = Object.keys(tooSlow).reduce(function(c, filepath){
				var path = options.out + xmlPathToFilename[filepath] + '.js';
				pathsArr.push(path);
				fs.writeFileSync(path, JSON.stringify(tooSlow[filepath]));
				
				var duplicates = [];
				return Object.keys(tooSlow[filepath]).reduce(function(c, testsuite){
					if (options.verbose) {
						console.log(testsuite);
						Object.keys(tooSlow[filepath][testsuite]).forEach(function(testcase) {
							console.log('  ' + testcase);
							console.log('    baseTime: ' + tooSlow[filepath][testsuite][testcase].baseTime);
							console.log('    currentTime: ' + tooSlow[filepath][testsuite][testcase].currentTime);
						});
					}

					return c + Object.keys(tooSlow[filepath][testsuite]).length;
				}, c);
			}, 0);
			console.log(count + ' tests were slower than expected!');
			console.log('For details see: \n  ' + pathsArr.join('\n  '));
		}

		if (isPrevPrefix && (options.override || Object.keys(prev).length == 0)) {
			console.log('Saving prev files:')
			Object.keys(parsedData).forEach(function(filepath) {
				var path = options.prev + xmlPathToFilename[filepath] + '.js';
				console.log('  ' + path);
				fs.writeFileSync(path, JSON.stringify(parsedData[filepath]));
			});
		}
	});
};
