'use strict'

/**
 * Utils service/singleton for Gimme. It holds all the random bric-a-brac
 * functions that make our lives easier.
 */
var Utils = (function Utils() {
    var me = {
        dlChains: [],
        dlCounter: 0,
        dlCallbacks: {},
    };

    // Public Constants
    me.LISTENER_TIMED_OUT = 'Listener timed out';
    me.GIMME_ID = 'gimme'; 
    me.DL_CHAIN_COUNT = 10;


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
    me.isAllowedAudioType = function isAllowedAudioType(name) {
        var allowedRx = /(mp3|m4a|aac|wav|ogg|aiff|aif|flac)/i;
        return allowedRx.test(name);
    };


    /**
     * Check the src/uri/href/filename for known video extensions.
     */
    me.isAllowedVideoType = function isAllowedVideoType(name) {
        var allowedRx = /(mp4|flv|f4v|m4v|mpg|mpeg|wmv|mov|avi|divx|webm)/i;
        return allowedRx.test(name);
    };


    /**
     * Check the src/uri/href/filename for known image extensions.
     */
    me.isAllowedImageType = function isAllowedImageType(name) {
        var allowedRx = /(jpg|jpeg|gif|png|tiff|tif|pdf)/i;
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
    me.isKnownMediaType = function isKnownMediaType(name) {
        return (
            !me.isBannedUri(name) &&
            (me.isAllowedImageType(name) || me.isAllowedVideoType(name) || me.isAllowedAudioType(name))  
        );
    };


    /**
     * Kind of degenerate...
     */
    me.isKnownMediaFile = function isKnownMediaFile(name) {
        return me.isKnownMediaType(name);
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
            message: message,
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
        var prop = (responseType === 'document' || responseType === 'blob') ? 'responseXML' : 'response';
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
     * 
     */
    me.queryActiveTab = function queryActiveTab() {
        return me.queryTab({
            active: true,
            currentWindow: true,
        })
    }


    /**
     * Wrapper for chrome.tabs.query.
     */
    me.queryTab = function queryTab(opts) {
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
            tabMessage.message.senderId = me.GIMME_ID;
            
            chrome.tabs.sendMessage(
                tabMessage.tab.id,
                tabMessage.message,
                {
                    frameId: (tabMessage.frameId || 0)
                },
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
                    
                    return true;
                }
            );
        });
    };


    /**
     * Reset the download helper objects to their initial state.
     */
    me.resetDownloader = function resetDownloader() {
        me.DL_CHAIN_COUNT = 10;
        me.dlChains = [];
        me.dlCounter = 0;

        for (var prp in me.dlCallbacks) {
            delete me.dlCallbacks[prp];
        }
    
        for (var i1 = 0; i1 < me.DL_CHAIN_COUNT; i1++) {
            me.dlChains.push(
                Promise.resolve(true).then(function() {
                    return new Promise(function(resolve, reject) {
                        setTimeout(function() { 
                            resolve(true); 
                        }, 300);
                    });
                })
            );
        }
    }
    me.resetDownloader();


    /**
     * Download a single uri to the filename (well, path) provided.
     * Add its downloading to one of the DL_CHAIN_COUNT download promise chains.
     */
    me.downloadFile = function downloadFile(uri, destFilename, output) {
        if (uri.lastIndexOf('/') === uri.length - 1) { return; };

        // If it's a PHP file, guess and give it a .jpg.
        if (!/\.(jpg|jpeg|png|gif|tiff|mpg|mp4|flv)$/i.test(destFilename)) {
            destFilename = destFilename + '.jpg';
        }

        var dlIndex = me.dlCounter % me.DL_CHAIN_COUNT;
        me.dlCounter++;
        var num = me.dlCounter + 0;
        
        me.dlChains[dlIndex] = me.dlChains[dlIndex].then(
            buildDlChain(uri, destFilename, output, num)
        );

        return me.dlChains[dlIndex];
    }


    /**
     * Helper to avoid unwanted closures.
     */
    function buildDlChain(uri, destFilename, output, num) {
        return (
            function() {
                output.toOut('Downloading file ' + num);

                chrome.browserAction.setBadgeText({ text: '' + num + '' });
                chrome.browserAction.setBadgeBackgroundColor({ color: '#009900' });

                return me.dlInChain(uri, destFilename);
            }
        );
    }


    /**
     * Build a salted directory name based on me.loc. 
     */
    me.getSaltedDirectoryName = function getSaltedDirectoryName(loc) {
        // Stash loc for later
        if (!loc || !loc.hostname) {
            loc = me.LAST_LOC;
        }
        else {
            me.LAST_LOC = { 
                hostname: loc.hostname, 
                pathname: loc.pathname 
            };
        }

        // Create a salted directory for the images to live in.
        var hackedPageName = '';
        var slashIndex = loc.pathname.lastIndexOf('/');
        var dotIndex = loc.pathname.lastIndexOf('.');

        if (slashIndex != -1 && dotIndex != -1) {
            hackedPageName = loc.pathname.substring(
                loc.pathname.lastIndexOf('/')+1, 
                loc.pathname.lastIndexOf('.')-1
            );
        }
        else {
            hackedPageName = "gallery";
        }

        return ('Gimme-' + loc.hostname + '__' + hackedPageName + '__' + (new Date()).getTime());
    }
    me.LAST_LOC = { hostname: 'localhost', pathname: '/gallery' };    


    /**
     * Start the download. Wrapper around chrome.downloads.download.
     */
    me.dlInChain = function dlInChain(uri, destFilename) {
        return new Promise(function(resolve, reject) {
            setTimeout(function() { 
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
                        me.dlCallbacks[downloadId] = buildDlCallback(downloadId, uri, destFilename, resolve);
                        chrome.downloads.onChanged.addListener(me.dlCallbacks[downloadId]);
                    }
                    else {
                        console.log('[Utils] no downloadId for uri ' + uri);
                        console.log('[Utils] download error was: ' + chrome.runtime.lastError);
                        resolve(me.createDownloadSig(0, uri, destFilename));
                    }
                });
            }, 300);
        });
    };


    /**
     * Helper to build the onChange callbacks, avoiding unwanted closures.
     */
    function buildDlCallback(dlId, dlUri, dlFile, res) {
        return (function(dlDelta) {
            if (dlDelta.id !== dlId) { return; }

            if (!!dlDelta.state && dlDelta.state.current !== 'in_progress') {
                chrome.downloads.onChanged.removeListener(me.dlCallbacks[dlId]);
                delete me.dlCallbacks[dlId];

                res(me.createDownloadSig(dlId, dlUri, dlFile));
                return;
            }
            else if (!!dlDelta.endTime && !!dlDelta.endTime.current) {
                chrome.downloads.onChanged.removeListener(me.dlCallbacks[dlId]);
                delete me.dlCallbacks[dlId];

                res(me.createDownloadSig(dlId, dlUri, dlFile));
                return;
            }
            else if (!!dlDelta.exists && !!dlDelta.exists.current) {
                chrome.downloads.onChanged.removeListener(me.dlCallbacks[dlId]);
                delete me.dlCallbacks[dlId];

                res(me.createDownloadSig(dlId, dlUri, dlFile));
                return;
            }
        });
    }



    /**
     * Download as zip.
     */
    me.downloadInZip = function downloadInZip(fileOpts) {
        var zip = new JSZip();
        var a = chrome.extension.getBackgroundPage().document.createElement('a');

        var promises = [];

        for (var i = 0; i < fileOpts.length-1; i++) {
            if (!fileOpts[i].uri.match(/preview/)) {
                promises.push(new Promise(function doDownloadInZip(resolve, reject) {
                    console.log('DOWNLOAD IN ZIP: ' + JSON.stringify(fileOpts[i]));

                    return me.sendXhr('GET', fileOpts[i].uri, ['response'], 'blob')
                        .then(function addToZip(r) {
                            console.log('ZIP.FILING');

                            zip.file(fileOpts[i].filePath, r);
                            console.log('ZIP.FILED');
                            resolve();
                        })
                        .catch(function(error) {
                            console.log('ZIP FAILED ' + error);
                            resolve();
                        });
                }));
            }
        }

        return Promise.all(promises).then(function() {
            zip.generateAsync({
                type: 'blob'
            })
            .then(function(content) {
                a.download = 'imgs' + fileOpts[0].uri.substring(9, fileOpts[0].uri.indexOf('/')) + '.zip';
                a.href = URL.createObjectURL(content);
                chrome.extension.getBackgroundPage().document.querySelector('body').appendChild(a);
                a.click();
                a.remove();
            })
            .catch(function() {
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
                        console.log('[Utils] Error starting download: ' + chrome.runtime.lastError);
                        resolve(downloadItems);
                    }
                }
            );
        });
    };


    /**
     * A promise-based wrapper for setting storage items.
     */
    me.setInStorage = function setInStorage(items) {
        return new Promise(function doSetInStorage(resolve, reject) {
            chrome.storage.local.set(items, function setInStorageCallback() {
                if (runtime.lastError) {
                    reject(runtime.lastError);
                }
                else {
                    resolve(true);
                }
            });
        });
    };


    /**
     * A promise-based wrapper for getting storage items. 
     */
    me.getFromStorage = function getFromStorage(keys) {
        return new Promise(function doGetFromStorage(resolve, reject) {
            chrome.storage.local.get(keys, function getFromStorageCallback(items) {
                if (runtime.lastError) {
                    reject(runtime.lastError);
                }
                else {
                    resolve(items);
                }
            });
        });
    };


    /**
     * Add listener for all media requests.
     */
    me.addMediaHeadersListener = function addMediaHeadersListener(listener, windowId, tabId) {
        var filter = {
            urls: [ 'http://*/*', 'https://*/*' ],
            types: [ 'image', 'media', 'xmlhttprequest' ]
        };
        if (windowId) { filter.windowId = windowId; };
        if (tabId) { filter.tabId = tabId; };

        chrome.webRequest.onHeadersReceived.addListener(
            listener, 
            filter,
            [ 'responseHeaders' ]
        );
    };


    /**
     * Remove listener for media requests (only for parity).
     */
    me.removeMediaHeadersListener = function removeMediaHeadersListener(listener) {
        chrome.webRequest.onHeadersReceived.removeListener(listener);
    };


    /**
     * Promise-based loader of an external resource into a <iframe>
     * in the background page. Returns the iframe's document object.
     */
    var DEFAULT_IFRAME_ID = 'background_iframe';
    var listeners = [];
    var counter = 0;
    me.loadUriDoc = function loadUriDoc(uri, id) {
        return new Promise(function doLoadUri(resolve, reject) {
            id = (!id && id !== 0) ? DEFAULT_IFRAME_ID : id;

            // Create the iframe, removing the old one if needed.
            var bgDoc = chrome.extension.getBackgroundPage().document;
            var listenerId = id + (counter++);            
            var iframe = bgDoc.getElementById(id);
            if (iframe) { iframe.remove(); };

            iframe = bgDoc.createElement('iframe');
            iframe.id = id;   
            
            // Set a timeout for waiting for the iframe to load. We can't afford to 
            // just never complete the promise. Wait 7 seconds.
            var listeningTimeoutId = setTimeout(function listenerTimeout() {
                chrome.runtime.onMessage.removeListener(listeners[listenerId]);
                iframe.remove();
                delete listeners[listenerId];

                reject(me.LISTENER_TIMED_OUT);
            }, 7000);

            // Add a message listener for the ContentPeeper's loading message.
            // It will fire for every page or frame loaded, as it is always injected.
            // But restrict this particular listener to only the uri at hand.
            listeners[listenerId] = function(request, sender, sendResponse) {                
                if (request.docInnerHtml && request.uri == uri) {
                    clearTimeout(listeningTimeoutId);
                    chrome.runtime.onMessage.removeListener(listeners[listenerId]);

                    var iframeDoc = bgDoc.implementation.createHTMLDocument(uri);
                    iframeDoc.documentElement.innerHTML = request.docInnerHtml;
                    resolve(iframeDoc);
                    
                    iframe.remove();
                    delete listeners[listenerId];
                }

                // Wait a while.
                return true;
            }; 
            chrome.runtime.onMessage.addListener(listeners[listenerId]);
                 
            // Set the src (it begins loading here)
            iframe.src = uri;
            bgDoc.body.appendChild(iframe);
        });
    };


    /**
     * Stringify JSON so it's pretty.
     */
    me.toPrettyJson = function toPrettyJson(obj) {
        return JSON.stringify(obj).replace(/\{/g, '{\n\t').replace(/\}/g, '\n}').replace(/\,/g,',\n\t');
    };



    // return the singleton
    return me;
})();