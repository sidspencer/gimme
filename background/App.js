'use strict'

/**
 * Factory function for the main "Application" backend of Gimme.
 */
var App = (function App(Output, Digger, Scraper, Logicker, Utils) {
    var me = {
        galleryMap: {},
        peeperMap: {},
        peeperDoc: null,
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

    // These are the default spec values, used if there is nothing in storage yet.
    var DEFAULT_SPEC = {
        config: {
            minZoomWidth: '300',
            minZoomHeight: '300',
            dlChannels: '3',
            dlBatchSize: '5',
        },
        messages: [],
        processings: [],
        blessings: [],
    };


    /**
     Read storage for the spec json.
     */
    function readSpec() {
        chrome.storage.sync.get({
                spec: DEFAULT_SPEC
            }, 
            function storageRetrieved(store) {
                setOptConfig(store.spec.config);
                setOptMessages(store.spec.messages);
                setOptProcessings(store.spec.processings);
                setOptBlessings(store.spec.blessings);
            }
        );  
    }
    

    /**
     * Set the general configuration values from the Options page.
     * Currently this is the min dimensions for a zoom image, and
     * download performance tuning of the channels and batch size.
     */
    function setOptConfig(config) {
        if (!config) {
            return;
        }

        // Set the download channels / batch-sizes for doing digs.
        Digger.BATCH_SIZE = config.dlBatchSize;
        Digger.CHANNELS = config.dlChannels;

        // Set minimum dimensions for something to be considered a Zoom item.
        Logicker.MIN_ZOOM_HEIGHT = config.minZoomHeight;
        Logicker.MIN_ZOOM_WIDTH = config.minZoomWidth;
    }


    /**
     * Set up the mappings for special instructions on finding galleries through pre-discovered
     * CSS selectors, and set up on the Options page. 
     */
    function setOptMessages(messages) {
        if (!messages) {
            return;
        }

        Logicker.messages = messages;
    }


    /**
     * Set up processing hints for digging and scraping of matched uris.
     */
    function setOptProcessings(processings) {
        if (!processings) {
            return;
        }

        Logicker.processings = processings;
    }


    /**
     * 
     */
    function setOptBlessings(blessings) {
        if (!blessings) {
            return;
        }

        Logicker.blessings = blessings;
    }


    /**
     * Download a single uri to the filename (well, path) provided.
     */
    function downloadFile(uri, destFilename) {
        // If it's a PHP file, guess and give it a .jpg.
        if (!/\.(jpg|jpeg|png|gif|tiff)$/i.test(destFilename)) {
            destFilename = destFilename + '.jpg'
        }

        // Ugly hack to make it work with google images.
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

        console.log('STARTING DOWNLOAD')
        u.downloadInZip(harvestedMap.values()).then(function() {
            for (var index = 0; index < harvestedMap.values(); index++) {
                Output.setEntryAsDownloading(index);
            };
        });
        return Promise.resolve([]);

        // /////////////////////////////////////

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
            console.log('[App] called with null harvestedMap.');
            return Promise.resolve([]);
        }
        
        var thumbUris = Object.keys(harvestedMap);
        var length = thumbUris.length;

        if (length < 1) {
            console.log('[App] No files to download.');
            Output.toOut('No URLs to download.');            
        }
        
        console.log('[App] Count of files to download: ' + length);
        Output.toOut('Click on the files in the list to download them.');
        Output.clearFilesDug();

        var fileOptionzzz = [];

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

            // For data-returning php files.
            if (/\/.+?.php\?/.test(uri)) {
                destFileName = destFileName + '.jpg';
            }
            // For weird filenames with parentheses in them.
            if (/^\(.*\)/.test(destFileName)) {
                destFileName = destFileName.replace(/^\(.*\)/, '');
            }

            var destFilePath = me.downloadsDir + '/' + destFileName;
            var optIdx = me.fileOptions.push(destFilePath);
            var fileOption = u.createFileOption(optIdx, uri, thumbUri, destFilePath, downloadFile);

            Output.addFileOption(fileOption);
            fileOptionzzz.push(fileOption);
        }

        chrome.browserAction.setBadgeText({ text: '' + me.fileOptions.length + '' });
        chrome.browserAction.setBadgeBackgroundColor({ color: [247, 81, 158, 255] });

        console.log('[App] Presented ' + me.fileOptions.length + ' file options.');
        Output.toOut('Please select which of the ' + me.fileOptions.length + ' files you would like to download.');
        Output.showActionButtons();

        return Promise.resolve(fileOptionzzz);
    };


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
            Object.assign(message, d);
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

        // Create our own copy of the document we're looking at.
        var peeperDoc = chrome.extension.getBackgroundPage().document.implementation.createHTMLDocument("peeperdoc");
        peeperDoc.documentElement.innerHTML = resp.docInnerHtml;

        // Fallback to getting the document via XHR if we have to. (worse, because scripts will not have run.)
        if (!peeperDoc || !resp.docInnerHtml) {
            return getLocDoc(loc);
        }
        else {
            return Promise.resolve(u.createLocDoc(loc, peeperDoc));
        }
    }
      

    /**
     * Fetch the document on which we are scraping/digging.
     * Please note, no <script>s will be run, so it's only the base html, and often not useful.
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

        console.log('[App] Processed LocDoc with digOpts: ' + JSON.stringify(me.digOpts));

        // But make it do everything if it came back as 0.
        if (Object.keys(me.galleryMap).length === 0) {
            me.digOpts.doDig = true;
            me.digOpts.doScrape = true;
        }

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
            .then(processLocDoc)
        );        
    }


    /**
     * Clear the file tracking data in preparation for a new scrape or dig operation.
     */
    function clearGalleryData(contentScriptSelection) {        
        me.alreadyDownloaded = {};
        me.filesDug = [];
        me.galleryMap = {};
        me.contentScriptSelection = contentScriptSelection;
        Output.clearFilesDug();                
    }


    /**
     * Main entry point of the app for scraping media from the immediate page, and not having
     * any choice over which media gets downloaded. 
     */
    me.scrape = function scrape(options) {
        Output.toOut('Initializing: Collecting uris from page.');        
        clearGalleryData(false);        

        // Begin by communicating with the ContentPeeper for information 
        // about the target page. Then either use the ContentPeeper's processed
        // galleryMap or the one from the Scraper in order to download immediately.
        // No user choice on what to download.
        return (
            processContentPage()
            .then(function doScraping(locDoc) {
                // Based upon the Logicker's special rules for sites, either just
                // resolve with the ContentPeeper's processed uri info, or do a scrape.
                if (me.digOpts.doScrape === false) {                    
                    console.log('[App] Downloading ContentPeeper uris, not scraping.');
                    return Promise.resolve(me.galleryMap);
                }
                else {
                    console.log('[App] Performing scrape.')
                    return (Scraper.scrape({
                            node: locDoc.doc, 
                            loc: locDoc.loc, 
                            opts: options
                        })
                    );
                }
            })
            .then(me.startDownloading)            
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
        Output.toOut('Initializing: Collecting uris from page.');        
        clearGalleryData(true);  

        // Begin by communicating with the ContentPeeper for information 
        // about the target page. Then use the Scraper to form a galleryMap
        // of its findings, and present the user with options of what to download.
        return (
            processContentPage()
            .then(function doScraping(locDoc) {
                if (me.digOpts.doScrape === false) {
                    console.log('[App] Downloading ContentPeeper uris, not scraping.');
                    return Promise.resolve(me.galleryMap);
                }
                else {
                    console.log('[App] Scraping with the Scraper.')
                    return Scraper.scrape({
                        node: locDoc.doc, 
                        loc: locDoc.loc, 
                        opts: options,
                    });
                }
            })
            .then(me.presentFileOptions)            
            .catch(function handleError(errorMessage) {
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
        Output.toOut('Initializing: Collecting uris from page.');        
        clearGalleryData(true);     
        
        // Begin by communicating with the ContentPeeper for information 
        // about the target page. Then immediately start downloading
        // with either the galleryMap from the ContentPeeper, or from the Digger.
        // No user choice in what to download.         
        return (
            processContentPage()
            .then(function goDig(locDoc) {
                // Based upon the Logicker's special rules for sites, either just
                // resolve with the ContentPeeper's processed uri info, or do the dig.
                if ((me.digOpts.doDig === false) && (me.digOpts.doScrape === false)) {
                    console.log('[App] Downloading ContentPeeper uris');
                    return Promise.resolve(me.galleryMap);
                }
                else {
                    console.log('[App] Performing gallery dig.')               
                    return Digger.digGallery({
                        doc: locDoc.doc,
                        loc: locDoc.loc,
                        digOpts: me.digOpts,
                        galleryMap: me.galleryMap,
                    })
                }
            })
            .then(me.startDownloading)
            .catch(function handleError(errorMessage) {
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
        Output.toOut('Initializing: Collecting uris from page.');        
        clearGalleryData(true);     
 
        // Begin by communicating with the ContentPeeper for information 
        // about the target page. Then present the user with choices on what to download,
        // with either the galleryMap from the ContentPeeper, or from the Digger.
        return ( 
            processContentPage()
            .then(function goDig(locDoc) {
                // Just download from here if all of our linkHrefs should already point directly at a valid imgUrl.
                if ((me.digOpts.doDig === false) && (me.digOpts.doScrape === false)) {
                    console.log('[App] Downloading ContentHelper uris');
                    
                    chrome.storage.local.set({
                            prevUriMap: me.galleryMap
                        },
                        function() {
                            console.log('[App] Setting prevUriMap');
                        }
                    );
                    return Promise.resolve(me.galleryMap);
                }
                else {
                    return Digger.digGallery({
                        doc: locDoc.doc,
                        loc: locDoc.loc,
                        digOpts: me.digOpts,
                        galleryMap: me.galleryMap,
                    });
                }
            })
            .then(me.presentFileOptions)
            .catch(function handleError(errorMessage) {
                console.log(errorMessage);
                return Promise.reject(errorMessage);
            })
        );
    };


     /**  
     * The main entry point of the app if you want to harvest media items in galleries which
     * are themselves on a page that is a gallery. Show retuslts to the user so the user can 
     * choose which ones they want. 
     */
    me.digGalleryGallery = function digGalleryGallery() {
        Output.toOut('Initializing: Collecting links to galleries from page.');        
        clearGalleryData(true);
        var locDocs = [];
        var combinedMap = {}; 

        // Begin by communicating with the ContentPeeper for information 
        // about the target page. Then present the user with choices on what to download,
        // with either the galleryMap from the ContentPeeper, or from the Digger.
        return ( 
            processContentPage()
            .then(function buildPromises(locDoc) {
                return Digger.digGallery({
                    doc: locDoc.doc,
                    loc: locDoc.loc,
                    digOpts: { doScrape: true, doDig: false },
                    galleryMap: {},
                })
            })
            .then(function(mapOfGalleryLinks) {
                var p = Promise.resolve(true);

                // make a simple chain of 
                var id = 0;
                
                Object.values(mapOfGalleryLinks).forEach(function(uri) { 
                    if (!!uri && !!uri.trim()) {                   
                        p = p.then(function() { 
                            return u.getXhrResponse('GET', uri, 'document')
                            .then(function pushDoc(d) {
                                console.log('[App] Executed load of gallery page ' + uri);
                                Output.toOut('Loading gallery page ' + uri);

                                locDocs.push({
                                    loc: new URL(uri),
                                    doc: d,
                                });
                                return Promise.resolve(true);
                            }).catch(function(e) {
                                console.log('[App] Failed to load gallery doc ' + uri)
                                console.log('      Error: ' + e);
                                Output.toOut('Failed to load gallery page ' + uri);

                                return Promise.resolve(true);
                            });
                        });
                    }
                });

                return p;
            })
            .then(function docsLoaded() {
                var promises = [];
                var p = Promise.resolve(true);


                locDocs.forEach(function(lDoc) {
                    console.log('[App] creating dig promise for ' + lDoc.loc.href);
                    Output.toOut('Beginning dig for ' + lDoc.loc.href);

                    p = p.then(function() {
                        return Digger.digGallery({
                            doc: lDoc.doc,
                            loc: lDoc.loc,
                            digOpts: me.digOpts,
                            galleryMap: {},
                        })
                        .then(function receiveGalleryMap(gMap) {
                            Output.toOut('Received file list for ' + lDoc.loc.href);

                            console.log('[App] Received ' + Object.getOwnPropertyNames(gMap).length + '');
                            console.log('[App] Applying post-processing to: ' + lDoc.loc.href);
                            var instructions = Logicker.postProcessResponseData(gMap, lDoc.loc.href);

                            Object.assign(combinedMap, instructions.processedMap);
                            
                            return Promise.resolve(true);
                        });
                    });
                });

                return p;
            })
            .then(function() {
                console.log('[App] Received combinedMap.');
                Output.toOut('Received file list of length: ' + Object.keys(combinedMap).length);

                return Promise.resolve(combinedMap); 
            })
            .then(me.presentFileOptions)
            .catch(function handleError(errorMessage) {
                console.log(errorMessage);
                Output.toOut('Failed to get file lists');

                return Promise.reject(errorMessage);
            })
        );
    };


    // read the options spec.
    setTimeout(function() {
        readSpec();
    });

    // return the instance.
    return me;
});
