(function () {
	function compare(base, current, threshold) {
		var tooSlow = {};

		function pushSlow(filename, testsuite, fullName, baseTime, currentTime) {
			var file = tooSlow[filename] = tooSlow[filename] || {};
			var suite = file[testsuite] = file[testsuite] || {};
			suite[fullName] = {baseTime: baseTime, currentTime: currentTime};
		}

		var count = 0;

		loopBoth(base, current, function(filename, baseFile, currentFile) {
			loopBoth(baseFile, currentFile, function(testsuite, baseSuite, currentSuite) {
				loopBoth(baseSuite.testcases, currentSuite.testcases, function(fullName, baseResult, currentResult) {
					count++;
					var baseTime = parseFloat(baseResult.time);
					var currentTime = parseFloat(currentResult.time);
					if (baseTime + threshold < currentTime) {
						pushSlow(filename, testsuite, fullName, baseTime, currentTime);
					}
				});
			});
		});

		console.log('Compared ' + count + ' tests.');

		return tooSlow;
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