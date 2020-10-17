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
    static xhrsInFlight = {};
    static xhrIdSeed = 0;
    static counter = 0;
    static concurrentDls = 10;
    static domParser = new DOMParser();
    static lastLoc = new LastLoc(C.BLANK.LOCALHOST, C.BLANK.GALLERY);


    /**
     * Do setup tasks, like calling super.setup() for STOP listening and
     * log setup, and set the initial value for concurrentDls.
     */
    static setup() {
        if (!Utils.exists(Utils.log)) {
            super.setup(C.LOG_SRC.UTILS);
        }

        this.setConcurrentDownloadCount(C.UTILS_CONF.CONCURRENT_DOWNLOADS);
    }
    

    /**
     * Check if a variable really exists. It must not be null, undefined, or ''.
     */
    static exists(obj) { 
        if (
            !!obj && 
            obj !== null && 
            typeof(obj) !== 'undefined' &&
            (obj.trim ? obj.trim() !== C.ST.E : obj !== C.ST.E)
        ) {
            return true;
        }
        else {
            return false;
        }
    };


    /**
     * Is it an empty object?
     */
    static isEmpty(obj) {
        for(var key in obj) {
            if(obj.hasOwnProperty(key)) {
                return false;
            }
        }
        return true;
    };


    /**
     * If the val is a proper object, it may have a toString(). If it's a
     * little degenerate, it might not, so we interpolate in that case.
     *
     * @param {Object} val 
     */
    static asString(val) {
        return (
            (Utils.exists(val) && Utils.exists(val.toString)) ?
            val.toString() :
            `${val}`
        );
    }


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
            filename.indexOf(C.ST.D) !== -1
        );
    }


    /**
     * What's the index of the dot in the filename?
     * 
     * @param {string} filename 
     */
    static indexOfDot(filename) {
        return (
            filename.indexOf(C.ST.D)
        );
    }

    /**
     * Is this a URI filetype that we support?
     * 
     * @param {string} uri 
     */
    static isSupportedMediaUri(uri) {
        return (
            C.MIMETYPE_RGX.ALLSUPPORTED.test(uri)
        );
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
            if (this.stop) { return C.CAN_FN.PR_RJ_STOP(); };

            // Get an unused key for this xhr. The do-while will usually only run one iteration.
            // Then create the object, setting it on the in-flight map and in the xhr local var.
            var xhrId = '0';
            do {
                xhrId = `${(Utils.xhrIdSeed++)}`;
            } while (Utils.xhrsInFlight.hasOwnProperty(xhrId));

            // Create the XHR in the tracking map and get a var handle to it.
            var xhr = Utils.xhrsInFlight[xhrId] = new XMLHttpRequest();


            // Error handler function. Logs the error status,
            // then deletes the xhr from the array and sets the var reference
            // to nul, then rejects with theStatus.
            var errorHandler = (errorStatus) => {
                // Log the error.
                Utils.lm(`XHR Error in sendXhr():\n    ${JSON.stringify(errorStatus)}`);

                // delete the xhr as best we can.
                delete Utils.xhrsInFlight[xhrId];
                xhr = null;

                // reject with the error status we were called with.
                reject(errorStatus);
            };
            

            // Left as a old-school function def so "this" will point at the xhr and not
            // accidentally cause bad closures.
            xhr.onreadystatechange = function onXhrRSC() {
                if (Utils.isSTOP()) {
                    errorHandler(this.status);
                    return;
                }

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
                        errorHandler(this.status);
                    }

                    // delete the xhr as best we can.
                    delete Utils.xhrsInFlight[xhrId];
                    xhr = null;
                }
            };
            

            // Again, using the old-school "function" so that "this"
            // points o the XHR.
            xhr.onerror = function onXhrError() {
                errorHandler(this.status);
            };


            // When STOP event is dispatched, abort gets called.
            xhr.onabort = function onXhrAbort() {
                Utils.lm(`aborted XHR for uri: ${uri}.`);
                errorHandler(C.ACTION.STOP);
            };


            // Event listener for stop event.
            var stopHandler = (evt) => {
                window.document.removeEventListener(C.ACTION.STOP, stopHandler, false);

                if (Utils.exists(Utils.xhrsInFlight[xhrId])) { 
                    Utils.xhrsInFlight[xhrId].abort(); 
                }                
            };
            window.document.addEventListener(C.ACTION.STOP, stopHandler, false);

            
            // Perform the fetch.
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
    
        for (var i1 = 0; i1 < this.concurrentDls; i1++) {
            Utils.dlChains.push(Promise.resolve(true));
        }
    }


    /**
     * Download a single uri to the filename (well, path) provided.
     * Add its downloading to one of the this.concurrentDls download promise chains.
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

        // We're round-robin-ing our dlChains. 
        var dlIndex = Utils.dlCounter % Utils.concurrentDls;
        Utils.dlCounter++;
        var num = Utils.dlCounter + 0;
        
        // Make sure The chain has been started.
        if (!Utils.exists(Utils.dlChains[dlIndex]) || !Utils.exists(Utils.dlChains[dlIndex].then)) {
            Utils.dlChains[dlIndex] = Promise.resolve(true);
        }

        // Download in the chain
        Utils.dlChains[dlIndex] = Utils.dlChains[dlIndex].then(() => {
            return Utils.buildDlChain(uri, destFilename, output, num);
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
        var dotIndex = loc.pathname.lastIndexOf(C.ST.D);

        if (slashIndex != -1 && dotIndex != -1) {
            hackedPageName = loc.pathname.substring(
                loc.pathname.lastIndexOf(C.ST.WHACK)+1, 
                loc.pathname.lastIndexOf(C.ST.D)-1
            );
        }
        else {
            hackedPageName = "gallery";
        }

        return (`Gimme-${loc.hostname}-${hackedPageName}-${(new Date()).getTime()}`);
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
                            // It queued up, so we wait to resolve until the file is done downloading.
                            Utils.dlCallbacks[downloadId] = Utils.buildDlCallback(downloadId, uri, destFilename, resolve);
                            chrome.downloads.onChanged.addListener(Utils.dlCallbacks[downloadId]);
                        }
                        else {
                            // Resolve immediately with a "failure" DownloadSig, as it didn't even queue up.
                            Utils.lm('no downloadId for uri ' + uri);
                            Utils.lm('download error was: ' + chrome.runtime.lastError);
                            resolve(new DownloadSig(0, uri, destFilename));
                        }
                    }
                );
            }, C.UTILS_CONF.DL_SPACING_MS);
        });
    };


    /**
     * Helper to build the chrome.downloads.onChanged callbacks, avoiding unwanted closures.
     */
    static buildDlCallback(dlId, dlUri, dlFile, res) {
        return ((dlDelta) => {
            // Guard against weird, SNAFU blank dlDeltas.
            if (!dlDelta) { 
                Utils.lm('onChanged called with null/undefined/empty dlDelta. Weird. Returning false.');
                return false; 
            }

            // If this event is for our downloadId, see if the download finished. Take resume() action if the dl was interrupted,
            // resolve in shame if the resume() fails, resolve in shame if the state won't leave "interrupted", and don't even 
            // log in any other cases.
            if (dlDelta.id === dlId) {
                let dlDownloadSig = new DownloadSig(dlId, dlUri, dlFile);

                if (C.DLDK.STATE in dlDelta) {
                    let currDlState = dlDelta.state.current;
                    let prevDlState = dlDelta.state.previous;

                    if (currDlState === C.DLS.CPT) {
                        //Utils.lm(`Download ${dlId} to "${dlFile}" completed successfully.`);
                        Utils.removeOnChangedListenerAndResolveSig(dlId, dlDownloadSig, res);
                    }
                    else if (currDlState === C.DLS.INT && prevDlState !== C.DLS.INT) {
                        // Try to resume the download ONLY ONCE.
                        chrome.downloads.resume(dlId, () => {
                            // Resolve in shame if resume() errors.
                            if (Utils.exists(runtime.lastError)) {
                                Utils.lm(
                                    `Download ${dlId} of "${dlFile}" could not be resumed. Trashing the listener and just resolving. ` +
                                    ` runtime.lastError:\n\t${JSON.stringify(runtime.lastError)}`
                                );
                                Utils.removeOnChangedListenerAndResolveSig(dlId, dlDownloadSig, res);
                            }
                            else {
                                //Utils.lm(`Download ${dlId} for "${dlFile}" resumed without error. Continuing along...`);
                            }
                        });
                    }
                    else if (currDlState === C.DLS.INT && prevDlState === C.DLS.INT) {
                        Utils.lm(`Download ${dlId} has not moved from state "interrupted". Trashing the listener and just resolving.`);
                        Utils.removeOnChangedListenerAndResolveSig(dlId, dlDownloadSig, res);
                    }
                    else {
                        // Do nothing. All other cases mean "Wait for this dlId to be the subject, or wait for state to change".
                    }
                }
                else {
                    // Do nothing. dlDelta is not required to have a "state" property on every call.
                }

                // All previous actions are "normal operation OK".
                return true;
            }
            else {
                // Do nothing. This onChanged() call was about a different download.
            }

            // "normal operation OK".
            return true;
        });
    }


    /**
     * Helper to remove a dlId's onChanged() listener, delete the listener from the dlCallbacks list, and resolve the dlDownloadSig
     * using the "res" param.
     *  
     * @param {int} dlId 
     * @param {DownloadSig} dlDownloadSig 
     * @param {Function} res 
     */
    static removeOnChangedListenerAndResolveSig(dlId, dlDownloadSig, res) {
        if (Utils.exists(Utils.dlCallbacks[dlId])) {
            chrome.downloads.onChanged.removeListener(Utils.dlCallbacks[dlId]);
            delete Utils.dlCallbacks[dlId];
            res(dlDownloadSig);
        }
    }


    /**
     * Download as zip.
     */
    static downloadInZip(fileOpts) {
        var zip = new JSZip();
        var promises = [];

        for (var i = 0; i < fileOpts.length-1; i++) {
            if (Utils.isSTOP()) {
                Utils.lm(`aborting zip creation, rejecting from downloadInZip().`);
                return C.CAN_FN.PR_RJ_STOP();
            }

            // Create an array of promises for fetching each file as a BLOB and setting that data in the
            // zip file.
            if (!fileOpts[i].uri.match(/preview/)) {
                promises.push(new Promise((resolve, reject) => {
                    Utils.lm(`Adding file option to zip file for download:\n     ${JSON.stringify(fileOpts[i])}`);

                    // Get the data for each file as a BLOB and add it to the zip.
                    return Utils.sendXhr(C.ACTION.GET, fileOpts[i].uri, ['response'], C.DOC_TYPE.BLOB)
                        .then((r) => {
                            zip.file(fileOpts[i].filePath, r);
                            Utils.lm(`File added to zip successfully: ${fileOpts[i].filePath}`);

                            resolve(true);
                        })
                        .catch((error) => {
                            Utils.lm(
                                `Adding file to zip failed for: ${fileOpts[i].filePath}.\n    ` +
                                `However, resolving to preserve the other file data. Error: ${JSON.stringify(error)}`
                            );

                            resolve(false);
                        });
                }));
            }
        }

        // Get all the promises executed, do not STOP, and download the zip file if all goes well.
        return Promise.all(promises).then(() => {
            if (Utils.isSTOP()) {
                Utils.lm(`right after fetching/adding all the file blobs. So downloading it. Not Stopping!`);
            }

            zip.generateAsync({
                type: C.DOC_TYPE.BLOB
            })
            .then((content) => {
                if (Utils.isSTOP()) {
                    Utils.lm(`but we created the zip successfully. So downloading it. Not Stopping!`);
                }

                // Setup the download filename and href, then download it directly.
                var zipFilename = 'imgs' + fileOpts[0].uri.substring(9, fileOpts[0].uri.indexOf(C.ST.WHACK)) + '.zip';
                var zipUri = URL.createObjectURL(content);
            
                // Download. Reclaim the object uri memory on finally, but return the downloadFile() promise result.
                var prm = Utils.downloadFile(zipUri, zipFilename, Output.getInstance());
                prm.finally(() => { URL.revokeObjectURL(zipUri); });

                // return the downloadFile() promise result.
                return prm;
            })
            .catch((err) => {
                Utils.lm(`failed to create zip file. Error: ${err}`);
                return Promise.reject(err);
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
                        Utils.lm('Error starting download: ' + chrome.runtime.lastError);
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
    static setInStorage(itemsToStore, area) {
        var storageSetter = (area === 'local' ? chrome.storage.local : chrome.storage.sync);

        return new Promise((resolve, reject) => {
            storageSetter.set(
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
    static getFromStorage(keys, area) {
        var storageGetter = (area === 'local' ? chrome.storage.local : chrome.storage.sync);

        return new Promise((resolve, reject) => {
            storageGetter.get(
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
     * A promise-based wrapper for removing storage items.
     * 
     * @param {Array<string>} keys 
     */
    static removeFromStorage(keys, area) {
        var storageRemover = (area === 'local' ? chrome.storage.local : chrome.storage.sync);

        return new Promise((resolve, reject) => {
            storageRemover.remove(
                keys,
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
    }

    /**
     * See if the param is actually the boolean value "true". Not something coerced.
     * 
     * @param {any} test 
     */
    static isTrue(test) {
        return (test === true);
    }


    /**
     * See if the param is actually the boolean value "false". Not something coerced.
     * 
     * @param {any} test 
     */
    static isFalse(test) {
        return (test === false);
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
            }, C.UTILS_CONF.LISTENER_TIMEOUT_MS);


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
                Utils.lm(`Stopping load for iframe with id "${iframe.id}", and it will be removed.`);
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
     * Is this string uri using a browser-specific extension pseudoprotocol?
     * A '/^(moz-|chrome-)?extension\:\/\//stuff/more.ext' uri?
     * 
     * @param {string} u 
     */
    static isExtensionUri(u) {
        return (
            (u.indexOf(C.WAY.E) === 0) ||
            (u.indexOf(C.WAY.ED_E) === 0) ||
            (u.indexOf(C.WAY.CH_E) === 0) ||
            (u.indexOf(C.WAY.MZ_E) === 0)
        );
    }
    

    /**
     * Are we on the background page?
     */
    static isBackgroundPage(win) {
        let h = win.location.href;
        let isPage = (
            this.isExtensionUri(h) && 
            (h.indexOf(C.PAGE.BACKGROUND) !== -1)
        );

        return isPage;
    }

    
    /**
     * Are we on the popup page?
     */
    static isPopupPage(win) {
        let h = win.location.href;
        let isPage = (
            this.isExtensionUri(h) && 
            (h.indexOf(C.PAGE.POPUP) !== -1)
        );

        return isPage;
    }


    /**
     * Are we on the options page?
     */
    static isOptionsPage(win) {
        let h = win.location.href;
        let isPage = (
            this.isExtensionUri(h) && 
            (h.indexOf(C.PAGE.OPTIONS) !== -1)
        );

        return isPage;
    }


    /**
     * build a rambling, unique selector for a given DOM element. These are ugly, but generate quickly.
     * Taken from https://stackoverflow.com/questions/8588301/how-to-generate-unique-css-selector-for-dom-element
     * 
     * @param {DOMElement} el 
     */
    static generateSelector(el) {
        let path = [], parent;
        while (parent = el.parentNode) {
            path.unshift(`${el.tagName}:nth-child(${[].indexOf.call(parent.children, el) + 1})`);
            el = parent;
        }

        return `${path.join(' > ')}`.toLowerCase();
    }


    /**
     * build a compact selector for a given DOM element. These are prettier selectors, and are slower to generate.
     * Taken from https://stackoverflow.com/questions/8588301/how-to-generate-unique-css-selector-for-dom-element
     * 
     * @param {DOMElement} el 
     */
    static generateCompactSelector(domEl) {
        let path = [];
        let parent = null;
        let el = domEl;
        
        while (parent = el.parentNode) {
            let tag = el.tagName, siblings;
            
            path.unshift(
                (
                    el.id ? `#${el.id}` : (
                        siblings = parent.children, ([].filter.call(siblings, sibling => sibling.tagName === tag).length === 1 ? tag : `${tag}:nth-child(${1 + [].indexOf.call(siblings, el)})`)
                    )
                )
            );

            el = parent;
        };

        return `${path.join(' > ')}`.toLowerCase();
    }


    /**
     * Configure the count of how many concurrent downloads can be fired off at once.
     * 
     * @param {*} val 
     */
    static setConcurrentDownloadCount(val) {
        var num = Number.parseInt(val, 10);

        if (!Number.isNaN(num)) {
            this.concurrentDls = num;
        }
    }
}

// do setup.
Utils.setup();

// Set our static instance on the background window object, and reset the downloader if
// This is the first run through this file and we're on the background page.
if (Utils.isBackgroundPage(window) && !window.hasOwnProperty(C.WIN_PROP.UTILS_CLASS)) {
    window[C.WIN_PROP.UTILS_CLASS] = Utils;
    Utils.resetDownloader();
}

// Export.
export default Utils;
