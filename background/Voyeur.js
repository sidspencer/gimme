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
    static isWatching = Voyeur.stopVoying = false;


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
    static startVoying() {
        if (Voyeur.isWatching) { return C.CAN_FN.PR_RS_DEF(); };

        Voyeur.lm('Starting watch on all loading media.');

        return Utils.queryActiveTab().then(
            (tab) => {
                Utils.addMediaHeadersListener(Voyeur.watchMedia, tab.windowId, tab.id);
                Voyeur.isWatching = true;    
            }
        );
    }   
    

    /**
     * Log network traffic.
     * @param {} details 
     */
    static watchMedia(details) {
        this.lm('[Voyeur] pushing uri: [' + details.url + '] type: [' + details.type +']');
    }


    /**
     * Stop watching network traffic.
     */
    static stopVoying() {
        if (!Voyeur.isWatching) { return C.CAN_FN.PR_RS_DEF(); };

        this.lm('Stopping watch on all loading media.')
        
        Utils.removeMediaHeadersListener(Voyeur.watchMedia);
        Voyeur.stop = Voyeur.isWatching = false;

        return C.CAN_FN.PR_RS_DEF();
    }


    /**
     * Called by popup to toggle the Voyeur.
     */
    static toggleVoying() {
        return(
            voy.isWatching ?
            voy.stopVoying() :
            voy.startVoying()
        );
    }
}


// Set the class on the background window just in case.
if (Utils.isBackgroundPage(window) && !window.hasOwnProperty(C.WIN_PROP.VOYEUR_CLASS)) {
    window[C.WIN_PROP.VOYEUR_CLASS] = Voyeur;
}


// Export
export default Voyeur;