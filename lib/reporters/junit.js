var builder = require('xmlbuilder');
var path = require('path');
var fs = require('fs');

function xmlReporter() {
	var _threshold,
		_xml,
		_filename,
		_suite,
		_spec;

	this.runStarted = function(threshold) {
		_threshold = threshold;
	};

	this.fileStarted = function(filename) {
		_filename = filename;
		_xml = builder.create('testsuites');
		_xml.att('thresholdAvg', _threshold.avg);
		_xml.att('thresholdStd', _threshold.std);
		_xml.att('thresholdSuites', _threshold.suites);
	};

	this.suiteStarted = function(suiteName) {
		_suite = _xml.ele('testsuite', { name: suiteName });
	};

	this.specStarted = function(props) {
		_spec = _suite.ele('testcase', {
			name: props.name, 
			classname: props.classname
	    });
	};

	this.specUpdated = function(props) {
		for (var key in props) {
			_spec.att(key, props[key]);
		}
	};

	this.specFailed = function(failureMessage) {
		_spec.ele('failure', {}, failureMessage);
	};

	this.specSkipped = function(skipMessage) {
		_spec.ele('skipped', {}, skipMessage);
	};

	this.suiteEnded = function(props) {
		_suite.att('tests', props.tests);
		_suite.att('failures', props.failures);
	};

	this.fileEnded = function(outputPath) {
		try {
			var dir = path.dirname(outputPath);
			if (!fs.existsSync(dir)){
				fs.mkdirSync(dir);
			}
			fs.writeFileSync(outputPath, _xml.end({pretty: true}));
		} catch(err) {
			console.log('Cannot write JUnit xml\n\t' + err.message);
		}
	};
}

exports.Reporter = new xmlReporter();