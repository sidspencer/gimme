'use strict'

/**
 * Factory function for the main "Application" backend of Gimme.
 */
var App = (function App(Output, Digger, Scraper, Logicker, Utils) {
    var me = {
        galleryMap: {},
        peeperMap: {},
        downloadsDir: 'Gimme-site_pagename-tmp',
        digOpts: {
            doScrape: true,
            doDig: true,
        },
        alreadyDone: false,
        alreadyDownloaded: {},
        fileOptions: [],
        downloadCount: 0,
    };

    // Aliases
    var u = Utils;


    /**
     * Download a single uri to the filename (well, path) provided.
     */
    function downloadFile(uri, destFilename) {
        if (me.alreadyDownloaded[uri]) {
            return getDownloadItems(u.createDownloadSig(me.alreadyDownloaded[uri], uri, destFilename));
        }
        else {
            return (
                u.download(uri, destFilename)
                .then(function reportSuccess(downloadSig) {
                    Output.toOut('Downloading file ' + (++me.downloadCount));
                    return Promise.resolve(downloadSig);                    
                })
                .then(u.searchDownloads)
            );
        }
    }
    App.downloadFile = downloadFile;


    /**
     * Build a salted directory name based on me.loc. 
     */
    function getSaltedDirectoryName(loc) {
        // Stash loc for later
        if (!loc || !loc.hostname) {
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
    me.startDownloading = function startDownloading(harvestedMap) {
        var length = Object.keys(harvestedMap).length;
        var downloadPromises = [];        

        if (!harvestedMap || length < 1) {
            console.log('[App] No files to download.');
            Output.toOut('No URLs to download.');
        }
        else {
            console.log('[App] Downloading ' + length + ' files.')
            Output.toOut('' + length + ' Downloading!');
        }

        // Create each new filename, add the file to the UI list, and kick off the
        // download.
        for (var thumbUri in harvestedMap) {
            var uri = harvestedMap[thumbUri];

            if (!uri || !uri.replace) {
                console.log('[App] URI not a string: ' + JSON.stringify(uri));
                continue;
            }

            // Make the destination file path.
            var destFilePath = me.downloadsDir + '/' + uri.replace(/^.+\//, '').replace(/\?(.+?)$/, '');
            console.log(uri + ' -> ' + destFilePath);
            
            // Update the UI, download the file. Note the downloadPromise *always* resolves.
            // In an immediately-invoked function expression because of the closure on idx.
            (function createDownloadPromise(theUri, theFilePath, dlPromises) {
                var idx = dlPromises.push(
                    downloadFile(theUri, theFilePath)
                    .then(function setItemAsDownloading(downloadItems) {
                        Output.setEntryAsDownloading(idx);
                        return Promise.resolve(downloadItems);              
                    })
                    .catch(function catchDownloadingErrors(errorString) {
                        console.log(errorString);
                        return Promise.resolve([]);
                    })
                );
            })(uri, destFilePath, downloadPromises);               
        }

        return (
            Promise.all(downloadPromises)
            .then(function onAllDoneDownloading(allDownloadItems) {
                Output.toOut('-Done Downloading-');
                console.log('[App] -Done Downloading-\n\n')
                return Promise.resolve(allDownloadItems);
            })
        );
    };
    

    /**
     * Give the user a list of media that was found. Download based upon their preference
     * and interaction.
     */
    me.presentFileOptions = function presentFileOptions(harvestedMap) {
        if (!harvestedMap) {
            console.log('[App] called with null harvestedMap...');
            return Promise.resolve([]);
        }

        var thumbUris = Object.keys(harvestedMap);

        // We may have something wrong going on if this is the case.
        if (!/\:/.test(thumbUris[0])) {
            console.log('[App] Looks like harvestedMap may be a string... aborting presenting file options.');
            return Promise.resolve([]);
        }

        var length = thumbUris.length;

        if (length < 1) {
            console.log('[App] No files to download.');
            Output.toOut('No URLs to download.');            
        }
        
        console.log('[App] Count of files to download: ' + length);
        Output.toOut('click on the files in the list to download them.');
        Output.clearFilesDug();

        // Set up the download options for each of the uris returned.
        for (var thumbUri in harvestedMap) {
            var uri = harvestedMap[thumbUri];

            if (!uri || !uri.replace || uri.indexOf('.') === 0) {
                console.log('[App] Bad uri string for download: ' + JSON.stringify(uri));
                continue;
            }

            // take the querystring off just to make the destSrc. We need it when downloading, however.
            var uriWithoutQs = uri.replace(/\?(.+?)$/, '');
            var destFileName = uriWithoutQs.replace(/^.+\//, '');

            var destFilePath = me.downloadsDir + '/' + destFileName;
            var optIdx = me.fileOptions.push(destFilePath);
            var fileOption = u.createFileOption(optIdx, uri, thumbUri, destFilePath, downloadFile);

            Output.addFileOption(fileOption);
        }

        console.log('[App] Presented ' + me.fileOptions.length + ' file options.');
        Output.toOut('Please select which files you would like to download.');
        Output.showActionButtons();

        return Promise.resolve(me.fileOptions);
    };


    /**
     * Fetch the document on which we are scraping/digging.
     */
    function getLocDoc(loc) {
        return (
            u.getXhrResponse('GET', loc.href, 'document')
            .then(function processXhrResponse(xhrResponse) {
                return Promise.resolve(u.createLocDoc(loc, xhrResponse));
            })
        );
    }


    /** 
     * Ask the client-script for the active tab's location object, as well as
     * an array of values corresponding to the selector and propName for that tag. 
     * Typically, these selectors and propNames will be some combination of 
     * "img", "a", "src", and "href".
     */ 
    function buildTabMessage(tab) {
        var message = {};

        if (me.contentScriptSelection) {
            var d = Logicker.getMessageDescriptorForUrl(tab.url);
            message.selector = d.selector;
            message.linkHrefProp = d.linkHrefProp;
            message.thumbSrcProp = d.thumbSrcProp;
            message.useRawValues = d.useRawValues;
        }    
        
        var tabMessage = u.createTabMessage(tab, message); 
        return Promise.resolve(tabMessage);
    }


    /** 
     * Do some things with the tab response, resolve with the location.
     */
    function processTabMessageResponse(resp) {
        // Get the locator from the response. Create the downloads directory name.
        var loc = resp.locator;
        me.downloadsDir = getSaltedDirectoryName(loc);

        // Get the Uris. The ContentPeeper makes sure they are *full* uris.
        me.peeperMap = Object.assign({}, resp.galleryMap);

        // Just resolve with the location
        return Promise.resolve(loc);
    }
      

    /**
     * 
     * If we know special things about the site, such as thumb -> zoomedImg mappings
     * or whatnot, we do it here. It also returns a descriptor of options for scraping
     * and digging. 
     */
    function processLocDoc(locDoc) {        
        // If we know special things about the site, such as thumb -> zoomedImg mappings
        // or whatnot, we do it here. It also returns a descriptor of options for scraping
        // and digging.
        var dataDescriptor = Logicker.postProcessResponseData(me.peeperMap, locDoc.loc.href);
        me.galleryMap = dataDescriptor.processedMap;
        me.digOpts.doDig = dataDescriptor.doDig;
        me.digOpts.doScrape = dataDescriptor.doScrape;

        // log the linkHrefs from ContentPeeper.
        // Then, log the thumbSrcs from ContentPeeper.
        var mapSize = Object.getOwnPropertyNames(me.galleryMap).length;
        console.log('[App] Initial processed response has ' + mapSize + ' thumb uris -> zoom link uris.');

        if (locDoc) {
            return Promise.resolve(locDoc);
        }
        else {
            Output.toOut('Could not scrape. Would you try refreshing the page, please?');
            return Promise.reject('[App] Aborting. Received null document object.');
        }       
    }


    /**
     * Retrieve the current tab, ask our client-script for the location object, then
     * call the callback with the XHR'd document object for the tab's url.
     */
    function processContentPage() {
        return (
            u.queryActiveTab()
            .then(buildTabMessage)
            .then(u.sendTabMessage)
            .then(processTabMessageResponse)
            .then(getLocDoc)
            .then(processLocDoc)
        );        
    }


    /**
     * Main entry point of the app for scraping media from the immediate page, and not having
     * any choice over which media gets downloaded. 
     */
    me.scrape = function scrape(options) {
        me.alreadyDownloaded = [];
        me.filesDug = [];
        me.galleryMap = {};
        me.contentScriptSelection = false;
        
        Output.toOut('initializing: collecting urls from page...');
        Output.clearFilesDug();

        // Send the document request, then call the scraper. 
        return (
            processContentPage()
            .then(function doDigging(locDoc) {
                // Just start downloading if we don't want to actually scrape.
                // it means the post-processing found exactly what it needed already.
                if (me.digOpts.doScrape === false) {                    
                    // Only end if we finished. Otherwise, fall back to still scraping.
                    if (me.startDownloading(me.galleryMap)) {
                        console.log('[App] Downloading ContentHelper uris');
                        return Promise.resolve(me.galleryMap);
                    }
                }
                
                // Do the scraping.
                return (
                    Scraper.scrape({
                        node: locDoc.doc, 
                        loc: locDoc.loc, 
                        opts: options,
                    })            
                    .then(me.startDownloading)
                );
            })
            .catch(function onDocRequestError(errorMessage) {
                console.log(errorMessage);
                return Promise.reject(errorMessage);
            })
        );
    };


    /**  
     * Main entry point of the app if the user wants to accept any media found by the Digger's
     * gallery-searching logic without choosing from any options.
     */
    me.digGallery = function digGallery() {
        me.alreadyDownloaded = [];
        me.filesDug = [];
        me.galleryMap = {};
        me.contentScriptSelection = true;
        
        Output.toOut('initializing: collecting URLs from the page...');
        Output.clearFilesDug();

        // get the doc of the tab to dig though. Then let the digger find the gallery. 
        return (
            processContentPage()
            .then(function goDig(locDoc) {
                // Just download from here if all of our linkHrefs should already point directly
                // at a valid imgUrl.
                if ((me.digOpts.doDig === false) && (me.digOpts.doScrape === false)) {
                    if (me.startDownloading(me.galleryMap)) {
                        console.log('[App] Downloading ContentHelper uris');
                        return Promise.resolve(me.galleryMap);
                    }
                    // Scrape and dig anyway if it failed to dl the me.linkHrefs.
                    else {
                        me.digOpts = {
                            doDig: true,
                            doScrape: true
                        };
                    }
                }

                // If we got matching pairs of hrefs and srcs back, set them as the override.
                return Digger.digGallery({
                    doc: locDoc.doc,
                    loc: locDoc.loc,
                    digOpts: me.digOpts,
                    galleryMap: me.galleryMap,
                });
            })
            .then(me.startDownloading)
            .catch(function onDocRequestError(errorMessage) {
                console.log(errorMessage);
                return Promise.reject(errorMessage);
            })
        );
    };


   /**  
     * The main entry point of the app if you want to harvest media items pointed to from
     * galleries, and have them be shown to the user so the user can choose which ones they
     * want. 
     */
    me.digFileOptions = function digFileOptions() {
        me.alreadyDownloaded = [];
        me.filesDug = [];
        me.galleryMap = {};
        me.contentScriptSelection = true;
        
        Output.toOut('initializing: collecting URLs from the page...');
        Output.clearFilesDug();

        // get the doc of the tab to dig though. Then let the digger find the gallery.
        return ( 
            processContentPage()
            .then(function goDig(locDoc) {
                // Just download from here if all of our linkHrefs should already point directly at a valid imgUrl.
                if ((me.digOpts.doDig === false) && (me.digOpts.doScrape === false)) {
                    if (me.startDownloading(me.galleryMap)) {
                        console.log('[App] Downloading ContentHelper uris')                        
                        return Promise.resolve(me.galleryMap);
                    }
                    // Scrape and dig anyway if it failed to dl the me.linkHrefs.                    
                    else {
                        me.digOpts = {
                            doDig: true,
                            doScrape: true
                        };
                    }
                }

                // If we got matching pairs of hrefs and srcs back, set them as the override.
                return Digger.digGallery({
                    doc: locDoc.doc,
                    loc: locDoc.loc,
                    digOpts: me.digOpts,
                    galleryMap: me.galleryMap,
                });
            })
            .then(me.presentFileOptions)
            .catch(function onDocRequestError(errorMessage) {
                console.log(errorMessage);
                return Promise.reject(errorMessage);
            })
        );
    };


    /**
     * A main entry point of the app.
     * Scrape, but do not download automatically. Give the user a list of choices.
     */
    me.scrapeFileOptions = function scrapeFileOptions(options) {
        me.alreadyDownloaded = [];
        me.filesDug = [];
        me.galleryMap = {};
        me.contentScriptSelection = true;
        
        Output.toOut('initializing: collecting urls from page...');
        Output.clearFilesDug();

        // get the doc of the tab to dig though. Then let the digger find the gallery. 
        return (
            processContentPage()
            .then(function goScrape(locDoc) {
                return (
                    Scraper.scrape({
                        node: locDoc.doc, 
                        loc: locDoc.loc, 
                        opts: options,
                    })
                    .then(me.presentFileOptions)
                );
            })
            .catch(function onDocRequestError(errorMessage) {
                console.log(errorMessage);
                return Promise.reject(errorMessage);
            })
        );
    };


    // return the instance.
    return me;
});
