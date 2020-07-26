import { default as C } from './C.js';
import { Log } from './DataClasses.js';


/**
 * Base class for common functionality needed around the
 * background page objects.
 */
class CommonBase {
    log = undefined;
    stop = false;


    /**
     * Constructor that takes a C.LOG_SRC value.
     * It sets up the log as well as the event listener for STOP.
     * 
     * @param {string} logSrc 
     */
    constructor(logSrc) {
        var me = this;

        // Set up the log using the logSrc, or use the default ('[Gimme*3]').
        me.log = new Log(
            (!!logSrc ? logSrc : C.LOG_SRC.DEFAULT)
        );

        // Listen for the stop event. It should be a once-in-an-app-instance, so remove
        // the event listener when we get the stop event.
        var stopFunc = (evt) => {
            if (evt.STOP === C.ACTION.STOP) {
                window.document.removeEventListener(C.ACTION.STOP, stopFunc);
                me.stop = true;
            }
        };
        window.document.addEventListener(C.ACTION.STOP, stopFunc);

        // Listen for the resume event. It might not exist yet, but will, to keep a 
        // dig going after stop has canceled a batch or two.
        var resumeFunc = (evt) => {
            if (evt.RESUME === C.ACTION.RESUME) {
                window.document.removeEventListener(C.ACTION.RESUME, resumeFunc);
                me.stop = false;
            }
        };
        window.document.addEventListener(C.ACTION.RESUME, resumeFunc);
    }


    /**
     * Helper shortcut to log. "this.log.log" is too much.
     * @param {any} message 
     */
    lm(message) {
        this.log.log(message);
    }


    /**
     * Helper shortcut to log a stop event message. "this.log.log(`${C.ST.STOP_BANG} ...`)" is too much.
     * @param {any} stopMessage 
     */
    lsm(stopMessage) {
        this.log.log(`${MessageStrings.STOP_SIGNAL} ${stopMessage}`);
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