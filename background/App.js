'use strict'

/**
 * The application object for GimmeGimmeGimme.
 */
var App = (function App(Output, Digger, Logicker, Utils) {
    var me = {
        loc: {},
        doc: {},
        zoomLinkUris: [],
        thumbUris: [],
        downloadsDir: 'Gimme-site_pagename-tmp',
        digOpts: {
            doScrape: true,
            doDig: true,
        },
    };

    var u = Utils;

    var _alreadyDone = false;
    var _alreadyDownloaded = [];
    var _fileOptions = [];

    var GGGIMME_ID = 'gimmegimmegimme';

    /**
     * Use the Chrome downloads system to download a file.
     */
    var downloadCount = 0;
    function downloadFile(uri, destFilename) {
        if (_alreadyDownloaded.indexOf(uri) != -1) {
            return;
        }
        _alreadyDownloaded.push(uri);
        Output.toOut('Downloading file ' + (++downloadCount));

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
                    console.log('Downloading as id: ' + downloadId);
                    Output.toOut('Completed file download.');
                }
                else {
                    console.log('Error starting download: ' + chrome.runtime.lastError);
                }
            }
        );
    }


    /**
     * Build a salted directory name based on me.loc. 
     */
    function getSaltedDirectoryName(loc) {
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

        return ('Gimmie-' + loc.hostname + '__' + hackedPageName + '__' + (new Date()).getTime() + 'tmp');
    }


    /**
     * Merge three arrays. Really, they can be of any value types.
     */
    function mergeDownloadUris(arr1, arr2, arr3) {
        var finalUriList = [];

        if (Array.isArray(arr1)) {
            finalUriList = finalUriList.concat(arr1);
        }

        if (Array.isArray(arr2)) {
            arr2.forEach(function insertIntoFinalUriList(uri) {
                if (finalUriList.indexOf(uri) === -1) {
                    finalUriList.push(uri);
                }
            });
        }

        if (Array.isArray(arr3)) {
            arr3.forEach(function addToFinalUriList(uri) {
                if (finalUriList.indexOf(uri) === -1) {
                    finalUriList.push(uri);
                }
            })
        }

        // Voila!
        return finalUriList;
    };


    /**
     * Once we have the files from the digger, this callback downloads them.
     */
    me.startDownloading = function startDownloading(files) {
        var fileList = [];
        var fileList = mergeDownloadUris(files, me.zoomLinkUris);

        if (!fileList || !fileList.length) {
            console.log('no files');
            Output.toOut('No URLs to download.');
            
            return;
        }

        Output.toOut('' + fileList.length + 'Downloading!');

        // Create each new filename, add the file to the UI list, and kick off the
        // download.
        fileList.forEach(function processFileSrc(fileSrc, idx) {
            if (!fileSrc || !fileSrc.replace) {
                console.log('Bad fileSrc.... ' + JSON.stringify(fileSrc));
                return;
            }

            // Skip the thumbs.
            if (/(thumb|\/t-|\/tn|_tb\.)/.test(fileSrc)) {
                return;
            }

            // take the querystring off just to make the destSrc. We need it when downloading, however.
            var fSrc = fileSrc.replace(/\?(.+?)$/, '');
            var destName = fSrc.replace(/^.+\//, '');

            // Hack just to get filenames right.
            if (destName.indexOf('.') === -1) {
                destName = destName + '.jpg';
            }

            var destSrc = me.downloadsDir + '/' + destName;

            if (!!fSrc && !!destSrc) {
                console.log(fSrc + ' -> ' + destSrc);
            }
            
            // Update the UI, download the file.
            Output.setEntryAsDownloading(idx);
            downloadFile(fileSrc, destSrc);        
        });

        Output.toOut('-Done Digging-');
    };

    
    /**
     * Take all the crap out of the above function, and just make it
     * immediately download everything in me.linkHrefs.
     */
    me.justDownloadLinkHrefs = function justDownloadLinkHrefs() {
        if (Array.isArray(me.zoomLinkUris)) {
            console.log('Downloading the array scraped by App. Count: ' + me.zoomLinkUris.length);

            var count = 0;
            me.zoomLinkUris.forEach(function downloadEachHref(thumbUri) {
                // check input.
                if (!u.exists(thumbUri)) {
                    return;
                }

                // take the querystring off just to make the destSrc. 
                //We need it when downloading, however.
                var destName = thumbUri.replace(/^.+\//, '').replace(/\?(.+?)$/, '');

                // Shove ".jpg" on there if there's no file extension.
                if (destName.indexOf('.') === -1) {
                    destName = destName + '.jpg';
                }

                // make the full dest
                var destFullPath = me.downloadsDir + '/' + destName;
                console.log('Queing DL: ' + thumbUri + '\n  -> ' + destFullPath);
                
                // Update the UI, download the file.
                //Output.setEntryAsDownloading(idx);
                downloadFile(thumbUri, destFullPath);
                count++;
            });
            
            Output.toOut('Queued all ' + count + ' pic URIs.' )
            return true;
        }
        else {
            console.log("Tried to download the linkHrefs in App. Failed, cuz it's not an array...");
            Output.toOut("Done with canned rules. Scraping the page on the f'rilla.");
        }
    };
    


    /**
     * 
     */
    me.presentFileOptions = function presentFileOptions(files) {
        var fileList = [];
        var fileList = mergeDownloadUris(files, me.zoomLinkUris);

        if (!fileList || !fileList.length) {
            console.log('[PresentFileOpts] no files');

            Output.toOut('No URLs to download.');
            
            return;
        }
        console.log('[PresentFileOpts] fileList count: ' + fileList.length);

        Output.toOut('click on the files in the list to download them.');
        Output.clearFilesDug();

        // Create each new filename, add the file to the UI list, and kick off the
        // download.
        fileList.forEach(function processFileSrc(fileSrc, idx) {
            if (!fileSrc || !fileSrc.replace) {
                console.log('Bad fileSrc.... ' + JSON.stringify(fileSrc));
                return;
            }

            // //
            // // ---------- DON'T DO THIS. ------- 
            // //
            // // Skip the thumbs.
            // if (/(thumb|\/t-|\/tn|_tb\.)/.test(fileSrc)) {
            //     return;
            // }

            // take the querystring off just to make the destSrc. We need it when downloading, however.
            var fSrc = fileSrc.replace(/\?(.+?)$/, '');
            var destName = fSrc.replace(/^.+\//, '');

            // Hack just to get filenames right.
            if (destName.indexOf('.') === -1) {
                destName = destName + '.jpg';
            }

            var destSrc = me.downloadsDir + '/' + destName;

            if (!!fSrc && !!destSrc) {
                console.log(fSrc + ' -> ' + destSrc);
            }
            
            var optIdx = _fileOptions.push(destSrc);

            var fileOption = {
                id: optIdx,
                uri: fileSrc,
                filePath: destSrc,
                onSelect: downloadFile,
            };

            Output.addFileOption(fileOption);
        });

        Output.toOut('Please select which files you would like to download.');
        Output.showActionButtons();
    };


    /**
     * 
     */
    function fetchMeDoc(uri, onEnd) {
        var xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function onXhrRSC() {
            if (this.readyState == XMLHttpRequest.DONE) 
            {
                if (this.status == 200) {
                    console.log('[FetchMeDoc] Got it.');
                    me.doc = this.response;
                }
                else {
                    console.log('[FetchMeDoc] Error Status on done ' + this.status + ' fetching me.doc');
                    me.doc = undefined;
                }

                onEnd();
            }
        };
        
        xhr.onerror = function onXhrError() {

        };

        xhr.open('GET', uri, true);
        xhr.responseType = 'document';
        xhr.send();
    }

  
  
    /**
     * Retrieve the current tab, ask our client-script for the location object, then
     * call the callback with the XHR'd document object for the tab's url.
     */
    function sendDocRequest(onResponse, contentScriptSelection) {
        // Query to get the current tab.
        chrome.tabs.query({
            active: true,
            currentWindow: true
        },
        function(tabs) {
            var message = {
                senderId: GGGIMME_ID
            };

            // No response callback means to greentextonblackify.
            if (!onResponse) {
                message.thegreening = {};    
            }
            else if (contentScriptSelection) {
                var d = Logicker.getMessageDescriptorForUrl(tabs[0].url);
                message.selector = d.selector;
                message.linkHrefProp = d.linkHrefProp;
                message.thumbSrcProp = d.thumbSrcProp;
            }

            // Ask the client-script for the active tab's location object, as well as
            // an array of values corresponding to the selector and propName for that tag. 
            // Typically, these selectors and propNames will be some combination of 
            // "img", "a", "src", and "href".
            chrome.tabs.sendMessage(
                tabs[0].id,
                message,
                function processMessageResponse(resp) {
                    // Just bail if the response is messed up.
                    if (!resp) {
                        console.log('Aborting, got an undefined response.');
                        return; 
                    }
                    if (!resp.locator || !resp.docHtml || !resp.zoomLinkUris || !Array.isArray(resp.zoomLinkUris)|| !resp.thumbUris || !Array.isArray(resp.thumbUris)) {
                        console.log('Aborting, got a malformed response.');
                        return;
                    }
                    
                    // Get the locator from the response. Create the downloads directory name.
                    me.loc = resp.locator;
                    me.downloadsDir = getSaltedDirectoryName(me.loc);

                    // Get the Uris. The LocationGrabber makes sure they are *full* uris.
                    me.zoomLinkUris = [].concat(resp.zoomLinkUris);
                    me.thumbUris = [].concat(resp.thumbUris);

                    // Fetch the HTML document.
                    fetchMeDoc(me.loc.href, function afterFetchingDoc() {
                        // If we know special things about the site, such as thumb -> zoomedImg mappings
                        // or whatnot, we do it here. It also returns a descriptor of options for scraping
                        // and digging.
                        var dataDescriptor = Logicker.postProcessResponseData(me.thumbUris, me.loc.href);
                        me.zoomLinkUris = dataDescriptor.zoomLinkUris;
                        me.digOpts.doDig = dataDescriptor.doDig;
                        me.digOpts.doScrape = dataDescriptor.doScrape;

                        // log the linkHrefs from LocationGrabber.
                        // Then, log the thumbSrcs from LocationGrabber.
                        if (me.zoomLinkUris && (me.zoomLinkUris.length > 0)) {
                            console.log('Got some zoomLinkUris, count: ' + me.zoomLinkUris.length);
                        }
                        else {
                            console.log('No zoomLinkUris received.');
                            me.zoomLinkUris = [];
                        }
                        if (me.thumbUris && (me.thumbUris.length > 0)) {
                            console.log('Got some thumbUris, count: ' + me.thumbUris.length);
                        }
                        else {
                            console.log('No thumbUris received.');
                            me.thumbUris = [];
                        }

                        // Call the callback.
                        onResponse();
                    });
                }
            );
        });
    };


    /**
     * Construct a baseUri suitable for passing to the URL() constructor.
     * It either builds it off the passed-in location obj, or it uses the Digger's
     * cached "locator".
     */
    function getBaseUri(l) {
        var loki = (u.exists(l) ? l : me.loc);
        var baseUri = loki.href.substring(0, loki.href.lastIndexOf('/') + 1);

        return baseUri;
    }


    /**
     * MAIN ENTRY POINT OF THE APP (-1)
     */
    me.scrape = function scrape() {
        _alreadyDownloaded = [];
        me.filesDug = [];
        me.loc = {};
        me.doc = {};
        me.zoomLinkUris = [];
        me.thumbUris = [];
        
        Output.toOut('initializing: collecting urls from page...');
        Output.clearFilesDug();

        // get the doc of the tab to dig though. Then let the digger find the gallery. 
        sendDocRequest(function onUrisReceived() {
            if (!me.doc) {
                console.log('Aborting. Received null document.');
                Output.toOut('Could not dig. Would you try refreshing the page, please?');
                return;
            }

            // Just start downloading if we don't want to dig *or* scrape.
            // it means the post-processing found exactly what it needed already.
            if ((me.digOpts.doDig === false) && (me.digOpts.doScrape === false)) {
                var success = me.justDownloadLinkHrefs();
                
                // Only end if we finished. Otherwise, fall back 
                // to still scraping and digging.
                if (success) {
                    return;
                }
            }

            // If we got matching pairs of hrefs and srcs back, set them as the override.
            Digger.overrideUrisToDig(me.thumbUris, me.zoomLinkUris);
            Digger.setDigOpts(me.digOpts);
            Digger.scrape(me.doc, me.loc, me.startDownloading);
        }, false);
    };


    /**  
     * MAIN ENTRY POINT OF THE APP. (0)
     */
    me.digGallery = function digGallery() {
        _alreadyDownloaded = [];
        me.filesDug = [];
        me.loc = {};
        me.doc = {};
        me.zoomLinkUris = [];
        me.thumbUris = [];
        
        Output.toOut('initializing: collecting URLs from the page...');
        Output.clearFilesDug();

        // get the doc of the tab to dig though. Then let the digger find the gallery. 
        sendDocRequest(function onUrisReceived() {
            if (!me.doc) {
                console.log('Aborting. Received null document.');
                Output.toOut('Could not dig. Would you try refreshing the page, please?');
                return;
            }

            // Just download from here if all of our linkHrefs should already point directly
            // at a valid imgUrl.
            if ((me.digOpts.doDig === false) && (me.digOpts.doScrape === false)) {
                var wasAbleTo = me.justDownloadLinkHrefs();

                // Scrape and dig anyway if it failed to dl the me.linkHrefs.
                if (!wasAbleTo) {
                    return;
                }
                else {
                    me.digOpts = {
                        doDig: true,
                        doScrape: true
                    };
                }
            }

            // If we got matching pairs of hrefs and srcs back, set them as the override.
            Digger.overrideUrisToDig(me.thumbUris, me.zoomLinkUris);
            Digger.setDigOpts(me.digOpts);
            Digger.digGallery(me.doc, me.loc, me.startDownloading);
        }, true);
    };


   /**  
     * MAIN ENTRY POINT OF THE APP. (0)
     */
    me.digFileOptions = function digFileOptions() {
        _alreadyDownloaded = [];
        me.filesDug = [];
        me.loc = {};
        me.doc = {};
        me.zoomLinkUris = [];
        me.thumbUris = [];
        
        Output.toOut('initializing: collecting URLs from the page...');
        Output.clearFilesDug();

        // get the doc of the tab to dig though. Then let the digger find the gallery. 
        sendDocRequest(function onUrisReceived() {
            if (!me.doc) {
                console.log('Aborting. Received null document.');
                Output.toOut('Could not dig. Would you try refreshing the page, please?');
                return;
            }

            me.digOpts = {
                doScrape: true,
                doDig: true,
            };

            // If we got matching pairs of hrefs and srcs back, set them as the override.
            Digger.overrideUrisToDig(me.thumbUris, me.zoomLinkUris);
            Digger.setDigOpts(me.digOpts);
            Digger.digGallery(me.doc, me.loc, me.presentFileOptions);
        }, true);
    };


    /**
     * MAIN ENTRY POINT OF THE APP (-1).
     * Scrape, but do not download automatically. Give the user a list of choices.
     */
    me.scrapeFileOptions = function scrapeFileOptions() {
        _alreadyDownloaded = [];
        me.filesDug = [];
        me.loc = undefined;
        me.doc = undefined;
        me.zoomLinkUris = [];
        me.thumbUris = [];
        
        Output.toOut('initializing: collecting urls from page...');
        Output.clearFilesDug();

        // get the doc of the tab to dig though. Then let the digger find the gallery. 
        sendDocRequest(function docRequestDone() {
            if (!me.doc || !me.loc) {
                console.log('Aborting. Received null document.');
                Output.toOut('Could not dig. Would you try refreshing the page, please?');
                return;
            }
            else {
                console.log('[ScrapeFileOpts] me.doc: ' + JSON.stringify(me.doc));
                console.log('[ScrapeFileOpts] me.loc: ' + JSON.stringify(me.loc));
            }

            me.digOpts = {
                doScrape: true,
                doDig: false,
            };

            // If we got matching pairs of hrefs and srcs back, set them as the override.
            Digger.setDigOpts(me.digOpts);
            Digger.scrape(me.doc, me.loc, me.presentFileOptions);
        }, true);
    };



    /**
     * Send the request to green-text-on-black the page.
     */
    me.wraithIt = function wraithIt() {
        me.sendDocRequest()
    };


    return me;
});
