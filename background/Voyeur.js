import { default as Utils } from './Utils.js';

/** 
 * Singleton.
 * Web Navigation listener for GimmeGimmieGimmie. Listens to web requests in order to 
 * see what media is being requested.
 */
var Voyeur = (function Voyeur(Utils) {
    // instance object
    var me = {
        uris: [],
        isWatching: false,
    };

    var u = Utils;

    me.start = function start() {
        if (me.isWatching) { return; };

        u.queryActiveTab()
        .then(function setUpMediaHeadersListener(tab) {
            u.addMediaHeadersListener(watchMedia, tab.windowId, tab.id);
            me.isWatching = true;    
        });
    }   
    
    function watchMedia(details) {
        console.log('[Voyeur] pushing uri: [' + details.url + '] type: [' + details.type +']');
    };


    me.stop = function stop() {
        if (!me.isWatching) { return; };
        
        u.removeMediaHeadersListener(watchMedia);
        me.isWatching = false;
    };

    // Return our singleton.
    return me;
})(Utils);

export default Voyeur;