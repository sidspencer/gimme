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
        // Set up the log using the logSrc, or use the default ('[Gimme*3]').
        this.log = new Log(
            (!!logSrc ? logSrc : C.LOG_SRC.DEFAULT)
        );

        // Listen for the stop event.
        this.stop = false;
        window.document.addEventListener(C.ACTION.STOP, (evt) => {
            if (evt.STOP === C.ACTION.STOP) {
                this.stop = true;
            }
        });
    }


    /**
     * Helper shortcut to log. "this.log.log" is too much.
     * @param {any} message 
     */
    lm(message) {
        this.log.log(message);
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

export default CommonBase;