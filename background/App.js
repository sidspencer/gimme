'use strict'

/**
 * Factory function for the main "Application" backend of Gimme.
 */
var App = (function App(Output, Digger, Scraper, Logicker, Utils) {
    var me = {
        galleryMap: {},
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

    var GIMME_ID = 'gimme';

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
                    console.log('[App] Downloading as id: ' + downloadId + '\n URI: ' + uri);

                    // Search for the download. We will check some things.
                    chrome.downloads.search(
                        {
                            id: downloadId,
                        }, 
                        function searchCallback(downloadItems) {
                            // Check the mime type. if it's 'text/'-anything, it's not media.
                            downloadItems.forEach(function cancelTextMimeTypes(dlItem) {
                                if (dlItem.mime.indexOf('text') === 0) {
                                    chrome.downloads.cancel(dlItem.id, function logDlCancel() {
                                        console.log(
                                            '[App] download.id = ' + dlItem.id 
                                            + ' was cancelled. Mime type was not media type. Was: ' + dlItem.mime
                                        );

                                        //TODO: Figure what to Output.
                                    });
                                }
                            });
                        }
                    );
                }
                else {
                    console.log('[App] Error starting download: ' + chrome.runtime.lastError);
                }
            }
        );
    }
    App.downloadFile = downloadFile;


    /**
     * Build a salted directory name based on me.loc. 
     */
    function getSaltedDirectoryName(loc) {
        // Stash loc for later
        if (!loc.hostname || !loc.hostname) {
            loc = App.LAST_LOC;
        }
        else {
            App.LAST_LOC = { 
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
    App.LAST_LOC = { hostname: 'localhost', pathname: '/' };    
    App.getSaltedDirectoryName = getSaltedDirectoryName;


    /**
     * Once we have the dug uris from the response, this callback downloads them.
     */
    me.startDownloading = function startDownloading(zoomUris) {
        if (!zoomUris || !zoomUris.length) {
            console.log('[App] No files to download.');
            Output.toOut('No URLs to download.');
            return;
        }

        Output.toOut('' + zoomUris.length + ' Downloading!');

        // Create each new filename, add the file to the UI list, and kick off the
        // download.
        zoomUris.forEach(function startDownloadForUri(uri, idx) {
            if (!uri || !uri.replace) {
                console.log('[App] URI not a string: ' + JSON.stringify(uri));
                return;
            }

            // Make the destination file path.
            var destFilePath = me.downloadsDir + '/' + uri.replace(/^.+\//, '').replace(/\?(.+?)$/, '');
            console.log(uri + ' -> ' + destFilePath);
            
            // Update the UI, download the file.
            Output.setEntryAsDownloading(idx);
            downloadFile(uri, destFilePath);        
        });

        Digger.persistentDugUris = [];
        Output.toOut('-Done Downloading-');
    };

    
    /**
     * Take all the crap out of the above function, and just make it
     * immediately download everything in me.linkHrefs.
     */
    me.justDownloadLinkHrefs = function justDownloadLinkHrefs() {        
        var linkUris = Object.getOwnPropertyNames(me.galleryMap).map(function getZoom(t) {
            return me.galleryMap[t];
        });

        if (Array.isArray(linkUris)) {
            console.log('[App] Downloading grabbed URIs. Count: ' + linkUris.length);            

            var count = 0;
            linkUris.forEach(function downloadEachUri(zoomUri) {
                // check input.
                if (!u.exists(zoomUri)) {
                    console.log('[App] Uri did not exist.');
                    return;
                }

                // take the querystring off just to make the destSrc. 
                //We need it when downloading, however.
                var destName = zoomUri.replace(/^.+\//, '').replace(/\?(.+?)$/, '');

                // make the full dest
                var destFullPath = me.downloadsDir + '/' + destName;
                console.log('[App] Queing DL: ' + zoomUri + '\n  -> ' + destFullPath);
                
                // Update the UI, download the file.
                downloadFile(zoomUri, destFullPath);
                count++;
            });
            
            Output.toOut('Queued all ' + count + ' pic URIs.' );
            Digger.persistentDugUris = [];
            
            return true;
        }
        else {
            console.log('[App] Malformed download link array.');
            Output.toOut('Could not automatically download.');
        }
    };
    


    /**
     * Give the user a list of media that was found. Download based upon their preference
     * and interaction.
     */
    me.presentFileOptions = function presentFileOptions(zoomUris) {
        var uriList = [].concat(zoomUris);

        if (!uriList || !uriList.length) {
            console.log('[App] No files to download.');
            Output.toOut('No URLs to download.');
            
            return;
        }
        
        console.log('[App] Count of files to download: ' + uriList.length);
        Output.toOut('click on the files in the list to download them.');
        Output.clearFilesDug();

        // Set up the download options for each of the uris returned.
        uriList.forEach(function addFileOption(uri, idx) {
            if (!uri || !uri.replace || uri.indexOf('.') === 0) {
                console.log('[App] Bad file object for download: ' + JSON.stringify(uri));
                return;
            }

            // take the querystring off just to make the destSrc. We need it when downloading, however.
            var uriWithoutQs = uri.replace(/\?(.+?)$/, '');
            var destFileName = uriWithoutQs.replace(/^.+\//, '');

            var destFilePath = me.downloadsDir + '/' + destFileName;
            var optIdx = _fileOptions.push(destFilePath);

            var fileOption = {
                id: optIdx,
                uri: uri,
                filePath: destFilePath,
                onSelect: downloadFile,
            };

            Output.addFileOption(fileOption);
        });

        Output.toOut('Please select which files you would like to download.');
        Output.showActionButtons();
    };


    /**
     * Fetch the document on which we are scraping/digging.
     */
    function fetchMeDoc(uri, onEnd) {
        var xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function onXhrRSC() {
            if (this.readyState == XMLHttpRequest.DONE) 
            {
                if (this.status == 200) {
                    console.log('[App] Got document for URI: ' + uri);
                    onEnd(this.responseXML);
                }
                else {
                    console.log('[App] Error status ' + this.status + ' while fetching URI: ' + uri);
                    onEnd(undefined);
                }
            }
        };
        
        xhr.onerror = function onXhrError() {
            console.log('[App] XHR error while fetching URI: ' + uri);
            onEnd(undefined);
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
                senderId: GIMME_ID
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
                message.useRawValues = d.useRawValues;
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
                        console.log('[App] Aborting, got an undefined response.');
                        return; 
                    }
                    
                    // Get the locator from the response. Create the downloads directory name.
                    var loc = resp.locator;
                    me.downloadsDir = getSaltedDirectoryName(loc);

                    // Get the Uris. The LocationGrabber makes sure they are *full* uris.
                    var initialMap = Object.assign({}, resp.galleryMap);

                    // Fetch the HTML document.
                    fetchMeDoc(loc.href, function afterFetchingDoc(doc) {
                        // If we know special things about the site, such as thumb -> zoomedImg mappings
                        // or whatnot, we do it here. It also returns a descriptor of options for scraping
                        // and digging.
                        var dataDescriptor = Logicker.postProcessResponseData(initialMap, loc.href);
                        
                        me.galleryMap = dataDescriptor.processedMap;
                        me.digOpts.doDig = dataDescriptor.doDig;
                        me.digOpts.doScrape = dataDescriptor.doScrape;

                        // log the linkHrefs from LocationGrabber.
                        // Then, log the thumbSrcs from LocationGrabber.
                        var mapSize = Object.getOwnPropertyNames(me.galleryMap).length;
                        console.log('[App] Initial processed response has ' + mapSize + ' thumb uris -> zoom link uris.');
                        
                        // Call the callback.
                        onResponse(doc, loc);
                    });
                }
            );
        });
    };


    /**
     * Main entry point of the app for scraping media from the immediate page, and not having
     * any choice over which media gets downloaded. 
     */
    me.scrape = function scrape(options) {
        _alreadyDownloaded = [];
        me.filesDug = [];
        me.galleryMap = {};
        
        Output.toOut('initializing: collecting urls from page...');
        Output.clearFilesDug();

        // Get the doc we are to scrape. 
        sendDocRequest(function onDocReceived(doc, loc) {
            if (doc) {
                console.log('[App] Aborting. Received null document.');
                Output.toOut('Could not scrape. Would you try refreshing the page, please?');
                return;
            }

            // Just start downloading if we don't want to actually scrape.
            // it means the post-processing found exactly what it needed already.
            if (me.digOpts.doScrape === false) {
                var success = me.justDownloadLinkHrefs();
                
                // Only end if we finished. Otherwise, fall back 
                // to still scraping and digging.
                if (success) {
                    return;
                }
            }

            Scraper.scrape(doc, loc, options, me.startDownloading);
        }, false);
    };


    /**  
     * Main entry point of the app if the user wants to accept any media found by the Digger's
     * gallery-searching logic without choosing from any options.
     */
    me.digGallery = function digGallery() {
        _alreadyDownloaded = [];
        me.filesDug = [];
        me.galleryMap = {};
        
        Output.toOut('initializing: collecting URLs from the page...');
        Output.clearFilesDug();

        // get the doc of the tab to dig though. Then let the digger find the gallery. 
        sendDocRequest(function onDocReceived(doc, loc) {
            if (!doc) {
                console.log('[App] Aborting. Received null document.');
                Output.toOut('Could not dig. Would you try refreshing the page, please?');
                return;
            }

            // Just download from here if all of our linkHrefs should already point directly
            // at a valid imgUrl.
            if ((me.digOpts.doDig === false) && (me.digOpts.doScrape === false)) {
                var wasAbleTo = me.justDownloadLinkHrefs();

                // Scrape and dig anyway if it failed to dl the me.linkHrefs.
                if (wasAbleTo) {
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
            Digger.init({
                digOpts: me.digOpts,
                response: me.startDownloading,                
                galleryMap: me.galleryMap,
            });
            Digger.digGallery(doc, loc);
        }, true);
    };


   /**  
     * The main entry point of the app if you want to harvest media items pointed to from
     * galleries, and have them be shown to the user so the user can choose which ones they
     * want. 
     */
    me.digFileOptions = function digFileOptions() {
        _alreadyDownloaded = [];
        me.filesDug = [];
        me.galleryMap = {};
        
        Output.toOut('initializing: collecting URLs from the page...');
        Output.clearFilesDug();

        // get the doc of the tab to dig though. Then let the digger find the gallery. 
        sendDocRequest(function onDocReceived(doc, loc) {
            if (!doc) {
                console.log('[App] Aborting. Received null document.');
                Output.toOut('Could not dig. Would you try refreshing the page, please?');
                return;
            }

           // Just download from here if all of our linkHrefs should already point directly
            // at a valid imgUrl.
            if ((me.digOpts.doDig === false) && (me.digOpts.doScrape === false)) {
                var wasAbleTo = me.justDownloadLinkHrefs();

                // Scrape and dig anyway if it failed to dl the me.linkHrefs.
                if (wasAbleTo) {
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
            Digger.init({
                digOpts: me.digOpts,
                response: me.presentFileOptions,                
                galleryMap: me.galleryMap,
            });
            Digger.digGallery(doc, loc);
        }, true);
    };


    /**
     * A main entry point of the app.
     * Scrape, but do not download automatically. Give the user a list of choices.
     */
    me.scrapeFileOptions = function scrapeFileOptions(options) {
        _alreadyDownloaded = [];
        me.filesDug = [];
        me.galleryMap = {};
        
        Output.toOut('initializing: collecting urls from page...');
        Output.clearFilesDug();

        // get the doc of the tab to dig though. Then let the digger find the gallery. 
        sendDocRequest(function docRequestDone(doc, loc) {
            if (!doc) {
                console.log('[App] Aborting. Received null document.');
                Output.toOut('Could not scrape. Would you try refreshing the page, please?');
                return;
            }

            Scraper.scrape(doc, loc, options, me.presentFileOptions);
        }, true);
    };


    // return the instance.
    return me;
});
