var formatFailedStep = function(failedExpectation) {

  var stack = failedExpectation.stack;
  var message = failedExpectation.message;
  if (stack) {
    // remove the trailing dot
    var firstLine = stack.substring(0, stack.indexOf('\n') - 1);
    if (message && message.indexOf(firstLine) === -1) {
      stack = message + '\n' + stack;
    }

    // remove jasmine stack entries
    return stack.replace(/\n.+jasmine\.js\?\d*\:.+(?=(\n|$))/g, '');
  }

  return message;
};

var indexOf = function(collection, item) {
  if (collection.indexOf) {
    return collection.indexOf(item);
  }

  for (var i = 0, ii = collection.length; i < ii; i++) {
    if (collection[i] === item) {
      return i;
    }
  }

  return -1;
};


// TODO(vojta): Karma might provide this
var getCurrentTransport = function() {
  // probably running in debug.html (there's no socket.io)
  if (!window.parent.io) {
    return null;
  }

  var location = window.parent.location;
  return window.parent.io.sockets[location.protocol + '//' + location.host].transport.name;
};


/**
 * Very simple reporter for jasmine
 */
var KarmaReporter = function(tc) {

  var getAllSpecNames = function(topLevelSuites) {
    var specNames = {};

    var processSuite = function(suite, pointer) {
      var childSuite;
      var childPointer;

      for (var i = 0; i < suite.suites_.length; i++) {
        childSuite = suite.suites_[i];
        childPointer = pointer[childSuite.description] = {};
        processSuite(childSuite, childPointer);
      }

      pointer._ = [];
      for (var j = 0; j < suite.specs_.length; j++) {
        pointer._.push(suite.specs_[j].description);
      }
    };

    var suite;
    var pointer;
    for (var k = 0; k < topLevelSuites.length; k++) {
      suite = topLevelSuites[k];
      pointer = specNames[suite.description] = {};
      processSuite(suite, pointer);
    }

    return specNames;
  };

  this.jasmineStarted = function(options) {
    var transport = getCurrentTransport();
    // TODO(max): specNames are missing (no way to get them in 2.0.0-rc2, I guess)
    var specNames = [];

    // This structure can be pretty huge and it blows up socke.io connection, when polling.
    // https://github.com/LearnBoost/socket.io-client/issues/569
    if (transport === 'websocket' || transport === 'flashsocket') {
      //specNames = getAllSpecNames(runner.topLevelSuites());
    }

    tc.info({total: options.totalSpecsDefined || 0, specs: specNames});
  };

  this.jasmineDone = function() {
    tc.complete({
      coverage: window.__coverage__
    });
  };

  this.specStarted = function(specResult) {
    specResult.time = new Date().getTime();
  };

  this.specDone = function(specResult) {
    var skipped = specResult.status === 'disabled' || specResult.status === 'pending';

    var endOfSuiteName = (
        specResult.fullName.length
      - specResult.description.length
      - 1
    );
    var suite = [specResult.fullName.slice(0, endOfSuiteName)];

    var result = {
      id: specResult.id,
      description: specResult.description,
      suite: suite, // karma requires 'suite' to be an Array
      //fullName: specResult.fullName,
      success: specResult.failedExpectations.length === 0,
      skipped: skipped,
      time: skipped ? 0 : new Date().getTime() - specResult.time,
      log: []
    };

    for (var i = 0; i < specResult.failedExpectations.length; i++) {
      result.log.push(formatFailedStep(specResult.failedExpectations[i]));
    }

    tc.result(result);

    delete specResult.time;

    // memory clean up
    // spec.results_ = null;
    // spec.spies_ = null;
    // spec.queue = null;
};

  this.log = function() {};
};


// note(maciej-filip-sz): code from jasmine's boot.js, without html-reporter
// makes jasmine and jasmine interface functions global
var bootJasmine = function(env) {
  var jasmineRequire = getJasmineRequireObj();
  
  /**
   * ## Require &amp; Instantiate
   *
   * Require Jasmine's core files. Specifically, this requires and attaches all of Jasmine's code to the `jasmine` reference.
   */
  window.jasmine = jasmineRequire.core(jasmineRequire);

  /**
   * ## The Global Interface
   *
   * Build up the functions that will be exposed as the Jasmine public interface. A project can customize, rename or alias any of these functions as desired, provided the implementation remains unchanged.
   */
  var jasmineInterface = {
    describe: function(description, specDefinitions) {
      return env.describe(description, specDefinitions);
    },

    xdescribe: function(description, specDefinitions) {
      return env.xdescribe(description, specDefinitions);
    },

    it: function(desc, func) {
      return env.it(desc, func);
    },

    xit: function(desc, func) {
      return env.xit(desc, func);
    },

    beforeEach: function(beforeEachFunction) {
      return env.beforeEach(beforeEachFunction);
    },

    afterEach: function(afterEachFunction) {
      return env.afterEach(afterEachFunction);
    },

    expect: function(actual) {
      return env.expect(actual);
    },

    pending: function() {
      return env.pending();
    },

    spyOn: function(obj, methodName) {
      return env.spyOn(obj, methodName);
    },

    jsApiReporter: new jasmine.JsApiReporter({
      timer: new jasmine.Timer()
    })
  };

  /**
   * Add all of the Jasmine global/public interface to the proper global, so a project can use the public interface directly. For example, calling `describe` in specs instead of `jasmine.getEnv().describe`.
   */
  extend(window, jasmineInterface);

  /**
   * Expose the interface for adding custom equality testers.
   */
  jasmine.addCustomEqualityTester = function(tester) {
    env.addCustomEqualityTester(tester);
  };

  /**
   * Expose the interface for adding custom expectation matchers
   */
  jasmine.addMatchers = function(matchers) {
    return env.addMatchers(matchers);
  };

  /**
   * Expose the mock interface for the JavaScript timeout functions
   */
  jasmine.clock = function() {
    return env.clock;
  };


  /**
   * The `jsApiReporter` also receives spec results, and is used by any environment that needs to extract the results  from JavaScript.
   */
  env.addReporter(jasmineInterface.jsApiReporter);


  /**
   * Setting up timing functions to be able to be overridden. Certain browsers (Safari, IE 8, phantomjs) require this hack.
   */
  window.setTimeout = window.setTimeout;
  window.setInterval = window.setInterval;
  window.clearTimeout = window.clearTimeout;
  window.clearInterval = window.clearInterval;


  /**
   * Helper function for readability above.
   */
  function extend(destination, source) {
    for (var property in source) destination[property] = source[property];
    return destination;
  }


  return env;
}


// we pass jasmineEnv during testing
// in production we ask for it lazily, so that adapter can be loaded even before jasmine
var createStartFn = function(tc, jasmineEnvPassedIn) {
  var jasmineRequire = getJasmineRequireObj();
  var jasmineEnv = bootJasmine(
       jasmineEnvPassedIn
    || jasmineRequire.core(jasmineRequire).getEnv()
  );

  return function(config) {
    jasmineEnv.addReporter(new KarmaReporter(tc));
    jasmineEnv.execute();
  };
};
