module.exports = function(grunt) {
	var parser = require('junit-xml-parser');
	var comparer = require('../lib/index.js');
	var fs = require('fs');
	var path = require('path');
	var chalk = require('chalk');

	grunt.registerMultiTask('performance-comparer', 'compare performance results', function(){
		var _this = this;
		var options = _this.options();
		var override = grunt.option('override');
		var xmlFilePaths = _this.files.reduce(function(arr, file) {
			return arr.concat(file.src);
		}, []);

		console.log('The threshold is ' + JSON.stringify(options.threshold) + ' (seconds)');

		console.log('Parsing files:\n  ' + xmlFilePaths.join('\n  '));

		var parsedData = xmlFilePaths.reduce(function(map, filepath) {
			map[filepath] = parser.parse(filepath, options.warnings ? console : {log:function(){}});
			return map;
		}, {});

		var xmlPathToFilename = {};

		if (options.aggregate) {
			console.log('Aggregating to ' + options.aggregate);
			parsedData = comparer.aggregate(parsedData, options.aggregate, options.adaptResultFn);
		}

		var failure = Object.keys(parsedData).reduce(function (b, filepath) {
			return b || Object.keys(parsedData[filepath]).reduce(function (b, testsuite) {
				return b || Object.keys(parsedData[filepath][testsuite].testcases).reduce(function (b, fullName) {
					return b || parsedData[filepath][testsuite].testcases[fullName].failure;
				}, false);
			}, false);
		}, false);

		if (failure) {
			console.log('There were failed tests - aborting performance test.');
			return;
		}

		var isPrevPrefix = false;
		var prev = grunt.file.expand(options.prev);
		var prevFileNames;
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

			prevFileNames = Object.keys(prev);

			if (options.aggregate) {
				prev = comparer.aggregate(prev, options.aggregate, options.adaptResultFn);
				xmlPathToFilename[options.aggregate] = options.aggregate;
			}
		} else {
			isPrevPrefix = true;
			prev = Object.keys(parsedData).reduce(function (map, filepath) {
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

			prevFileNames = Object.keys(prev);
		}

		console.log('Comparing to:\n  ' + prevFileNames.map(function (filepath){
			var filename = (!isPrevPrefix ? 
				xmlPathToFilename[filepath] : 
				options.prev + xmlPathToFilename[filepath] + '.js')
			return filename;
		}).join('\n  '));

		var numTooSlow = 0;
		if (Object.keys(prev).length > 0) {
			var compareResult = comparer.compare(prev, parsedData, options.threshold,
				function (filepath) {
					var ext = path.extname(xmlPathToFilename[filepath]);
					var name = path.basename(xmlPathToFilename[filepath], ext);
					return options.out + name + '.xml';
				});
			var tooSlow = compareResult.tooSlow;
			var faster = compareResult.faster;

			numTooSlow = Object.keys(tooSlow).reduce(function(c, filepath){
				return Object.keys(tooSlow[filepath]).reduce(function(c, testsuite){
					if (options.verbose) {
						console.log(testsuite);
						Object.keys(tooSlow[filepath][testsuite]).forEach(function(testcase) {
							console.log(chalk.red('  ' + testcase));
							console.log('    baseTime: ' + chalk.yellow(tooSlow[filepath][testsuite][testcase].baseTime));
							console.log('    currentTime: ' + chalk.yellow(tooSlow[filepath][testsuite][testcase].currentTime));
						});
					}

					return c + Object.keys(tooSlow[filepath][testsuite]).length;
				}, c);
			}, 0);

			var numFaster = Object.keys(faster).reduce(function(c, filepath){
				return Object.keys(faster[filepath]).reduce(function(c, testsuite){
					if (options.verbose) {
						console.log(testsuite);
						Object.keys(faster[filepath][testsuite]).forEach(function(testcase) {
							console.log(chalk.green('  ' + testcase));
							console.log('    baseTime: ' + chalk.cyan(faster[filepath][testsuite][testcase].baseTime));
							console.log('    currentTime: ' + chalk.cyan(faster[filepath][testsuite][testcase].currentTime));
						});
					}

					return c + Object.keys(faster[filepath][testsuite]).length;
				}, c);
			}, 0);

			console.log(zero(numTooSlow) + ' tests were slower than expected!');
			console.log(gtZero(numFaster) + ' tests were faster than expected!');
			console.log('For details see: \n  ' + compareResult.pathsArr.join('\n  '));
		}

		if (isPrevPrefix && (override || options.override || Object.keys(prev).length == 0)) {
			console.log('Saving prev files:')
			Object.keys(parsedData).forEach(function(filepath) {
				var path = options.prev + xmlPathToFilename[filepath] + '.js';
				console.log('  ' + path);
				fs.writeFileSync(path, JSON.stringify(parsedData[filepath]));
			});
		}

		if (numTooSlow > 0 && options.error) {
			throw new Error(numTooSlow + ' tests were slower than expected!');
		}
	});

	function conditionColor(str, condition, success, fail) {
		return (condition) ? success(str) : fail(str);
	}

	function zero(num) {
		return conditionColor(num, num == 0, chalk.green, chalk.red);
	}

	function gtZero(num) {
		return conditionColor(num, num > 0, chalk.green, chalk.white);
	}
};
