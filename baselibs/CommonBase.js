import { default as C } from './C.js';
import { Log } from './DataClasses.js';
import { default as MessageStrings } from './MessageStrings.js';


/**
 * Base class for common functionality needed around the
 * background page objects.
 */
class CommonBase {
    listenerKey = undefined;
    log = undefined;
    stop = false;

    static counter = 0;
    static stopListeners = {};
    static resumeListeners = {};

    /**
     * Constructor that takes a C.LOG_SRC value.
     * It sets up the log as well as the event listener for STOP.
     * 
     * @param {string} logSrc 
     */
    constructor(logSrc) {
        // Set up the log using the logSrc, or use the default ('[Gimme*3]').
        this.log = new Log(
            (!!logSrc ? logSrc : C.LOG_SRC.DEFAULT)
        );

        // Make a unique key to use for stopListeners and resumeListeners. Not useful at the 
        // moment, but will be when/if we must deregister them.
        this.listenerKey = C.KEY.LISTENER_PREFIX + (CommonBase.counter++) + C.ST.E;

        // Listen for the stop event. It should be a once-in-an-app-instance, so remove
        // the event listener when we get the stop event. We never want to stop listening for 
        // stop events. DO NOT REMOVE THE EVENT LISTENER. (However, if things change, having
        // them in static maps helps really remove them.)
        var me = this;
        CommonBase.stopListeners[this.listenerKey] = (evt) => {
            if (evt.STOP === C.ACTION.STOP) {
                //window.document.removeEventListener(C.ACTION.STOP, CommonBase.stopListeners[this.listenerKey]);
                //delete CommonBase.stopListeners[this.listenerKey];

                me.log.lm(`${typeof(this)} is setting stop = true.`);
                me.stop = true;
            }
        };
        window.document.addEventListener(C.ACTION.STOP, CommonBase.stopListeners[this.listenerKey]);

        // Listen for the resume event. It might not exist yet, but will, to keep a 
        // dig going after stop has canceled a batch or two. We never want to stop listening
        // for resume evens. DO NOT REMOVE THE EVENT LISTENER. (However, if things change, having
        // them in static maps helps really remove them.)
        CommonBase.resumeListeners[this.listenerKey] = (evt) => {
            if (evt.RESUME === C.ACTION.RESUME) {
                //window.document.removeEventListener(C.ACTION.RESUME, CommonBase.resumeListeners[this.listenerKey]);
                //delete CommonBase.resumeListeners[this.listenerKey];

                this.stop = false;
            }
        };
        window.document.addEventListener(C.ACTION.RESUME, CommonBase.resumeListeners[this.listenerKey]);
    }


    /**
     * Helper shortcut to log. "this.log.log" is too much.
     * @param {any} message 
     */
    lm(message) {
        this.log.log(message);
    }


    /**
     * Helper shortcut to log a stop event message. "this.lm(`${C.ST.STOP_BANG} ...`)" is too much.
     * @param {any} stopMessage 
     */
    lsm(stopMessage) {
        this.lm(`${MessageStrings.STOP_SIGNAL} ${stopMessage}`);
    }

    /**
     * Helper to know if we're in <STOP> mode. the error message is an optional param.
     * 
     * @param {any} errorMessage 
     */
    isSTOP(optionalErrorMessage) {
        return (
            (this.stop === true) ||
            (optionalErrorMessage === C.ACTION.STOP)
        );
    }
}


// Export.
export default CommonBase;
