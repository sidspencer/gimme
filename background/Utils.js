import { default as GCon } from '../lib/GCon.js';
import {
    DownloadSig,
    ContentMessage,
    LastLoc,
} from '../lib/DataClasses.js';


/**
 * Utils service/singleton for GimUtils. It holds all the random bric-a-brac
 * methods that make our coding a little easier.
 */
class Utils {
    // Static vars used by Utils to store state.
    static dlChains = [];
    static dlCounter = 0;
    static dlCallbacks = {};
    static listeners = [];
    static counter = 0;
    static domParser = new DOMParser();
    static lastLoc = new LastLoc('localhost', '/gallery');

    /**
     * Check if a variable really exists.
     */
    static exists(obj) { 
        if (!!obj) {
            return true;
        }

        return false;
    };


    /**
     * Is it an empty object?
     */
    static isEmpty(obj) {
        for(var key in obj) {
            if(obj.hasOwnProperty(key))
                return false;
        }
        return true;
    };


    /**
     * Check the src/uri/href/filename for known audio extensions.
     */
    static isAllowedAudioType(name) {
        var allowedRx = GCon.RECOG_RGX.AUDIO;
        return allowedRx.test(name);
    };


    /**
     * Check the src/uri/href/filename for known video extensions.
     */
    static isAllowedVideoType(name) {
        var allowedRx = GCon.RECOG_RGX.VIDEO;
        return allowedRx.test(name);
    };


    /**
     * Check the src/uri/href/filename for known image extensions.
     */
    static isAllowedImageType(name) {
        var allowedRx = GCon.RECOG_RGX.IMAGE;
        return allowedRx.test(name);
    }


    /**
     * Construct a baseUri suitable for passing to the URL() constructor.
     * It either builds it off the passed-in location obj, or it uses the Digger's
     * cached "locator".
     */
    static getBaseUri(loc) {
        var baseUri = loc.href.substring(0, loc.href.lastIndexOf('/')+1);
        return baseUri;
    };


    /**
     * Create a URL object from a src/href.
     */
    static srcToUrl(src, loc) {
        if (!Utils.exists(src)) { 
            src = `${GCon.MIME_TYPE.DATA}:`; 
        }

        var cleansedUrl = new URL(src, Utils.getBaseUri(loc));

        // Use the URL object to fix all our woes.
        return cleansedUrl;
    };


    /**
     * Cleanse and scrub a src into a Uri string.
     */
    static srcToUri(src, l) {
        return u.srcToUrl(src, l).href;
    };
    

    /**
     * Do we think we know what type this file is? And do we want it?
     */
    static isKnownMediaType(name) {
        return (
            !!name && (Utils.isAllowedImageType(name) || Utils.isAllowedVideoType(name) || Utils.isAllowedAudioType(name))  
        );
    };


    /**
     * Kind of degenerate...
     */
    static isKnownMediaFile(name) {
        return Utils.isKnownMediaType(name);
    };


    /**
     * Is this a URI that an XHR can be completed against? Does it have a valid protocol?
     */
    static isFetchableUri(uri) {
        return (
           GCon.RECOG_RGX.PROTOCOL.test(uri)
        );
    };


    /**
     * Is this a URI filetype that we support?
     * 
     * @param {string} uri 
     */
    static isSupportedMediaUri(uri) {
        return (
            GCon.RECOG_RGX.SUPPORTED.test(uri)
        )
    }

    
    /**
     * Pull out the filename from a uri, or fallback to the whole thing.
     */
    static extractFilename(uri) {
        var lsi = uri.lastIndexOf('/');
        var filename = uri.substring((lsi === -1) ? 0 : (lsi + 1));

        return filename;
    }


