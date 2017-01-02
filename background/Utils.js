'use strict'

/**
 * Utils service for GimmeGimmeGimme. It holds all the random bric-a-brac
 * functions that make our lives easier.
 */
var Utils = (function Utils() {
    var me = {};

    /**
     * Check if a variable really exists.
     */
    me.exists = function exists(obj) { 
        // var isUndefined = (typeof obj === 'undefined');
        // if (isUndefined) { return false; }

        // var isFalsy = (!obj || obj == '');
        // if (isFalsy) { return false; }

        // var isWhitespace = (obj.trim && obj.trim() === '');
        // if (isWhitespace) { return false; }

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


    return me;
}());