import { isFunction } from '@tensorflow/tfjs-core/dist/util';
import { default as C } from '../lib/C.js';
import { default as CommonStaticBase } from '../lib/CommonStaticBase.js';
import {
    DownloadSig,
    ContentMessage,
    Log,
    LastLoc,
} from '../lib/DataClasses.js';


/**
 * Utils static class for Gimme. It holds all the random bric-a-brac
 * methods that make our coding a little easier.
 */
class Utils extends CommonStaticBase {
    // Static vars used by Utils to store state.
    static dlChains = [];
    static dlCounter = 0;
    static dlCallbacks = {};
    static listeners = [];
    static counter = 0;
    static domParser = new DOMParser();
    static lastLoc = new LastLoc(C.BLANK.LOCALHOST, C.BLANK.GALLERY);


    /**
     * Do setup tasks, like calling super.setup() for STOP listening and
     * log setup.
     */
    static setup() {
        if (!Utils.exists(Utils.log)) {
            super.setup(C.LOG_SRC.UTILS);
        }
    }
    

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
        var allowedRx = C.RECOG_RGX.AUDIO;
        return allowedRx.test(name);
    };


    /**
     * Check the src/uri/href/filename for known video extensions.
     */
    static isAllowedVideoType(name) {
        var allowedRx = C.RECOG_RGX.VIDEO;
        return allowedRx.test(name);
    };


    /**
     * Check the src/uri/href/filename for known image extensions.
     */
    static isAllowedImageType(name) {
        var allowedRx = C.RECOG_RGX.IMAGE;
        return allowedRx.test(name);
    }


    /**
     * Construct a baseUri suitable for passing to the URL() constructor.
     * It either builds it off the passed-in location obj, or it uses the Digger's
     * cached "locator".
     */
    static getBaseUri(loc) {
        var baseUri = loc.href.substring(0, loc.href.lastIndexOf(C.ST.WHACK)+1);
        return baseUri;
    };


    /**
     * Create a URL object from a src/href.
     */
    static srcToUrl(src, loc) {
        if (!Utils.exists(src)) { 
            src = `${C.DOC_TYPE.DATA}:`; 
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
     * Does it have a file extension? If not, it's probably a generated image. That
     * is the usefulness of this method.
     * 
     * @param {string} name 
     */
    static hasNoFileExtension(name) {
        if (!!name) {
            let slashedParts = name.split('?')[0].split('/');
            let sl = slashedParts[slashedParts.length - 1];
            
            // Test for a file extension, negated.
            return (
                !/\.(.+?)$/.test(sl)
            );
        }
    }


    /**
     * This matches all the media mimetypes we support. 
     * 
     * @param {string} mimeType 
     */
    static isKnownMediaMimeType(mimeType) {
        return (
            !!mimeType && C.MIMETYPE_RGX.ALLMEDIA.test(mimeType)
        );
    }


    /**
     * Do we think we know what type this file is? And do we want it?
     */
    static isKnownMediaFile(name) {
        return (
            !!name && (Utils.isAllowedImageType(name) || Utils.isAllowedVideoType(name) || Utils.isAllowedAudioType(name))  
        );
    };


    /**
     * Do we think we know what type this file is? Is it extension-less, and therefore maybe a 
     * media-generating endpoint?
     */
    static isKnownMediaFileOrEndpoint(name) {
        return (
            Utils.hasNoFileExtension(name) || Utils.isKnownMediaFile(name)  
        );
    };


    /**
     * Is this a URI that an XHR can be completed against? Does it have a valid protocol?
     */
    static isFetchableUri(uri) {
        return (
           C.RECOG_RGX.PROTOCOL.test(uri)
        );
    };


    /**
     * Does the filename have a dot in it?
     * 
     * @param {string} filename 
     */
    static doesFilenameHaveDot(filename) {
        return (
            filename.indexOf(C.ST.DOT) !== -1
        );
    }


    /**
     * What's the index of the dot in the filename?
     * 
     * @param {string} filename 
     */
    static indexOfDot(filename) {
        return (
            filename.indexOf(C.ST.DOT)
        );
    }

    /**
     * Is this a URI filetype that we support?
     * 
     * @param {string} uri 
     */
    static isSupportedMediaUri(uri) {
        return (
            C.RECOG_RGX.SUPPORTED.test(uri)
        )
    }

    
    /**
     * Pull out the filename from a uri, or fallback to the whole thing.
     */
    static extractFilename(uri) {
        var lsi = uri.lastIndexOf(C.ST.WHACK);
        var filename = uri.substring((lsi === -1) ? 0 : (lsi + 1));

        return filename;
    }


    /**
     * Promise-wrapper for doing an XHR
     */
    static getXhrResponse(method, uri, responseType) {
        var prop = (
            (responseType === C.DOC_TYPE.DOC || responseType === C.DOC_TYPE.BLOB) ? 
            C.SEL_PROP.R_XML : 
            C.SEL_PROP.R
        );

        return Utils.sendXhr(method, uri, [prop], responseType);
    }

    
    /**
     * Promise-wrapper for doing an XHR
     */
    static sendXhr(method, uri, props, responseType) {
        return new Promise((resolve, reject) => {
            // Get an unused key for this xhr. The do-while will usually only run one iteration.
            var xhr = new XMLHttpRequest();

            // Error handler function.
            var errorHandler = (theStatus) => {
                reject(theStatus);
            };


            // Nullify and delete the xhr.
            var deleteXhr = () => {
                xhr = null;
            };


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

                    xhr = null;
                }
            };
            

            // Again, using the old-school "function" so that "this"
            // points o the XHR.
            xhr.onerror = function onXhrError() {
                errorHandler(this.status, uri);
                xhr = null;
            };


            // When STOP event is dispatched, abort gets called.
            xhr.onabort = function onXhrAbort() {
                Utils.log.log(`Got STOP event, aborting XHR for ${uri}`);
                xhr = null;
            };


            // Perform the fetch.
            xhr.open(method, uri, true);
            if (responseType) {
                xhr.responseType = responseType;
            }
            xhr.send();


            // Event Listener for STOP to cancel the in-flight xhr.
            window.document.addEventListener(C.ACTION.STOP, function abortXhrOnStop() {
                if (!!xhr) { 
                    xhr.abort(); 
                    reject(C.ACTION.STOP);
                }
            });
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
    
        for (var i1 = 0; i1 < C.UTILS_CONF.DL_CHAIN_COUNT; i1++) {
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
        if (uri.lastIndexOf(C.ST.WHACK) === uri.length - 1) { 
            return Promise.resolve(new DownloadSig(0, uri, destFilename)); 
        }

        if (!destFilename) {
            destFilename = C.F_NAMING.DEFAULT_FN;
        }

        // If it's not an expected file type, slap jpg on the end.
        if (!(C.RECOG_RGX.SUPPORTED.test(destFilename))) {
            destFilename = destFilename + '.jpg';
        }

        var dlIndex = Utils.dlCounter % C.UTILS_CONF.DL_CHAIN_COUNT;
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


        chrome.browserAction.setBadgeText({ text: C.ST.E + num + C.ST.E });
        chrome.browserAction.setBadgeBackgroundColor(C.COLOR.DOWNLOADING);

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
        var hackedPageName = C.ST.E;
        var slashIndex = loc.pathname.lastIndexOf(C.ST.WHACK);
        var dotIndex = loc.pathname.lastIndexOf(C.ST.DOT);

        if (slashIndex != -1 && dotIndex != -1) {
            hackedPageName = loc.pathname.substring(
                loc.pathname.lastIndexOf(C.ST.WHACK)+1, 
                loc.pathname.lastIndexOf(C.ST.DOT)-1
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
                    method: C.ACTION.GET
                },
                (downloadId) => {
                    if (downloadId) {
                        Utils.dlCallbacks[downloadId] = Utils.buildDlCallback(downloadId, uri, destFilename, resolve);
                        chrome.downloads.onChanged.addListener(Utils.dlCallbacks[downloadId]);
                    }
                    else {
                        Utils.log.log('no downloadId for uri ' + uri);
                        Utils.log.log('download error was: ' + chrome.runtime.lastError);
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
                    Utils.log.log('Adding file option to zip file for download: ' + JSON.stringify(fileOpts[i]));

                    return Utils.sendXhr(C.ACTION.GET, fileOpts[i].uri, ['response'], C.DOC_TYPE.BLOB)
                        .then((r) => {
                            zip.file(fileOpts[i].filePath, r);
                            Utils.log.log('File added to zip successfully.');
                            resolve();
                        })
                        .catch((error) => {
                            Utils.log.log('adding file o zip failed: ' + JSON.stringify(error));
                            resolve();
                        });
                }));
            }
        }

        return Promise.all(promises).then(() => {
            zip.generateAsync({
                type: C.DOC_TYPE.BLOB
            })
            .then((content) => {
                a.download = 'imgs' + fileOpts[0].uri.substring(9, fileOpts[0].uri.indexOf(C.ST.WHACK)) + '.zip';
                a.href = URL.createObjectURL(content);
                chrome.extension.getBackgroundPage().document.querySelector('body').appendChild(a);
                a.click();
                a.remove();
            })
            .catch((err) => {
                Utils.log.log('failed to create zip file.')
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
                        Utils.log.log('Error starting download: ' + chrome.runtime.lastError);
                        resolve(downloadItems);
                    }
                }
            );
        });
    };


    /**
     * A promise-based wrapper for setting storage items.
     * The cb's return value is ignored completely.
     */
    static setInStorage(itemsToStore) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(
                itemsToStore, 
                () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    }
                    else {
                        resolve(true);
                    }
                }
            );
        });
    };


    /**
     * A promise-based wrapper for getting storage items. 
     */
    static getFromStorage(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(
                keys, 
                (items) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    }
                    else {
                        resolve(items);
                    }
                }
            );
        });
    };


    /**
     * See if the param is actually the boolean value "true". Not something coerced.
     * 
     * @param {any} test 
     */
    static isTrue(test) {
        return (test === true);
    }


    /**
     * See if the param is actually the string value of C.ACTION.STOP ("STOP").
     * 
     * @param {any} test 
     */
    static isSTOP(test) {
        return (test === C.ACTION.STOP);
    }


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
            id = (!id && id !== 0) ? C.UTILS_CONF.DEFAULT_IFRAME : id;

            // Create the iframe, removing the old one if needed.
            var bgDoc = chrome.extension.getBackgroundPage().document;
            var listenerId = id + (Utils.counter++);            
            var iframe = bgDoc.getElementById(id);
            if (iframe) { iframe.remove(); };

            iframe = bgDoc.createElement(C.SEL_PROP.IFRAME);
            iframe.id = id;   
            

            // Set a timeout for waiting for the iframe to load. We can't afford to 
            // just never complete the promise. Wait 7 seconds.
            var listeningTimeoutId = setTimeout(() => {
                chrome.runtime.onMessage.removeListener(Utils.listeners[listenerId]);
                iframe.remove();
                delete Utils.listeners[listenerId];

                reject(C.UTILS_CONF.LISTENER_TIMED_OUT);
            }, 7000);


            // Add a message listener for the ContentPeeper's loading message.
            // It will fire for every page or frame loaded, as it is always injected.
            // But restrict this particular listener to only the uri at hand.
            Utils.listeners[listenerId] = (request, sender, sendResponse) => {                
                if (request.docOuterHtml && request.uri == uri) {
                    clearTimeout(listeningTimeoutId);
                    chrome.runtime.onMessage.removeListener(Utils.listeners[listenerId]);

                    var iframeDoc = Utils.domParser.parseFromString(request.docOuterHtml, C.DOC_TYPE.HTML);
                    resolve(iframeDoc);
                    
                    iframe.remove();
                    delete Utils.listeners[listenerId];
                }

                // Wait a while.
                return true;
            }; 
            chrome.runtime.onMessage.addListener(Utils.listeners[listenerId]);


            // Listen for STOP events.
            window.document.addEventListener(C.ACTION.STOP, (evt) => {
                Utils.log.log(`${C.ST.STOP_BANG} Stopping load for iframe with id "${iframe.id}", and it will be removed.`);
                clearTimeout(listeningTimeoutId);
                chrome.runtime.onMessage.removeListener(Utils.listeners[listenerId]);
                delete Utils.listeners[listenerId];

                if (Utils.exists(iframe)) {
                    if (Utils.exists(iframe.contentWindow) && isFunction(iframe.contentWindow.stop)) { 
                        iframe.contentWindow.stop();
                        iframe.src = C.ST.HASH; 
                    };
                    iframe.remove();
                }
            });
            
            
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


    /**
     * Are we on a page that contains all these page tokens?
     * @param {Array<string>|string} pageTokens 
     */
    static isPage(win, pageTokens) {
        var itIs = false;

        // If we were passed in a non-empty string or array, use it for 
        // matching. Otherwise, leave itIs = false.
        if (!!pageTokens && !!pageTokens.length && pageTokens.length > 0) {
            var tokens = [];

            // The tokens array either gets set to the pageTokens input if
            // it's an array, or if pageTokens is a string it's added as the
            // sole element of a new array.
            if (Array.isArray(pageTokens)) {
                tokens = pageTokens;
            }
            else {
                tokens.push(pageTokens);
            }

            // Do a logical "and" on all of the tokens to determine if we're
            // on that page or not.
            itIs = true;
            tokens.forEach((tok) => {
                if (win.location.href.indexOf(tok) != -1) {
                    itIs = itIs && true;
                }
                else {
                    itIs = false;
                }
            });
        }
       
        // Always false if the pageTokens input is not a non-zero string or array<string>.
        return itIs;
    }

    
    /**
     * Are we on the background page?
     */
    static isBackgroundPage(win) {
        let h = win.location.href;
        let isPage = (
            (h.indexOf(C.WAY.CH) === 0) && 
            (h.indexOf(C.PAGE.BACKGROUND) !== -1)
        );

        return isPage;
        //return Utils.isPage(win, [C.WAY.CH_WW, C.ST.WHACK + C.PAGE.BACKGROUND]);
    }

    
    /**
     * Are we on the popup page?
     */
    static isPopupPage(win) {
        let h = win.location.href;
        let isPage = (
            (h.indexOf(C.WAY.CH) === 0) && 
            (h.indexOf(C.PAGE.POPUP) !== -1)
        );

        return isPage;
        //return Utils.isPage(win, [C.WAY.CH_WW, C.ST.WHACK + C.PAGE.POPUP]);
    }


    /**
     * Are we on the options page?
     */
    static isOptionsPage(win) {
        let h = win.location.href;
        let isPage = (
            (h.indexOf(C.WAY.CH) === 0) && 
            (h.indexOf(C.PAGE.OPTIONS) !== -1)
        );

        return isPage;
        //return Utils.isPage(win, [C.WAY.CH_CWW, C.ST.WHACK + C.PAGE.OPTIONS]);
    }
}

// do setup.
Utils.setup();

// Set our static instance on the background window object, and reset the downloader if
// This is the first run through this file and we're on the background page.
if (!window.hasOwnProperty(C.WIN_PROP.UTILS_CLASS) && Utils.isBackgroundPage(window)) {
    window[C.WIN_PROP.UTILS_CLASS] = Utils;
    Utils.resetDownloader();
}

// Export.
export default Utils;