    /**
     * Promise-wrapper for doing an XHR
     */
    static getXhrResponse(method, uri, responseType) {
        var prop = (responseType === GCon.MIME_TYPE.DOC || responseType === GCon.MIME_TYPE.BLOB) ? 'responseXML' : 'response';
        return Utils.sendXhr(method, uri, [prop], responseType);
    }

    
    /**
     * Promise-wrapper for doing an XHR
     */
    static sendXhr(method, uri, props, responseType) {
        return new Promise((resolve, reject) => {
            var errorHandler = (theStatus) => {
                reject(theStatus);
            };

            var xhr = new XMLHttpRequest();

            // Left as a old-school function def so "this" will point at the xhr and not
            // accidentally cause bad closures.
            xhr.onreadystatechange = function onXhrRSC() {
                if (this.readyState == XMLHttpRequest.DONE) 
                {
                    if (this.status == 200) {                        
                        if (props && props.length > 1) {
                            var propMap = {};
                            var thisXhr = this;

                            props.forEach((prop) => {
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
     * Get the active browser tab.
     */
    static queryActiveTab() {
        return Utils.queryTab({
            active: true,
            currentWindow: true,
        })
    }


    /**
     * Wrapper for chrome.tabs.query. Get a tab with the specified opts.
     */
    static queryTab(opts) {
        return new Promise((resolve, reject) => {
            chrome.tabs.query(
                opts,
                (tabs) => {
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
    static sendTabMessage(tabMessage) {
        return new Promise((resolve, reject) => {
            tabMessage.senderId = ContentMessage.GIMME_ID;
            tabMessage.message.senderId = ContentMessage.GIMME_ID;
            
            chrome.tabs.sendMessage(
                tabMessage.tab.id,
                tabMessage.message,
                {
                    frameId: (tabMessage.frameId || 0)
                },
                (resp) => {
                    if (!!resp) {
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
    static resetDownloader() {
        Utils.dlChains = [];
        Utils.dlCounter = 0;

        for (var prp in Utils.dlCallbacks) {
            delete Utils.dlCallbacks[prp];
        }
    
        for (var i1 = 0; i1 < GCon.UTILS_CONF.DL_CHAIN_COUNT; i1++) {
            Utils.dlChains.push(
                Promise.resolve(true).then(() => {
                    return new Promise((resolve, reject) => {
                        setTimeout(() => { 
                            resolve(true); 
                        }, 300);
                    });
                })
            );
        }
    }


    /**
     * Download a single uri to the filename (well, path) provided.
     * Add its downloading to one of the DL_CHAIN_COUNT download promise chains.
     */
    static downloadFile(uri, destFilename, output) {
        if (uri.lastIndexOf('/') === uri.length - 1) { 
            return Promise.resolve(new DownloadSig(0, uri, destFilename)); 
        };

        // If it's not an expected file type, slap jpg on the end.
        if (!(GCon.RECOG_RGX.SUPPORTED.test(destFilename))) {
            destFilename = destFilename + '.jpg';
        }

        var dlIndex = Utils.dlCounter % GCon.UTILS_CONF.DL_CHAIN_COUNT;
        Utils.dlCounter++;
        var num = Utils.dlCounter + 0;
        
        Utils.dlChains[dlIndex] = Utils.dlChains[dlIndex].then(() => {
            Utils.buildDlChain(uri, destFilename, output, num)
        });

        return Utils.dlChains[dlIndex];
    }


    /**
     * Helper to avoid unwanted closures.
     */
    static buildDlChain(uri, destFilename, output, num) {
        output.toOut('Downloading file ' + num);

        chrome.browserAction.setBadgeText({ text: '' + num + '' });
        chrome.browserAction.setBadgeBackgroundColor(GCon.B_COLOR.DOWNLOADING);

        return Utils.dlInChain(uri, destFilename);
    }


    /**
     * Build a salted directory name based on Utils.loc. 
     */
    static getSaltedDirectoryName(loc) {
        // Stash loc for later
        if (!loc || !loc.hostname) {
            loc = Utils.lastLoc;
        }
        else {
            Utils.lastLoc = new LastLoc(loc.hostname, loc.pathname);
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


    /**
     * Start the download. Wrapper around chrome.downloads.download.
     */
    static dlInChain(uri, destFilename) {
        return new Promise((resolve, reject) => {
            setTimeout(() => { 
                chrome.downloads.download(
                {
                    url: uri,
                    filename: destFilename,
                    conflictAction: 'uniquify',
                    saveAs: false,
                    method: GCon.ACTION.GET
                },
                (downloadId) => {
                    if (downloadId) {
                        Utils.dlCallbacks[downloadId] = Utils.buildDlCallback(downloadId, uri, destFilename, resolve);
                        chrome.downloads.onChanged.addListener(Utils.dlCallbacks[downloadId]);
                    }
                    else {
                        console.log('[Utils] no downloadId for uri ' + uri);
                        console.log('[Utils] download error was: ' + chrome.runtime.lastError);
                        resolve(new DownloadSig(0, uri, destFilename));
                    }
                });
            }, 300);
        });
    };


    /**
     * Helper to build the onChange callbacks, avoiding unwanted closures.
     */
    static buildDlCallback(dlId, dlUri, dlFile, res) {
        return ((dlDelta) => {
            if (dlDelta.id !== dlId) { return; }

            if (!!dlDelta.state && dlDelta.state.current !== 'in_progress') {
                chrome.downloads.onChanged.removeListener(Utils.dlCallbacks[dlId]);
                delete Utils.dlCallbacks[dlId];

                res(new DownloadSig(dlId, dlUri, dlFile));
                return;
            }
            else if (!!dlDelta.endTime && !!dlDelta.endTiUtils.current) {
                chrome.downloads.onChanged.removeListener(Utils.dlCallbacks[dlId]);
                delete Utils.dlCallbacks[dlId];

                res(new DownloadSig(dlId, dlUri, dlFile));
                return;
            }
            else if (!!dlDelta.exists && !!dlDelta.exists.current) {
                chrome.downloads.onChanged.removeListener(Utils.dlCallbacks[dlId]);
                delete Utils.dlCallbacks[dlId];

                res(new DownloadSig(dlId, dlUri, dlFile));
                return;
            }
        });
    }



    /**
     * Download as zip.
     */
    static downloadInZip(fileOpts) {
        var zip = new JSZip();
        var a = chrome.extension.getBackgroundPage().document.createElement('a');

        var promises = [];

        for (var i = 0; i < fileOpts.length-1; i++) {
            if (!fileOpts[i].uri.match(/preview/)) {
                promises.push(new Promise((resolve, reject) => {
                    console.log('[Utils] Adding file option to zip file for download: ' + JSON.stringify(fileOpts[i]));

                    return Utils.sendXhr(GCon.ACTION.GET, fileOpts[i].uri, ['response'], GCon.MIME_TYPE.BLOB)
                        .then((r) => {
                            zip.file(fileOpts[i].filePath, r);
                            console.log('[Utils] File added to zip successfully.');
                            resolve();
                        })
                        .catch((error) => {
                            console.log('[Utils] adding file o zip failed: ' + JSON.stringify(error));
                            resolve();
                        });
                }));
            }
        }

        return Promise.all(promises).then(() => {
            zip.generateAsync({
                type: GCon.MIME_TYPE.BLOB
            })
            .then((content) => {
                a.download = 'imgs' + fileOpts[0].uri.substring(9, fileOpts[0].uri.indexOf('/')) + '.zip';
                a.href = URL.createObjectURL(content);
                chrome.extension.getBackgroundPage().document.querySelector('body').appendChild(a);
                a.click();
                a.remove();
            })
            .catch((err) => {
                console.log('[Utils] failed to create zip file.')
            });
        });
    };


    /**
     * Get the newly created download items. Wrapper around chrome.downloads.search.
     */
    static searchDownloads(downloadSig) {
        return new Promise((resolve, reject) => {
            chrome.downloads.search(
                {
                    id: downloadSig.id,
                }, 
                (downloadItems) => {
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
    static setInStorage(items) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(items, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
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
    static getFromStorage(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(keys, (items) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
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
    static addMediaHeadersListener(listener, windowId, tabId) {
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
    static removeMediaHeadersListener(listener) {
        chrome.webRequest.onHeadersReceived.removeListener(listener);
    };


    /**
     * Promise-based loader of an external resource into a <iframe>
     * in the background page. Returns the iframe's document object.
     */
    static loadUriDoc(uri, id) {
        return new Promise((resolve, reject) => {
            id = (!id && id !== 0) ? GCon.UTILS_CONF.DEFAULT_IFRAME_ID : id;

            // Create the iframe, removing the old one if needed.
            var bgDoc = chrome.extension.getBackgroundPage().document;
            var listenerId = id + (Utils.counter++);            
            var iframe = bgDoc.getElementById(id);
            if (iframe) { iframe.remove(); };

            iframe = bgDoc.createElement('iframe');
            iframe.id = id;   
            
            // Set a timeout for waiting for the iframe to load. We can't afford to 
            // just never complete the promise. Wait 7 seconds.
            var listeningTimeoutId = setTimeout(() => {
                chrome.runtime.onMessage.removeListener(Utils.listeners[listenerId]);
                iframe.remove();
                delete Utils.listeners[listenerId];

                reject(GCon.UTILS_CONF.LISTENER_TIMED_OUT);
            }, 7000);

            // Add a message listener for the ContentPeeper's loading message.
            // It will fire for every page or frame loaded, as it is always injected.
            // But restrict this particular listener to only the uri at hand.
            Utils.listeners[listenerId] = (request, sender, sendResponse) => {                
                if (request.docOuterHtml && request.uri == uri) {
                    clearTimeout(listeningTimeoutId);
                    chrome.runtime.onMessage.removeListener(Utils.listeners[listenerId]);

                    var iframeDoc = Utils.domParser.parseFromString(request.docOuterHtml, GCon.MIME_TYPE.HTML);
                    resolve(iframeDoc);
                    
                    iframe.remove();
                    delete Utils.listeners[listenerId];
                }

                // Wait a while.
                return true;
            }; 
            chrome.runtime.onMessage.addListener(Utils.listeners[listenerId]);
                 
            // Set the src (it begins loading here)
            iframe.src = uri;
            bgDoc.body.appendChild(iframe);
        });
    };


    /**
     * Stringify JSON so it's pretty.
     */
    static toPrettyJson(obj) {
        return JSON.stringify(obj).replace(/\{/g, '{\n\t').replace(/\}/g, '\n}').replace(/\,/g,',\n\t');
    };
}
Utils.resetDownloader();

window[GCon.WIN_PROP.UTILS_ST] = Utils;

export default Utils;