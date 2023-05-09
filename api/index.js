import { calls } from './methods.js';
import { config } from './../config.js'

class api {
    
    constructor() {
        for (var i = 0; i < calls.length; i++) {
            var call = calls[i];
            this[call.action] = async function() {
                for (var i = 0; i < call.params.length; i++) {
                    if (!arguments[i]) {
                        throw new Error('Missing parameter: ' + call.params[i]);
                    } else {
                        call.path = call.path.replace('$' + (i + 1), arguments[i]);
                    }
                }
                var url = config.node + call.path;
                var response = await fetch(url, {
                    method: call.method,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                var result = await response.json();
                return result;
            }
        }
    }

}

export { api }