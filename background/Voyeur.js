import { default as Utils } from './Utils.js';
import { default as C } from '../lib/C.js';
import { default as CommonStaticBase } from '../lib/CommonStaticBase.js';

/** 
 * Singleton.
 * Web Navigation listener for GimmeGimmeGimme. Listens to web requests in order to 
 * see what media is being requested.
 */
class Voyeur extends CommonStaticBase {
    static uris = [];
    static isWatching = false;


    /**
     * Do setup for this static class. Call the super constructor to make a log
     * and setup STOP handlers.
     */
    static setup() {
        if (!Utils.exists(Voyeur.log)) {
            super.setup(C.LOG_SRC.VOYEUR);
        }
    }

    /**
     * Start watching the network traffic. 
     */
    static start() {
        if (Voyeur.isWatching) { return; };

        Voyeur.log.log('Starting watch on all loading media.');

        Utils.queryActiveTab().then((tab) => {
            Utils.addMediaHeadersListener(Voyeur.watchMedia, tab.windowId, tab.id);
            Voyeur.isWatching = true;    
        });
    }   
    

    /**
     * Log network traffic.
     * @param {} details 
     */
    static watchMedia(details) {
        console.log('[Voyeur] pushing uri: [' + details.url + '] type: [' + details.type +']');
    };


    /**
     * Stop watching network traffic.
     */
    static stop() {
        if (!this.isWatching) { return; };

        Voyeur.log.log('Stopping watch on all loading media.')
        
        Utils.removeMediaHeadersListener(Voyeur.watchMedia);
        Voyeur.isWatching = false;
    };
}


// Set the class on the background window just in case.
if (!window.hasOwnProperty(C.WIN_PROP.VOYEUR_CLASS) && Utils.isBackgroundPage(window)) {
    window[C.WIN_PROP.VOYEUR_CLASS] = Voyeur;

    // Event Listener for STOP.
    window.document.addEventListener(C.ACTION.STOP, () => {
        Voyeur.log.log('Got STOP event.');
        Voyeur.stop();
    });
}


// Export
export default Voyeur;