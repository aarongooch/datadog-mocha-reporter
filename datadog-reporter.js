const mocha = require('mocha');
const dogapi = require('dogapi');
module.exports = DatadogReporter;

/**
 * Initialize a new `JSON` reporter.
 *
 * @public
 * @class JSON
 * @memberof Mocha.reporters
 * @extends Mocha.reporters.Base
 * @param {Runner} runner
 */
function DatadogReporter(runner, options) {

  dogapi.initialize({
    api_key: options.reporterOptions.datadogAPIKey,
    app_key: options.reporterOptions.datadogAPPKey
  });

  mocha.reporters.Base.call(this, runner);
  const self = this;
  const env = options.reporterOptions.env || 'production';
  const tags = options.reporterOptions.tags || '';
  const eventTitle = options.reporterOptions.eventTitle || 'Datadog Mocha Reporter';
  const tests = [];
  const pending = [];
  const failures = [];
  const passes = [];

  runner.on('test end', function(test) {
    tests.push(test);
  });

  runner.on('pass', function(test) {
    passes.push(test);
  });

  runner.on('fail', function(test) {
    failures.push(test);
  });

  runner.on('pending', function(test) {
    pending.push(test);
  });

  runner.once('end', function() {
    const obj = {
      stats: self.stats,
      tests: tests.map(clean),
      pending: pending.map(clean),
      failures: failures.map(clean),
      passes: passes.map(clean)
    };

    runner.testResults = obj;

    process.stdout.write(JSON.stringify(obj, null, 2));

    if (obj.failures.length > 0) {
      dogapi.event.create(eventTitle, JSON.stringify(obj.failures, null, 2), { tags, alert_type: 'error', aggregation_key: 'test_failures' });
    } else {
      dogapi.event.create(eventTitle, `Tests Passed: \n${JSON.stringify(obj.stats, null, 2)}`, { tags, alert_type: 'success' });
    }

  });
}

/**
 * Return a plain-object representation of `test`
 * free of cyclic properties etc.
 *
 * @private
 * @param {Object} test
 * @return {Object}
 */
function clean(test) {
  let err = test.err || {};
  if (err instanceof Error) {
    err = errorJSON(err);
  }

  return {
    title: test.title,
    fullTitle: test.fullTitle(),
    duration: test.duration,
    currentRetry: test.currentRetry(),
    err: cleanCycles(err)
  };
}

/**
 * Replaces any circular references inside `obj` with '[object Object]'
 *
 * @private
 * @param {Object} obj
 * @return {Object}
 */
function cleanCycles(obj) {
  const cache = [];
  return JSON.parse(
    JSON.stringify(obj, function(key, value) {
      if (typeof value === 'object' && value !== null) {
        if (cache.indexOf(value) !== -1) {
          // Instead of going in a circle, we'll print [object Object]
          return '' + value;
        }
        cache.push(value);
      }

      return value;
    })
  );
}

/**
 * Transform an Error object into a JSON object.
 *
 * @private
 * @param {Error} err
 * @return {Object}
 */
function errorJSON(err) {
  const res = {};
  Object.getOwnPropertyNames(err).forEach(function(key) {
    res[key] = err[key];
  }, err);
  return res;
}

DatadogReporter.description = 'single JSON object';