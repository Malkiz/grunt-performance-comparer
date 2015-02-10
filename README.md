# grunt-performance-comparer
compare performance results from junit-xml-parser output json

## Grunt Config Options
```javascript
'performance-comparer': {
	options: {
		prev: 'tests-reports/prev-',
		out: 'tests-reports/report-',
		warnings: false,
		threshold: 20,
		override: true
	},
	unit: {
		src: 'tests-reports/unitests-results.xml',
	}
}
```

## Use with "watch" for development
Here is an example how to use this task with watch and karma (with junit reporter).
```javascript
concurrent: {
  	options: {
  		logConcurrentOutput: true
  	},
    unit: ['karma:unit', 'watch:unit']
},

watch: {
  options: {
  	spawn: false,
  },
  unit: {
  	files: ['tests-reports/unitests-results.xml'],
  	tasks: ['performance-comparer:unit']
  }
},

'performance-comparer': {
  options: {
  	prev: 'tests-reports/prev-',
  	out: 'tests-reports/report-',
  	warnings: false,
  	threshold: 20,
  	override: true
  },
  unit: {
  	src: 'tests-reports/unitests-results.xml',
  }
},

karma : {
  unit: {
    configFile : 'test-config/karma-unit.conf.js',
    reporters: ['dots', 'junit'],
		junitReporter: {
      outputFile: '../tests-reports/unitests-results.xml'
    }
  }
}
```
