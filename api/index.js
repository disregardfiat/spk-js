import { calls } from './methods.js';
import { config } from './../config.js'

class Api {
    constructor() {
        for (var i = 0; i < calls.length; i++) {
            const call = calls[i];
            this[call.action] = makeFunc(call);
        }
    }
    setSpkNode(url) {
        config.spk_node = url;
    }

}

const api = new Api();

function makeFunc(call){
    return async function (){
        for (var i = 0; i < call.params.length; i++) {
            if (!arguments[i]) {
                throw new Error('Missing parameter: ' + call.params[i]);
            } else {
                call.path = call.path.replace('$' + (i + 1), arguments[i]);
            }
        }
        var url = config.spk_node + call.path;
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

export { api }