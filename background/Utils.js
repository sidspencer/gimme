'use strict'

/**
 * Utils service/singleton for Gimme. It holds all the random bric-a-brac
 * functions that make our lives easier.
 */
var Utils = (function Utils() {
    var me = {};

    /**
     * Check if a variable really exists.
     */
    me.exists = function exists(obj) { 
        if (!!obj) {
            return true;
        }

        return false;
    };


    /**
     * Is it an empty object?
     */
    me.isEmpty = function isEmpty(obj) {
        for(var key in obj) {
            if(obj.hasOwnProperty(key))
                return false;
        }
        return true;
    };


    /**
     * Check the src/uri/href/filename for known audio extensions.
     */
    me.isAllowedAudioFile = function isAllowedAudioFile(name) {
        var allowedRx = /^.+?\.(mp3|m4a|aac|wav|ogg|aiff|aif|flac)(\?)?.+?$/i;
        return allowedRx.test(name);
    };


    /**
     * Check the src/uri/href/filename for known video extensions.
     */
    me.isAllowedVideoFile = function isAllowedVideoFile(name) {
        var allowedRx = /^.+?\.(mp4|flv|f4v|m4v|mpg|mpeg|wmv|mov|avi|divx|webm)(\?)?.+?$/i;
        return allowedRx.test(name);
    };


    /**
     * Check the src/uri/href/filename for known image extensions.
     */
    me.isAllowedImageFile = function isAllowedImageFile(name) {
        var allowedRx = /^.+?\.(jpg|jpeg|gif|png|tiff|tif|pdf)(\?)?.+?$/i;
        return allowedRx.test(name);
    }


    /**
     * Construct a baseUri suitable for passing to the URL() constructor.
     * It either builds it off the passed-in location obj, or it uses the Digger's
     * cached "locator".
     */
    me.getBaseUri = function getBaseUri(loc) {
        var baseUri = loc.href.substring(0, loc.href.lastIndexOf('/')+1);
        return baseUri;
    };


    /**
     * Create a URL object from a src/href.
     */
    me.srcToUrl = function srcToUrl(src, loc) {
        if (!me.exists(src)) { 
            src = 'data:'; 
        }

        var cleansedUrl = new URL(src, me.getBaseUri(loc));

        // Use the URL object to fix all our woes.
        return cleansedUrl;
    };


    /**
     * Cleanse and scrub a src into a Uri string.
     */
    me.srcToUri = function srcToUri(src, l) {
        return u.srcToUrl(src, l).href;
    };
    

    /**
     * Does it match a regex in our list of blacklist regexes?
     */
    me.isBannedUri = function isBannedUri(uri) {
        if (typeof uri === 'undefined') {
            return true;
        }
        else if (/\/zip\.php\?/.test(uri)) {
            return true;
        }
        else if (/\.zip/.test(uri)) {
            return true;
        }
        else {
            return false;
        }
    };


    /**
     * Do we think we know what type this file is? And do we want it?
     */
    me.isKnownFileType = function isKnownFileType(name) {
        return (
            !me.isBannedUri(name) &&
            (me.isAllowedImageFile(name) || me.isAllowedVideoFile(name) || me.isAllowedAudioFile(name))  
        );
    };


    /**
     * Is this a URI that an XHR can be completed against? Does it have a valid protocol?
     */
    me.isFetchableUri = function isFetchableUri(uri) {
        return (
            /^(http|https|data|blob|chrome|chrome-extension)\:/.test(uri)
        );
    };


    // return the singleton
    return me;
})();