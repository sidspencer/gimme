import { default as C } from './C.js';
import { Log } from './DataClasses.js';


/**
 * Base class for common functionality needed around the
 * background page objects.
 */
class CommonStaticBase {
    static listenerKey = '';
    static log = undefined;
    static stop = false;

    static counter = 0;
    static stopListeners = {};
    static resumeListeners = {};

    /**
     * "Constructor" that takes a C.LOG_SRC value.
     * It sets up the log as well as the event listener for STOP.
     * 
     * @param {string} logSrc 
     */
    static setup(logSrc) {
        // Set up the log using the logSrc, or use the default ('[Gimme*3]').
        this.log = new Log(
            (!!logSrc ? logSrc : C.LOG_SRC.DEFAULT)
        );

        // Listen for the stop event.
        this.listenerKey = C.KEY.LISTENER_PREFIX + (this.counter++) + C.ST.E;
        this.stop = false;
        
        // Listen for the stop event. It should be a once-in-an-app-instance, so remove
        // the event listener when we get the stop event.
        this.stopListeners[this.listenerKey] = (evt) => {
            if (evt.STOP === C.ACTION.STOP) {
                //window.document.removeEventListener(C.ACTION.STOP, stopFunc);
                //delete this.stopListeners[this.listenerKey]

                this.stop = true;
            }
        };
        window.document.addEventListener(C.ACTION.STOP, this.stopListeners[this.listenerKey]);

        // Listen for the resume event. It might not exist yet, but will, to keep a 
        // dig going after stop has canceled a batch or two.
        this.resumeListeners[this.listenerKey] = (evt) => {
            if (evt.RESUME === C.ACTION.RESUME) {
                //window.document.removeEventListener(C.ACTION.RESUME, resumeFunc);
                //delete this.resumeListeners[this.listenerKey]

                this.stop = false;
            }
        };
        window.document.addEventListener(C.ACTION.RESUME, this.resumeListeners[this.listenerKey]);
    }


    /**
     * Helper shortcut to log. "this.log.log" is too much.
     * @param {any} message 
     */
    static lm(message) {
        this.log.log(message);
    }


    /**
     * Helper shortcut to log a stop event message. "this.log.log(`${C.ST.STOP_BANG} ...`)" is too much.
     * @param {any} stopMessage 
     */
    static lsm(stopMessage) {
        this.lm(`${C.ST.STOP_BANG} ${stopMessage}`);
    }

    
    /**
     * Helper to know if we're in <STOP> mode. the error message is an optional param.
     * 
     * @param {any} errorMessage 
     */
    static isSTOP(optionalErrorMessage) {
        return (
            (this.stop === true) ||
            (optionalErrorMessage === C.ACTION.STOP)
        );
    }
}


// export
export default CommonStaticBase;