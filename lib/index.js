(function () {
	var builder = require('xmlbuilder');
	var path = require('path');
	var fs = require('fs');

	function compare(base, current, threshold, getOutputFileNameFn) {
		var tooSlow = {};

		function pushSlow(filename, testsuite, fullName, baseTime, currentTime) {
			var file = tooSlow[filename] = tooSlow[filename] || {};
			var suite = file[testsuite] = file[testsuite] || {};
			suite[fullName] = {baseTime: baseTime, currentTime: currentTime};
		}

		var totalCount = 0;
		var pathsArr = [];

		loopBoth(base, current, function(filename, baseFile, currentFile) {
			var xml = builder.create('testsuites');
			xml.att('threshold', threshold);

			loopBoth(baseFile, currentFile, function(testsuite, baseSuite, currentSuite) {
				var suite = xml.ele('testsuite', { name: testsuite });
				var suiteCount = 0;
				var suiteFailureCount = 0;

				loopBoth(baseSuite.testcases, currentSuite.testcases, function(fullName, baseResult, currentResult) {
					totalCount++;
					suiteCount++;
					var baseTime = parseFloat(baseResult.time);
					var currentTime = parseFloat(currentResult.time);

					var spec = suite.ele('testcase', {
						fullName: fullName, baseTime: baseTime, currentTime: currentTime
				    });

					if (baseTime + threshold < currentTime) {
						suiteFailureCount++;
						pushSlow(filename, testsuite, fullName, baseTime, currentTime);
				    	spec.ele('failure', {type: ''}, 'Current runtime exceeded baseTime + threshold');
					}
				});

				suite.att('tests', suiteCount);
				suite.att('failures', suiteFailureCount);
			});

			try {
				var outputPath = getOutputFileNameFn(filename);
				fs.writeFileSync(outputPath, xml.end({pretty: true}));
				pathsArr.push(outputPath);
			} catch(err) {
				console.log('Cannot write JUnit xml\n\t' + err.message);
			}
		});

		console.log('Compared ' + totalCount + ' tests.');

		return {tooSlow: tooSlow, pathsArr: pathsArr, totalCount: totalCount};
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

	function aggregate(data, filename) {
		var joined = {};
		loop(data, function (filename, fileObj){
			loop(fileObj, function (testsuite, suiteObj) {
				joined[testsuite] = joined[testsuite] || {testcases: {}};
				var joinedSuite = joined[testsuite].testcases;
				loop(suiteObj.testcases, function (fullName, result) {
					var time = parseFloat(result.time);
					joinedSuite[fullName] = joinedSuite[fullName] || {time: {sum: 0, count: 0}};
					joinedSuite[fullName].time.sum += time;
					joinedSuite[fullName].time.count++;
				});
			});
		});

		loop(joined, function (testsuite, suiteObj) {
			loop(suiteObj.testcases, function (fullName, result) {
				result.time = result.time.sum / result.time.count;
			});
		});

		var retVal = {};
		retVal[filename] = joined;
		return retVal;
	}
	
	exports.compare = compare;
	exports.aggregate = aggregate;
})()