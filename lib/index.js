(function () {
	function compare(base, current, threshold) {
		var tooSlow = {};

		function pushSlow(filename, testsuite, fullName, baseTime, currentTime) {
			var file = tooSlow[filename] = tooSlow[filename] || {};
			var suite = file[testsuite] = file[testsuite] || {};
			suite[fullName] = {baseTime: baseTime, currentTime: currentTime};
		}

		loopBoth(base, current, function(filename, baseFile, currentFile) {
			loopBoth(baseFile, currentFile, function(testsuite, baseSuite, currentSuite) {
				loopBoth(baseSuite.testcases, currentSuite.testcases, function(fullName, baseResult, currentResult) {
					var baseTime = parseFloat(baseResult.time);
					var currentTime = parseFloat(currentResult.time);
					if (baseTime + threshold < currentTime) {
						pushSlow(filename, testsuite, fullName, baseTime, currentTime);
					}
				});
			});
		});

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
	
	exports.compare = compare;
})()