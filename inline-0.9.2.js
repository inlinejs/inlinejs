// inlinejs version 0.9.1

(function() {

    // borrowed from angular
    var isArray = (function() {
      if (typeof Array.isArray === 'undefined') {
        return function(value) {
          return toString.call(value) === '[object Array]';
        };
      }
      return Array.isArray;
    })();

    // borrowed from angular
    var isObject = function(value) {
        return value != null && typeof value === 'object';
    }

    var foreach = function(arg, func) {    
        if (!isArray(arg) && !isObject(arg))
            var arg = [arg];
        if (isArray(arg)) {
            for (var i=0; i<arg.length; i++) {
                func(arg[i], i, arg);
            }
        } else if (isObject(arg)) {
            for (var key in arg) {
                func(arg[key], key, arg);
            }
        }
    }

    var map = function(arr, func) {
        if (!isArray(arr))
            return func(arr);
        var mapped = [];
        for (var i=0; i<arr.length; i++) {
            var result = func(arr[i]);
            if (typeof result !== 'undefined') {
                mapped.push(result);
            }
        }
        return mapped;
    }

    var filter = function(arr, func) {
        if (!isArray(arr))
            var arg = [arr];
        var filtered = [];
        for (var i=0; i<arr.length; i++) {
            var value = arr[i];
            var result = func(arr[i]);
            if (typeof result === 'boolean' && result) {
                filtered.push(value);
            }
        }
        return filtered;
    }

    var __extends = this.__extends || function (d, b) {
        for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
        function __() { this.constructor = d; }
        __.prototype = b.prototype;
        d.prototype = new __();
    };

    var Action = (function () {
        
        function Action(inline) {
            this.id = inline.$nextId();
            this.inline = inline;
            this.isNested = false;
        }

        Action.prototype.onSuccess = function(data) {
            this.inline.resolve(this.id, data);
        }
        
        Action.prototype.onError = function (err) {
            this.inline.reject(this.id, err);
        }

        Action.prototype.run = function() {
            this.onSuccess('done');
        }
        
        return Action;

    })();


    var Execute = (function(_super) {

        __extends(Execute, _super);

        function Execute(inline) {
            _super.call(this, inline);
            this.func = function(){};
            this.args = [];
        }

        Execute.prototype.use = function(func, args) {
            this.func = func;
            if (isArray(args))
                this.args = args;
            return this;
        }

        Execute.prototype.run = function() {
            for (var i=0; i<this.args.length; i++) { 
                this.args[i] = this.inline.unwrap(this.args[i]);
            }
            var result = this.func.apply(window, this.args);
            this.onSuccess(result);
        }

        return Execute;

    })(Action);


    var Conditional = (function(_super) {

        __extends(Conditional, _super);

        function Conditional(inline) {
            _super.call(this, inline);
            this.method = 'run';
            this.arg = undefined;
            this.func = null;
        }

        Conditional.prototype.if = function(arg, func) {
            this.$use('if', arg, func);
            return this;
        }

        Conditional.prototype.ifnot = function(arg, func) {
            this.$use('ifnot', arg, func);
            return this;
        }

        Conditional.prototype.$use = function(method, arg, func) {
            if (typeof func !== 'function')
                throw 'second argument for if/ifnot must be a function';
            this.method = method;
            this.func = func;
            this.arg = arg;
        }

        Conditional.prototype.run = function() {
            if (this.arg instanceof Future)
                var condition = this.arg.isSuccess;
            else
                var condition = this.inline.unwrap(this.arg) ? true : false;
            
            if (this.method === 'ifnot')
                condition = !condition;
            
            var result;
            if (condition)
                result = this.func();
            this.onSuccess(result);
        }

        return Conditional;

    })(Action);


    var Iteration = (function(_super) {

        __extends(Iteration, _super);

        function Iteration(inline) {
            _super.call(this, inline);
            this.method = undefined;
            this.arg = undefined;
            this.func = undefined;
        }

        Iteration.prototype.foreach = function(arg, func) {
            this.$use('foreach', arg, func);
            return this;
        }

        Iteration.prototype.map = function(arg, func) {
            this.$use('map', arg, func);
            return this;
        }

        Iteration.prototype.filter = function(arg, func) {
            this.$use('filter', arg, func);
            return this;
        }

        Iteration.prototype.concat = function(arg, func) {
            this.method = '$concat';
            this.arg = args;
            return this;
        }

        Iteration.prototype.$use = function(method, arg, func) {
            if (method !== 'foreach' && typeof func === 'string')
                var func = new Function('item', 'return ' + func);
            if (typeof func !== 'function')
                throw method + ' second arg must be a function';
            this.method = '$' + method;
            this.arg = arg;
            this.func = func;
        }

        Iteration.prototype.$foreach = function() {
            var collection = this.inline.unwrap(this.arg);
            foreach(collection, this.func);
        }

        Iteration.prototype.$map = function() {
            var collection = this.inline.unwrap(this.arg);
            return map(collection, this.func);
        }

        Iteration.prototype.$filter = function() {
            var collection = this.inline.unwrap(this.arg);
            return filter(collection, this.func);
        }

        Iteration.prototype.$concat = function() {
            var result = [];
            for (var i=0; i<this.arg.length; i++) {
                var arr = this.inline.unwrap(this.arg[i]);
                result = result.concat(arr);
            }
            return result;
        }

        Iteration.prototype.run = function() {
            var result = this[this.method]();
            this.onSuccess(result);
        }

        return Iteration;

    })(Action);


    var Sleep = (function (_super) {
        
        __extends(Sleep, _super);

        function Sleep(inline) {
            _super.call(this, inline);
            this.time = 0;
        }

        Sleep.prototype.setTime = function(time) {
            this.time = time;
            return this;
        }

        Sleep.prototype.run = function() {
            setTimeout(this.onSuccess.bind(this), this.time);
        }

        return Sleep;

    })(Action);


    var JQueryAjax = (function (_super) {
        
        __extends(JQueryAjax, _super);

        function JQueryAjax(inline) {
            _super.call(this, inline);

            this.config = {
                dataType: 'json',
                processData: true,
                type: 'GET',
                url: '',
                data: {},
                // errorContent, return error content instead of request object
                errorContent: true
            }
        }

        JQueryAjax.prototype.onError = function (err) {
            if (this.config.errorContent)
                var err = err.responseJSON;
            this.inline.reject(this.id, err);
        };

        JQueryAjax.prototype.settings = function(obj) {
            if (typeof obj === 'undefined')
                return;
            for (var k in obj) {
                this.config[k] = obj[k];
            }
        }

        JQueryAjax.prototype.$renderArgs = function() {
            this.config.data = this.inline.unwrap(this.config.data);
            if (!this.config.processData)
                this.config.data = JSON.stringify(this.config.data);
            return this;
        }

        JQueryAjax.prototype.get = function(url, params, config) {
            this.settings({url: url, data: params});
            this.settings(config);
            return this;
        }

        JQueryAjax.prototype.jsonp = function(url, params, config) {
            this.get(url, params, config);
            this.settings({dataType: 'jsonp'});
            return this;
        }

        JQueryAjax.prototype.post = function(url, params, config) {
            this.settings({url: url, data: params, type: 'POST'});
            this.settings(config);
            return this;
        }

        JQueryAjax.prototype.body = function(url, params, config) {
            this.settings({
                url: url,
                data: params,
                type: 'POST',
                processData: false,
                contentType: 'text/json'
            });
            this.settings(config);
            return this;
        }

        JQueryAjax.prototype.run = function() {
            this.$renderArgs();
            jQuery.ajax(this.config)
            .done(this.onSuccess.bind(this))
            .fail(this.onError.bind(this));
        }
        
        return JQueryAjax;

    })(Action);


    var Parallel = (function(_super) {

        __extends(Parallel, _super);

        function Parallel(inline) {
            _super.call(this, inline);
            this.actions = [];
            this.futures = [];
            this.keys = [];
            this.pointers = [];
        }

        Parallel.prototype.add = function(futures) {
            if (futures.length === 1)
                var futures = futures[0];
            
            if (isArray(futures)) {
                for (var i=0; i<futures.length; i++) {
                    this.addFuture(futures[i]);
                }
            } else {
                for (var key in futures) {
                    this.keys.push(key);
                    this.addFuture(futures[key]);
                }
            }

            for (var i=0; i<this.futures.length; i++) {
                var future = this.futures[i];
                future.asNested(this.id);
                if (!future.isResolved) {
                    var action = this.inline.removeAction(future);
                    if (action instanceof Action) {
                        this.actions.push(action);
                    } else {
                        future.resolve();
                    }
                }
            }
            return this;
        }

        // add the future to a local array and the key for future values

        Parallel.prototype.addFuture = function(future) {
            if (this.inline.isFutureValue(future)) {
                var pointer = Object.keys(future)[0];
                this.futures.push(future[pointer]);
                this.pointers.push(pointer);
            } else {
                this.futures.push(future);
                this.pointers.push(null);
            }
        }

        // return the resolved futures in the form they were added array/object

        Parallel.prototype.getFutures = function() {
            var futures = [];
            for (var i=0; i<this.futures.length; i++) {
                var pointer = this.pointers[i];
                if (typeof pointer === 'string')
                    futures.push({pointers: this.futures[i]});
                else
                    futures.push(this.futures[i]);
            }
            if (!this.keys.length)
                return futures;
            var obj = {};
            for (var i=0; i<this.futures.length; i++)
                obj[this.keys[i]] = futures[i];
            return obj;
        }

        // check if all actions are resolved

        Parallel.prototype.isResolved = function() {
            for (var i=0; i<this.futures.length; i++) {
                if (!this.futures[i].isResolved) {
                    return false;
                }
            }
            return true;
        }

        // called by Inline when action returns

        Parallel.prototype.notify = function() {
            if (this.isResolved()) {
                this.onSuccess(this.getFutures());
            }
        }

        Parallel.prototype.run = function() {
            for (var i=0; i<this.actions.length; i++) {
                try {
                    var action = this.actions[i];
                    action.run();
                } catch(err) {
                    action.onError(err.toString());
                }
            }
        }

        return Parallel;

    })(Action);


    var Future = (function() {
            
        function Future(id) {
            this.id = id;
            this.isNested = false;
            this.parentId = null;
            this.isResolved = false;
            this,isSuccess = false;
            this.data = undefined;
            this.isError = false;
            this.error = undefined;
            this.fallbackData = undefined;
            this.actions = [];
        }

        Future.prototype.$check = function(data) {
            return true;
        }

        Future.prototype.$catch = function(){};

        Future.prototype.$applyActions = function() {
            for (var i=0; i<this.actions.length; i++) {
                var result = this.actions[i](this.data);
                if (typeof result !== 'undefined')
                    this.data = result;
            }
        }

        Future.prototype.asNested = function(parentId) {
            this.isNested = true;
            this.parentId = parentId;
            return this;
        }

        Future.prototype.fallback = function(data) {
            this.fallbackData = data;
            return this;
        }

        Future.prototype.check = function(func) {
            if (typeof func === 'string')
                var func = Function('data', 'return ' + func);
            this.$check = func;
            return this;
        }

        Future.prototype.catch = function(func) {
            this.onCatch = func;
            return this;
        }

        Future.prototype.apply = function(func) {
            this.actions.push(func);
            return this;
        }

        Future.prototype.modify = function(func) {
            if (typeof func === 'string')
                var func = Function('data', 'return ' + func);
            this.actions.push(func);
            return this;
        }

        Future.prototype.foreach = function(func) {
            this.actions.push(function(data) {
                foreach(data, func);
            });
            return this;
        }

        Future.prototype.map = function(func) {
            if (typeof func === 'string')
                var func = Function('item', 'return ' + func);
            this.actions.push(function(data) {
                return map(data, func);
            });
            return this;
        }

        Future.prototype.filter = function(func) {
            if (typeof func === 'string')
                var func = Function('item', 'return ' + func);
            this.actions.push(function(data) {
                return filter(data, func);
            });
            return this;
        }

        Future.prototype.key = function(key) {
            this.modify(key);
            return this;
        }

        Future.prototype.index = function(index) {
            this.actions.push(function(data) {
                return data[key];
            });
            return this;
        }

        Future.prototype.resolve = function(data) {
            this.isResolved = true;
            if (this.$check(data)) {
                this.isSuccess = true;
                this.data = data;
                this.$applyActions();
            } else {
                this.reject(data);
            }
        }

        Future.prototype.reject = function(error) {
            this.isResolved = true;
            if (this.fallbackData === undefined) {
                this.isError = true;
                this.error = error;
                this.$catch(error);
            } else {
                this.isSuccess = true;
                this.data = this.fallbackData;
                this.$applyActions();
            }
        }

        return Future;

    })();


    window.Inline = (function() {
            
        function Inline(config) {
            this.$chain = [];
            this.$subChain = [];
            this.$idCounter = 0;
            this.$index = 0;
            this.isStarted = false;
            this.isFinished = false;
            this.isPaused = false;
            this.autoStartOn = false;
            this.futures = {};

            this.instConfig = this.config;
            if (typeof config !== 'undefined') {
                for (var key in config) {
                    this.instConfig[key] = config[key];
                }
            }
        }
     
        Inline.prototype.config = {
            debug: false,
            reset: true,
            autoStart: true
        }

        Inline.prototype.$nextId = function() {
            this.$idCounter++;
            return 'R' + this.$idCounter;
        }

        Inline.prototype.$next = function() {
            if (this.isPaused) {
                return;
            }
            if (this.$subChain.length) {
                this.$chain = [].concat(
                    this.$chain.slice(0, this.$index),
                    this.$subChain,
                    this.$chain.slice(this.$index)
                );
                this.$subChain = [];
            }
            if (this.$index < this.$chain.length) {
                try {
                    var action = this.$chain[this.$index++];
                    action.run();
                } catch(err) {
                    if (typeof err === 'string')
                        err = new Error(err);
                    
                    if (['pause', 'stop', 'skip'].indexOf(err.message) !== -1) {
                        if (err.message === 'pause')
                            this.isPaused = true;
                        else if (err.message === 'stop')
                            this.reset();
                        else if (err.message === 'skip')
                            action.onSuccess('skip');
                        return;
                    }

                    if (this.instConfig.debug)
                        console.error(err.stack);
                    else
                        action.onError(err.message);
                }
            } else {
                if (this.instConfig.reset && !this.instConfig.debug) {
                    this.reset();
                } else {
                    this.isStarted = false;
                    this.isFinished = true;
                }
            }
        }

        Inline.prototype.resolve = function(id, data) {
            var future = this.futures[id];
            if (future instanceof Future) {
                future.resolve(data);
                this.moveOn(future);
            }
        }

        Inline.prototype.reject = function(id, error) {
            var future = this.futures[id];
            if (future instanceof Future) {
                future.reject(error);
                this.moveOn(future);
            }
        }

        Inline.prototype.moveOn = function(future) {
            if (future.isNested) {
                this.notify(future.parentId);
            } else {
                this.$next();
            }
        }

        // all pulic action methods must call this method to register action and return class Future

        Inline.prototype.registerAction = function(action) {
            if (!(action instanceof Action)) {
                throw 'invalid action';
            }

            if (this.isStarted) {
                this.$subChain.push(action);
            } else {
                this.$chain.push(action);
            }

            var future = new Future(action.id);
            this.futures[action.id] = future;

            if (this.instConfig.autoStart)
                this.autoStart();

            return future;
        }

        // called is confit.autoStart = true

        Inline.prototype.autoStart = function() {
            if (this.autoStartOn)
                return;
            setTimeout(this.start.bind(this), 0);
        }

        // find action in chain or subChain

        Inline.prototype.getAction = function(id) {
            var chain = [].concat(this.$chain, this.$subChain);
            for (var i=0; i<chain.length; i++) {
                if (id === chain[i].id) {
                    return chain[i];
                }
            }
        }

        // remove action from chain in order to run it in class Parallel

        Inline.prototype.removeAction = function(future) {
            var action = this.getAction(future.id);
            if (action instanceof Action) {
                if (this.$chain.indexOf(action) !== -1)
                    this.$chain.splice(this.$chain.indexOf(action), 1);
                else if (this.$subChain.indexOf(action) !== -1)
                    this.$subChain.splice(this.$subChain.indexOf(action), 1);
            }
            return action;      
        }

        // notify class Parallel when nested action has finished

        Inline.prototype.notify = function(id) {
            var action = this.getAction(id);
            if (action instanceof Action) {
                action.notify(id);
            }
        }

        // test methods

        Inline.prototype.isFutureValue = function(arg) {
            if (!isObject(arg))
                return false;
            var keys = Object.keys(arg);
            if (keys.length !== 1)
                return false;
            var key = keys[0]
            return arg[key] instanceof Future;
        }

        Inline.prototype.typeOf = function(value) {
            if (value instanceof Future)
                return 'future';
            if (this.isFutureValue(value))
                return 'futurevalue';
            if (isArray(value))
                return 'array';
            return typeof value;
        }

        // methods for fetching data

        Inline.prototype.getFutureValue = function(arg) {
            try {
                var key = Object.keys(arg)[0];
                return new Function('future', 'return future.' + key)(arg[key]);
            } catch(err) {
                return undefined;
            }
        }

        Inline.prototype.$unwrap = function(arg) {
            var argType = this.typeOf(arg);
            if (argType == 'future')
                return arg.data;
            if (argType == 'futurevalue')
                return this.getFutureValue(arg);
            return arg;
        }

        Inline.prototype.unwrap = function(arg) {
            var self = this;
            var value = this.$unwrap(arg);
            if (isArray(value)) {
                for (var i=0; i<value.length; i++) {
                    value[i] = this.$unwrap(value[i]);
                }
            } else if (isObject(value)) {
                for (var key in value) {
                    value[key] = this.$unwrap(value[key])
                }
            }
            return value;
        }

        // standard public methods

        Inline.prototype.start = function() {
            if (this.isStarted)
                return;
            this.isStarted = true;
            this.$next();
        }

        Inline.prototype.stop = function() {
            throw 'stop';
        }

        Inline.prototype.reset = function() {
            this.$chain = [];
            this.$index = 0;
            this.isStarted = false;
            this.isFinished = false;
            this.isPaused = false;
            this.futures = {};
        }

        Inline.prototype.pause = function() {
            var action = new Execute(this).use(function() {
                throw 'pause';
            });
            return this.registerAction(action);
        }

        Inline.prototype.resume = function() {
            this.isPaused = false;
            this.$next();
        }

        Inline.prototype.skip = function() {
            throw 'skip';
        }   

        Inline.prototype.instanceOf = function(config) {
            if (typeof config === 'undefined')
                var config = this.instConfig;
            return new Inline(config);
        }

        Inline.prototype.future = function() {
            return new Future(this.$nextId());
        }

        // run method for class Execute

        Inline.prototype.run = function(func) {
            var args = Array.prototype.slice.call(arguments);
            var func = args.shift();
            return this.registerAction(new Execute(this).use(func, args));
        }

        // sleep method for class Sleep

        Inline.prototype.sleep = function(time) {
            return this.registerAction(new Sleep(this).setTime(time));
        }

        // conditional methods for class Conditional

        Inline.prototype.if = function(condition, func) {
            return this.registerAction(new Conditional(this).if(condition, func));
        }

        Inline.prototype.ifnot = function(condition, func) {
            return this.registerAction(new Conditional(this).ifnot(condition, func));
        }

        // iteration methods for class Iteration

        Inline.prototype.foreach = function(collection, func) {
            return this.registerAction(new Iteration(this).foreach(collection, func));
        }

        Inline.prototype.map = function(collection, func) {
            return this.registerAction(new Iteration(this).map(collection, func));
        } 

        Inline.prototype.filter = function(collection, func) {
            return this.registerAction(new Iteration(this).filter(collection, func));
        }

        Inline.prototype.concat = function(collection, func) {
            var args = Array.prototype.slice.call(arguments);
            return this.registerAction(new Iteration(this).concat(args));
        }

        // par method for class Parallel

        Inline.prototype.par = function() {
            var args = Array.prototype.slice.call(arguments);
            return this.registerAction(new Parallel(this).add(args));
        }

        // ajax methods for class JQueryAjax

        Inline.prototype.get = function(url, params, config) {
            return this.registerAction(new JQueryAjax(this).get(url, params, config));
        }

        Inline.prototype.jsonp = function(url, params, config) {
            return this.registerAction(new JQueryAjax(this).jsonp(url, params, config));
        }

        Inline.prototype.post = function(url, params, config) {
            return this.registerAction(new JQueryAjax(this).post(url, params, config));
        }

        Inline.prototype.body = function(url, params, config) {
            return this.registerAction(new JQueryAjax(this).body(url, params, config));
        }

        return Inline;

    })();

    window.InlineExpose = function(member) {
        switch (member) {
            case '__extends': return __extends;
            case 'Action': return Action;
            case 'Execute': return Execute;
            case 'Conditional': return Conditional;
            case 'Iteration': return Iteration;
            case 'Sleep': return Sleep;
            case 'JQueryAjax': return JQueryAjax;
            case 'Parallel': return Parallel;
            case 'Future': return Future;
            default: throw new Error('no member named ' + member)
        }
    }

})();




