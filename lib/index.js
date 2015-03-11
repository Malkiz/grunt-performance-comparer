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
		var totalSkippedCount = 0;
		var pathsArr = [];

		loopBoth(base, current, function (filename, baseFile, currentFile) {
			var xml = builder.create('testsuites');
			xml.att('thresholdAvg', threshold.avg);
			xml.att('thresholdStd', threshold.std);
			xml.att('thresholdSuites', threshold.suites);

			var suite = xml.ele('testsuite', { name: 'All Browsers' });
			var specs = {};

			loopBoth(baseFile, currentFile, function (browserName, baseSuite, currentSuite) {

				loopBoth(baseSuite.testcases, currentSuite.testcases, function (fullName, baseResult, currentResult) {
					var classname = currentResult.classname;
					if (classname.indexOf(browserName + '.') == 0) {
						classname = classname.substr(browserName.length + 1);
					}
					var specName = classname + ' ' + currentResult.name;

					specs[specName] = specs[specName] || {browsers: {}};

					var baseTime = parseFloat(baseResult.time);
					var currentTime = parseFloat(currentResult.time);

					var spec = specs[specName].browsers[browserName] = {
						name: currentResult.name, 
						classname: classname, 
						baseTime: baseTime, 
						currentTime: currentTime
				    };

				    if (baseResult.times) {
				    	spec.baseTimes = baseResult.times;
				    }
				    if (currentResult.times) {
				    	spec.currentTimes = currentResult.times;
				    }

					spec.detailsMessage = 
			    		getDetailsMessage('base', baseResult, baseTime) + '\n' +
			    		getDetailsMessage('current', currentResult, currentTime);

			    	var skip = {};

			    	if (currentResult.noPerformanceTest == "true" || currentResult.noPerformanceTest == true) {
			    		skip.message = 'Flag: noPerformanceTest = true';
			    	} else if (baseTime + threshold.avg < currentTime) {
				    	if ((baseResult.std != null && baseResult.std > threshold.std) ||
					    		(currentResult.std != null && currentResult.std > threshold.std)) {
				    		skip.message = 'Standard deviation is larger than the threshold';
				    	} else {
							spec.failure = {
								message : 'Current runtime (' + currentTime + ') exceeded baseTime (' + baseTime + ') + threshold (' + threshold.avg + ')'
							};
				    	}
					} else if (currentTime + threshold.avg < baseTime) {
						spec.faster = true;
					}

					if (skip.message) {
						spec.skipped = skip;
						totalSkippedCount++;
						// console.log(currentResult.name);
						return;
					}

					totalCount++;
				});
			});

			var suiteCount = 0;
			var suiteFailureCount = 0;

			loop(specs, function (fullName, specsObj) {
				suiteCount++;

				var browserNames = Object.keys(specsObj.browsers);
				var firstSpec = specsObj.browsers[browserNames[0]];
				var spec = suite.ele('testcase', {
					name: firstSpec.name, 
					classname: firstSpec.classname
			    });

				var failureCount = 0;
				var skippedCount = 0;
				var failureMessage = '';
				var skipMessage = '';
				var baseTimes = [];
				var currentTimes = [];

				browserNames.forEach(function (browserName){
					var browserSpec = specsObj.browsers[browserName];
					if (browserSpec.failure) {
						failureCount++;
						failureMessage += '\n' + browserName + ':\n' + browserSpec.failure.message + '\n' + browserSpec.detailsMessage;
						pushData(filename, browserName, fullName, browserSpec.baseTime, browserSpec.currentTime, tooSlow);
					}
					if (browserSpec.faster) {
						pushData(filename, browserName, fullName, browserSpec.baseTime, browserSpec.currentTime, faster);
					}
					if (browserSpec.skipped) {
						skippedCount++;
						skipMessage += '\n' + browserName + ':\n' + browserSpec.skipped.message + '\n' + browserSpec.detailsMessage;
					}

					if (browserSpec.baseTimes) {
						baseTimes = baseTimes.concat(browserSpec.baseTimes);
					} else {
						baseTimes.push(browserSpec.baseTime);
					}

					if (browserSpec.currentTimes) {
						currentTimes = currentTimes.concat(browserSpec.currentTimes);
					} else {
						currentTimes.push(browserSpec.currentTime);
					}
				});

				var baseTime = baseTimes.reduce(function (s,t){return s+t;}, 0) / baseTimes.length;
				var currentTime = currentTimes.reduce(function (s,t){return s+t;}, 0) / currentTimes.length;
				spec.att('baseTime', baseTime);
				spec.att('currentTime', currentTime);
				spec.att('time', currentTime);

				if (failureCount >= threshold.suites || (browserNames.length < threshold.suites && failureCount > 0)) {
					suiteFailureCount++;
					spec.ele('failure', {}, failureMessage);
				} else if (skippedCount > 0) {
					spec.ele('skipped', {}, skipMessage);
				}
			});

			suite.att('tests', suiteCount);
			suite.att('failures', suiteFailureCount);

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

		console.log('Compared ' + totalCount + ' tests (skipped ' + totalSkippedCount + ')');

		return {tooSlow: tooSlow, faster: faster, pathsArr: pathsArr, totalCount: totalCount, skippedCount: totalSkippedCount};
	}

	function getDetailsMessage(name, resultObj, time) {
		return 'All run times: ' + name + ': ' + JSON.stringify(resultObj.times || time) + '\n' +
			'variance: ' + resultObj.variance + ', standard deviation: ' + resultObj.std;
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