(function () {
	var builder = require('xmlbuilder');
	var path = require('path');
	var fs = require('fs');

	function compare(base, current, threshold, getOutputFileNameFn) {
		var tooSlow = {};
		var faster = {};

		function pushData(filename, testsuite, fullName, baseTime, currentTime, dataObj) {
			var file = dataObj[filename] = dataObj[filename] || {};
			var suite = file[testsuite] = file[testsuite] || {};
			suite[fullName] = {baseTime: baseTime, currentTime: currentTime};
		}

		var totalCount = 0;
		var skippedCount = 0;
		var pathsArr = [];

		loopBoth(base, current, function(filename, baseFile, currentFile) {
			var xml = builder.create('testsuites');
			xml.att('threshold', threshold);

			loopBoth(baseFile, currentFile, function(testsuite, baseSuite, currentSuite) {
				var suite = xml.ele('testsuite', { name: testsuite });
				var suiteCount = 0;
				var suiteFailureCount = 0;

				loopBoth(baseSuite.testcases, currentSuite.testcases, function(fullName, baseResult, currentResult) {
					suiteCount++;
					var baseTime = parseFloat(baseResult.time);
					var currentTime = parseFloat(currentResult.time);

					var spec = suite.ele('testcase', {
						name: currentResult.name, classname: currentResult.classname, baseTime: baseTime, currentTime: currentTime
				    });

					if (currentResult.noPerformanceTest == "true" || currentResult.noPerformanceTest == true) {
						spec.ele('skipped');
						skippedCount++;
						return;
					}

					totalCount++;

					if (baseTime + threshold < currentTime) {
						suiteFailureCount++;
						pushData(filename, testsuite, fullName, baseTime, currentTime, tooSlow);
				    	spec.ele('failure', {type: ''}, 
				    		'Current runtime (' + currentTime + ') exceeded baseTime (' + baseTime + ') + threshold (' + threshold + ')\n' +
				    		'All run times: base: ' + JSON.stringify(baseResult.times || baseTime) + '\n' +
				    		'variance: ' + baseResult.variance + ', standard deviation: ' + baseResult.std + '\n' +
				    		'All run times: current: ' + JSON.stringify(currentResult.times || currentTime) + '\n' +
				    		'variance: ' + currentResult.variance + ', standard deviation: ' + currentResult.std);
					} else if (currentTime + threshold < baseTime) {
						pushData(filename, testsuite, fullName, baseTime, currentTime, faster);
					}
				});

				suite.att('tests', suiteCount);
				suite.att('failures', suiteFailureCount);
			});

			try {
				var outputPath = getOutputFileNameFn(filename);
				var dir = path.dirname(outputPath);
				if (!fs.existsSync(dir)){
					fs.mkdirSync(dir);
				}
				fs.writeFileSync(outputPath, xml.end({pretty: true}));
				pathsArr.push(outputPath);
			} catch(err) {
				console.log('Cannot write JUnit xml\n\t' + err.message);
			}
		});

		console.log('Compared ' + totalCount + ' tests (skipped ' + skippedCount + ')');

		return {tooSlow: tooSlow, faster: faster, pathsArr: pathsArr, totalCount: totalCount, skippedCount: skippedCount};
	}

	function loopBoth(a, b, callback) {
		if (a && b) {
			for (var key in a) {
				if (a.hasOwnProperty(key) && b.hasOwnProperty(key)) {
					callback(key, a[key], b[key]);
				}
			}
		}
	}

	function loop(obj, callback) {
		for (var key in obj) {
			if (obj.hasOwnProperty(key)) {
				callback(key, obj[key]);
			}
		}
	}

	function aggregate(data, filename, adaptResultFn) {
		var joined = {};
		adaptResultFn = adaptResultFn || function (result) { return result; };

		loop(data, function (filename, fileObj){
			loop(fileObj, function (testsuite, suiteObj) {
				joined[testsuite] = joined[testsuite] || {testcases: {}};
				var joinedSuite = joined[testsuite].testcases;
				loop(suiteObj.testcases, function (fullName, result) {
					var time = parseFloat(result.time);
					var joinedResult = joinedSuite[fullName] = (joinedSuite[fullName] || {
						classname: result.classname,
						name: result.name,
						times: [],
					});
					joinedResult.times.push(time);
					joinedResult.noPerformanceTest = (joinedResult.noPerformanceTest || (result.noPerformanceTest == "true"));
					joinedResult.skipped = (joinedResult.skipped || result.skipped);
					joinedResult.failure = (joinedResult.failure || result.failure);
				});
			});
		});

		loop(joined, function (testsuite, suiteObj) {
			loop(suiteObj.testcases, function (fullName, result) {
				var result = adaptResultFn(result);
				var sum = result.times.reduce(function(s,n){return s+n;},0);
				result.time = sum / result.times.length;
				result.variance = result.times.reduce(function(s,n){return s+Math.pow(n-result.time,2);},0) / result.times.length;
				result.std = Math.sqrt(result.variance);
			});
		});

		var retVal = {};
		retVal[filename] = joined;
		return retVal;
	}
	
	exports.compare = compare;
	exports.aggregate = aggregate;
})()