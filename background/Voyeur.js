import { default as Utils } from './Utils.js';

/** 
 * Singleton.
 * Web Navigation listener for GimmeGimmeGimme. Listens to web requests in order to 
 * see what media is being requested.
 */
class Voyeur {
    static uris = [];
    static isWatching = false;


    /**
     * Start watching the network traffic. 
     */
    static start() {
        if (Voyeur.isWatching) { return; };

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
        
        Utils.removeMediaHeadersListener(Voyeur.watchMedia);
        Voyeur.isWatching = false;
    };
}

window['Voyeur'] = Voyeur;

export default Voyeur;