'use strict'

/**
 * Utils service/singleton for Gimme. It holds all the random bric-a-brac
 * functions that make our lives easier.
 */
var Utils = (function Utils() {
    var me = {};

     // Constants
     var GIMME_ID = 'gimme';


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


    /**
     * Pull out the filename from a uri, or fallback to the whole thing.
     */
    me.extractFilename = function extractFilename(uri) {
        var lsi = uri.lastIndexOf('/');
        var filename = uri.substring((lsi === -1) ? 0 : (lsi + 1));

        return filename;
    }


    /**
     * factory function for a LocDoc
     */
    me.createLocDoc = function createLocDoc(loc, doc) {
        return {
            loc: loc,
            doc: doc,
        };
    };


    /**
     * factory for a TabMessage
     */
    me.createTabMessage = function createTabMessage(tab, message) {
        return {
            tab: tab,
            message: {
                selector: message.selector,
                linkHrefProp: message.linkHrefProp,
                thumbSrcProp: message.thumbSrcProp,
                useRawValues: !!message.useRawValues,
            },
        };
    };

    /**
     * factory for a DownloadSig
     */
    me.createDownloadSig = function createDownloadSig(id, uri, fileName) {
        return {
            id: id,
            uri: uri,
            fileName: fileName,
        };
    };


    /**
     * factory for FileOption
     */
    me.createFileOption = function createFileOption(id, uri, thumbUri, filePath, onSelect) {
        return {
            id: id,
            uri: uri,
            thumbUri: thumbUri,
            filePath: filePath,
            onSelect: onSelect,
        };
    };


    /**
     * Promise-wrapper for doing an XHR
     */
    me.getXhrResponse = function getXhrResponse(method, uri, responseType) {
        var prop = (responseType === 'document') ? 'responseXML' : 'response';
        return me.sendXhr(method, uri, [prop], responseType);
    }

    /**
     * Promise-wrapper for doing an XHR
     */
    me.sendXhr = function sendXhr(method, uri, props, responseType) {
        return new Promise(function buildXhr(resolve, reject) {
            var errorHandler = function errorHandler(theStatus, theUri) {
                reject(theStatus);
            };

            var xhr = new XMLHttpRequest();

            xhr.onreadystatechange = function onXhrRSC() {
                if (this.readyState == XMLHttpRequest.DONE) 
                {
                    if (this.status == 200) {                        
                        if (props && props.length > 1) {
                            var propMap = {};
                            var thisXhr = this;

                            props.forEach(function addPropToResult(prop) {
                                propMap[prop] = thisXhr[prop];
                            });

                            resolve(propMap);                            
                        }
                        else if (props && props.length === 1) {
                            resolve(this[props[0]]);
                        }
                        else {
                             resolve(this);
                        }
                    }
                    else {
                        errorHandler(this.status, uri);
                    }
                }
            };
            
            xhr.onerror = function onXhrError() {
                errorHandler(this.status, uri);
            };

            xhr.open(method, uri, true);
            if (responseType) {
                xhr.responseType = responseType;
            }
            xhr.send();
        });
    }


    /**
     * Wrapper for chrome.tabs.query.
     */
    me.queryActiveTab = function queryActiveTab(opts) {
        if (!opts) {
            opts = {
                active: true,
                currentWindow: true,
            }
        }
        
        return new Promise(function doQueryTabs(resolve, reject) {
            chrome.tabs.query(
                opts,
                function(tabs) {
                    if (tabs && tabs.length > 0) {
                        resolve(tabs[0]);             
                    }
                    else {
                        reject('[Utils] no active tabs in the current window.');
                    }       
                }
            );
        });
    };


    /**
     * Wrapper for sending a message to a tab.
     */
    me.sendTabMessage = function sendTabMessage(tabMessage) {
        return new Promise(function messageSend(resolve, reject) {
            tabMessage.message.senderId = GIMME_ID;
            
            chrome.tabs.sendMessage(
                tabMessage.tab.id,
                tabMessage.message,
                {},
                function getMessageResponse(resp) {
                    if (resp) {
                        resolve(resp);                    
                    }
                    else {
                        reject(
                            '[Utils] Aborting, got an undefined response. May need to refresh the page.\n' +
                            '        lastError: ' + JSON.stringify(chrome.runtime.lastError)
                        ); 
                    }
                }
            );
        });
    };


    /**
     * Start the download. Wrapper around chrome.downloads.download.
     */
    me.download = function download(uri, destFilename) {
        return new Promise(function doDownload(resolve, reject) {
            chrome.downloads.download(
            {
                url: uri,
                filename: destFilename,
                conflictAction: 'uniquify',
                saveAs: false,
                method: 'GET'
            },
            function downloadCallback(downloadId) {
                if (downloadId) {
                    resolve(me.createDownloadSig(downloadId, uri, destFilename));
                }
                else {
                    reject('[Utils] No downloadId for uri ' + uri);
                }
            });
        });
    };


    /**
     * Get the newly created download items. Wrapper around chrome.downloads.search.
     */
    me.searchDownloads = function searchDownloads(downloadSig) {
        return new Promise(function doSearching(resolve, reject) {
            chrome.downloads.search(
                {
                    id: downloadSig.id,
                }, 
                function searchCallback(downloadItems) {
                    if (downloadItems && downloadItems.length > 0) {           
                        resolve(downloadItems);
                    }
                    else {
                        reject('[Utils] Error starting download: ' + chrome.runtime.lastError);
                    }
                }
            );
        });
    };


    // return the singleton
    return me;
})();