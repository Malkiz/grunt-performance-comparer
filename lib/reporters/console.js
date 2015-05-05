function consoleReporter() {
	this.runEnded = function(props) {
		console.log('Compared ' + props.tests + ' tests (skipped ' + props.skipped + ')');
	};
}

exports.Reporter = new consoleReporter();