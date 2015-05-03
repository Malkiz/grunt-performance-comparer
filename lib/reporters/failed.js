var fs = require('fs');
var path = require('path');

function failedReporter() {
	var _specName,
		_failedArr,
		_props,
		_filePath;

	this.init = function(options) {
		_props = options.failedReporter || {};
		console.log(_props);
		_filePath = (_props.outputFile || 'failed-tests.txt');
	};

	this.runStarted = function(threshold) {
		_failedArr = [];
	};

	this.specStarted = function(props) {
		_specName = props.classname + ' ' + props.name;
	};

	this.specFailed = function(failureMessage) {
		_failedArr.push(_specName);
	};

	this.runEnded = function(props) {
		try {
			var dir = path.dirname(_filePath);
			if (!fs.existsSync(dir)){
				fs.mkdirSync(dir);
			}
			fs.writeFileSync(_filePath, formatOutput());
		} catch(err) {
			console.log('Cannot write ' + _filePath + '\n\t' + err.message);
		}
	};

	function formatOutput() {
		var template = _props.template;
		var str = JSON.stringify(_failedArr);
		if (!template) {
			return str;
		}
		var isFile;
		var templatePath;
		try {
			templatePath = path.resolve(template);
			var stats = fs.statSync(templatePath);
			isFile = stats.isFile();
		} catch(ex) {
			isFile = false;
		}

		if (isFile) {
			var template = fs.readFileSync(templatePath).toString();
		}
		var placeholder = _props.placeholder || '%PLACEHOLDER%';
		if (template.indexOf(placeholder) < 0) {
			throw new Error('placeholder not found in template!');
		}
		return template.replace(placeholder, str);
	};
}

exports.Reporter = new failedReporter();