import { default as Utils } from './Utils.js';
import { default as Logicker } from './Logicker.js';
import { default as Output } from './Output.js';
import { default as Digger } from './Digger.js';
import { default as Scraper } from './Scraper.js';
import { default as C } from '../lib/C.js';
import {
    DigOpts, 
    ContentMessage,
    TabMessage,
    LocDoc,
    FileOption,
    GalleryOptions,
    ScrapeOptions,
    Storing,
    Log,
} from '../lib/DataClasses.js'
 


/**
 * Class for the main "Application" backend of Gimme.
 */
class App {
    // vars for our background object instances.
    output = undefined;
    digger = undefined;
    scraper = undefined;
    log = new Log(C.LOG_SRC.APP);

    // Vars for harvested URIs.
    galleryMap = {};
    peeperMap = {};
    alreadyDownloaded = {};
    fileOptions = [];
    filesDug = [];

    // Configuration vars.
    digOpts = new DigOpts(true, true);
    contentScriptSelection = true;
    diggingGalleryGallery = false;
    downloadsDir = C.F_NAMING.DOWNLOADS_DIR;
    stop = false;


    /** 
     * Constructor for App.
     */
    constructor(aDigger, aScraper) {
        this.output = window[C.WIN_PROP.OUTPUT_CLASS].getInstance();
        this.digger = aDigger;
        this.scraper = aScraper;
        
        /** 
        * Ask the client-script for the active tab's location object, as well as
        * an array of values corresponding to the selector and propName for that tag. 
        * Typically, these selectors and propNames will be some combination of 
        * "img", "a", "src", and "href".
        */ 
        this.buildTabMessage = (tab) => {
           var message = {};
   
           if (this.contentScriptSelection) {
               var d = Logicker.getMessageDescriptorForUrl(tab.url);
               message = Object.assign({}, d);
           }
           else if (this.diggingGalleryGallery) {
               message = new ContentMessage();
           }
                   
           var tabMessage = new TabMessage(tab, message); 
           return Promise.resolve(tabMessage);
       };
   

       /** 
        * Do some things with the tab response, resolve with the location.
        */
        var domParser = new DOMParser();
        this.processTabMessageResponse = (resp) => {
            // Get the locator from the response. Create the downloads directory name.
            var loc = resp.locator;
            this.downloadsDir = Utils.getSaltedDirectoryName(loc);

            // Get the Uris. The ContentPeeper makes sure they are *full* uris.
            this.peeperMap = Object.assign({}, resp.galleryMap);

            // Create our own copy of the document we're looking at.
            var peeperDoc = domParser.parseFromString(resp.docOuterHml, C.DOC_TYPE.HTML);
            
            // Fallback to getting the document via XHR if we have to. (worse, because scripts will not have run.)
            if (!peeperDoc || !resp.docOuterHml) {
                return this.getLocDoc(loc);
            }
            else {
                return Promise.resolve(new LocDoc(loc, peeperDoc));
            }
        };


        /**
         * 
         * If we know special things about the site, such as thumb -> zoomedImg mappings
         * or whatnot, we do it here. It also returns a descriptor of options for scraping
         * and digging. 
         */
        this.processLocDoc = (locDoc) => {        
            // If we know special things about the site, such as thumb -> zoomedImg mappings
            // or whatnot, we do it here. It also returns a descriptor of options for scraping
            // and digging.
            var dataDescriptor = Logicker.postProcessResponseData(this.peeperMap, locDoc.loc.href);
            this.galleryMap = dataDescriptor.processedMap;
            this.digOpts.doDig = dataDescriptor.doDig;
            this.digOpts.doScrape = dataDescriptor.doScrape;

            this.log.log('Processed LocDoc with digOpts: ' + JSON.stringify(this.digOpts));

            // But make it do everything if it came back as 0.
            if (Object.keys(this.galleryMap).length === 0) {
                this.digOpts = new DigOpts(true, true);
            }

            // log the linkHrefs from ContentPeeper.
            // Then, log the thumbSrcs from ContentPeeper.
            var mapSize = Object.getOwnPropertyNames(this.galleryMap).length;
            this.log.log('Initial processed response has ' + mapSize + ' thumb uris -> zoom link uris.');

            if (!!locDoc && !!locDoc.loc && !!locDoc.doc) {
                return Promise.resolve(locDoc);
            }
            else {
                this.output.toOut('Could not scrape. Would you try refreshing the page, please?');
                return Promise.reject('[App] Aborting. Received null document object.');
            }       
        };


        /**
         * Give the user a list of media that was found, with checkboxes next to thumbnail images and
         * their filenames. Download based upon their preference and interaction.
         * 
         * Note: This also sets the all-combined harvestedMap as a new object for me.galleryMap,
         *       but first it removes from the harvestedMap.
         */
        this.presentFileOptions = (harvestedMap) => {
            if (!harvestedMap) {
                this.log.log('called with null harvestedMap.');
                return Promise.resolve([]);
            }
            
            var thumbUris = Object.keys(harvestedMap);
            var length = thumbUris.length;

            if (length < 1) {
                this.log.log('No files to download.');
                this.output.toOut('No URLs to download.');            
            }
            
            this.log.log('Count of files to download: ' + length);
            this.output.toOut('Click on the files in the list to download them.');
            this.output.clearFilesDug();

            var fileOptionzzz = [];

            // Set up the download options for each of the uris returned.
            for (var thumbUri in harvestedMap) {
                var uri = harvestedMap[thumbUri];

                if (!uri || !uri.replace || uri.indexOf(C.ST.DOT) === 0) {
                    this.log.log('Bad uri string for download: ' + JSON.stringify(uri));
                    delete harvestedMap[thumbUri];
                    continue;
                }
                else if (/.+?\.html.+?/i.test(uri)) {
                    this.log.log('Rejecting uri string for download: ' + JSON.stringify(uri));
                    delete harvestedMap[thumbUri];
                    continue;
                }

                // take the querystring off just to make the destSrc. We need it when downloading, however.
                var uriWithoutQs = uri.replace(/\?(.+?)$/, C.ST.E);
                var destFileName = uriWithoutQs.replace(/^.+\//, C.ST.E);

                // For data-returning php files. (they really exist a fair amount)
                if (/\/.+?.php\?/.test(uri)) {
                    destFileName = destFileName + '.jpg';
                }
                // For weird filenames with parentheses in them.
                if (/^\(.*\)/.test(destFileName)) {
                    destFileName = destFileName.replace(/^\(.*\)/, C.ST.E);
                }

                // Set up the FileOption entries, one for every pair in the harvestedMap, which later 
                // will be turned into FileEntry objects and displayed.
                var destFilePath = this.downloadsDir + C.ST.WHACK + destFileName;
                var optIdx = this.fileOptions.push(destFilePath);
                var fileOption = new FileOption(optIdx+C.ST.E, uri, thumbUri, destFilePath, Utils.downloadFile);

                this.output.addFileOption(fileOption);
                fileOptionzzz.push(fileOption);
            }
            
            // Assign a new cloned object of harvestedMap on this.galleryMap. It is done
            // this way so that there are no references shared between galleryMap and harvestedMap.
            this.galleryMap = Object.assign({}, harvestedMap);

            chrome.browserAction.setBadgeText({ text: C.ST.E + this.fileOptions.length + C.ST.E });
            chrome.browserAction.setBadgeBackgroundColor(C.COLOR.AVAILABLE_FOPTS);

            this.log.log('Presented ' + this.fileOptions.length + ' file options.');
            this.output.toOut('Please select which of the ' + this.fileOptions.length + ' files you would like to download.');
            this.output.showActionButtons();
            Utils.resetDownloader();

            return Promise.resolve(fileOptionzzz);
        }
    }
    
    /**
     * Once we have the dug uris from the response, this callback downloads them.
     */
    startDownloading(harvestedMap) {
        var me = this;
        var length = Object.keys(harvestedMap).length;   
             
        if (!!this) {
            this.galleryMap = harvestedMap;
        }

        this.digger.redrawOutputFileOpts(harvestedMap);

        if (!harvestedMap || length < 1) {
            this.log.log('No files to download.');
            this.output.toOut('No URLs to download.');
        }
        else {
            this.log.log('Downloading ' + length + ' files.')
            this.output.toOut(C.ST.E + length + ' Downloading!');
        }

        console.log('STARTING ZIP DOWNLOAD')
        Utils.downloadInZip(harvestedMap.values()).then(() => {
            for (var index = 0; index < harvestedMap.values(); index++) {
                me.output.setEntryAsDownloading(index);
            };
        });

        return Promise.resolve([]);
    }
    

    /**
     * Fetch the document on which we are scraping/digging.
     * Please note, no <script>s will be run, so it's only the base html, and often not useful.
     */
    getLocDoc(loc) {
        return (
            Utils.getXhrResponse(C.ACTION.GET, loc.href, C.DOC_TYPE.DOC)
            .then((xhrResponse) =>{
                return Promise.resolve(new LocDoc(loc, xhrResponse));
            })
        );
    }


    /**
     * Retrieve the current tab, ask our client-script for the location object, then
     * call the callback with the XHR'd document object for the tab's url.
     */
    processContentPage() {
        return (
            Utils.queryActiveTab()
                .then((tab) => { 
                    return this.buildTabMessage(tab); 
                })
                .then((tabMesssage) => {
                    return Utils.sendTabMessage(tabMesssage);
                })
                .then((resp) => {
                    return this.processTabMessageResponse(resp);
                })
                .then((locDoc) => {
                    return this.processLocDoc(locDoc);
                })
        );        
    }


    /**
     * Clear the file tracking data in preparation for a new scrape or dig operation.
     */
    clearGalleryData(contentScriptSelection) {        
        this.alreadyDownloaded = {};
        this.filesDug = [];
        this.galleryMap = {};
        this.contentScriptSelection = contentScriptSelection;
        this.output.clearFilesDug();    
        Utils.resetDownloader();            
    }


    /**
     * Do the setup needed for a clean scrape or dig.
     * 
     * @param {bool} clearGalleryItems 
     * @param {Action} action 
     */
    setupProcess(action, clearGalleryItems, text) {
        this.output.showStopButton();
        this.output.toOut(text);        
        this.clearGalleryData(true);

        this.output.setIsDigging(
            (action === C.ACTION.DIG || action === C.ACTION.DIG_GG)
        );
        this.output.setIsScraping(
            (action === C.ACTION.SCRAPE)
        );
        this.diggingGalleryGallery = (action === C.ACTION.DIG_GG);
    }

    /**
     * Main entry point of the app for scraping media from the immediate page, and not having
     * any choice over which media gets downloaded. 
     */
    scrape(options) {
        this.setupProcess(C.ACTION.SCRAPE, false, 'Initializing: Collecting uris from page.');
        var me = this;        

        // Begin by communicating with the ContentPeeper for information 
        // about the target page. Then either use the ContentPeeper's processed
        // galleryMap or the one from the Scraper in order to download immediately.
        // No user choice on what to download.
        return (
            this.processContentPage()
            .then((locDoc) => {
                // Based upon the Logicker's special rules for sites, either just
                // resolve with the ContentPeeper's processed uri info, or do a scrape.
                if (me.digOpts.doScrape === false) {
                    me.digger.redrawOutputFileOpts(me.galleryMap);                    
                    this.log.log('Downloading ContentPeeper uris, not scraping.');
                    return Promise.resolve(me.galleryMap);
                }
                else {
                    this.log.log('Performing scrape.')
                    return (
                        new ScrapeOptions(locDoc.doc, locDoc.loc, options)
                    );
                }
            })
            .then(me.startDownloading)            
            .catch((errorMessage) => {
                me.output.toOut('There was an internal error. Please try refreshing the page.');
                console.log(errorMessage);
                return Promise.reject(errorMessage);
            })
            .finally(() => {
                chrome.storage.local.set(
                    Storing.storePrevUriMap(me.galleryMap),
                    () => {
                        this.log.log('Set prevUriMap in storage');
                        this.log.log('--- harvest is of count -> ' + Object.keys(me.galleryMap).length + '------');
                    }
                );
                
                me.output.setIsScraping(false);
            })
        );
    }


    /**
     * A main entry point of the app.
     * Scrape, but do not download automatically. Give the user a list of choices.
     */
    scrapeFileOptions(options) {
        this.setupProcess(C.ACTION.SCRAPE, true, 'Initializing: Collecting uris from page.');
        var me = this;

        // Begin by communicating with the ContentPeeper for information 
        // about the target page. Then use the Scraper to form a galleryMap
        // of its findings, and present the user with options of what to download.
        //
        // NOTE: this ALWAYS scrapes anew. opts.doScraping=false only means to rely on 
        //       ContentPeeper for building a dig gallery map. Scrapes always want alllll
        //       the images on the page, not just gallery thumbs.
        return (
            me.processContentPage()
            .then((locDoc) => {
                this.log.log('Scraping with the this.scraper.');
                return me.scraper.scrape(
                    new ScrapeOptions(locDoc.doc, locDoc.loc, options)
                );
            })
            .then(me.presentFileOptions)            
            .catch((errorMessage) => {
                me.output.toOut('There was an internal error. Please try refreshing the page.');
                console.log(errorMessage);
                return Promise.reject(errorMessage);
            })
            .finally(() => {
                chrome.storage.local.set(
                    Storing.storePrevUriMap(me.galleryMap),
                    () => {
                        this.log.log('Set prevUriMap in storage');
                        this.log.log('--- harvest is of count -> ' + Object.keys(me.galleryMap).length + '------');
                    }
                );

                me.output.setIsScraping(false);
            })
        );
    };


    /**  
     * Main entry point of the app if the user wants to accept any media found by the Digger's
     * gallery-searching logic without choosing from any options.
     */
    digGallery() {
        this.setupProcess(C.ACTION.DIG, true, 'Initializing: Collecting gallery uris from page.');
        var me = this;     
        
        // Begin by communicating with the ContentPeeper for information 
        // about the target page. Then immediately start downloading
        // with either the galleryMap from the ContentPeeper, or from the this.digger.
        // No user choice in what to download.         
        return (
            this.processContentPage()
            .then((locDoc) => {
                // Based upon the Logicker's special rules for sites, either just
                // resolve with the ContentPeeper's processed uri info, or do the dig.
                if ((me.digOpts.doDig === false) && (me.digOpts.doScrape === false)) {
                    me.digger.redrawOutputFileOpts(me.galleryMap);
                    
                    this.log.log('Downloading ContentPeeper uris');
                    return Promise.resolve(me.galleryMap);
                }
                else {
                    this.log.log('Performing gallery dig.')               
                    return this.digger.digGallery(
                        new GalleryOptions(locDoc.doc, locDoc.loc, me.digOpts, me.galleryMap)
                    );
                }
            })
            .then(me.startDownloading)
            .catch((errorMessage) => {
                me.output.toOut('There was an internal error. Please try refreshing the page.');
                
                console.log(errorMessage);
                return Promise.reject(errorMessage);
            })
            .finally(() => {
                chrome.storage.local.set({
                        prevUriMap: me.galleryMap,
                    },
                    () => {
                        this.log.log('Set prevUriMap in storage');
                        this.log.log('--- harvest is of count -> ' + Object.keys(me.galleryMap).length + '------');
                    }
                );

                me.output.setIsDigging(false);     
            })
        );
    }


   /**  
     * The main entry point of the app if you want to harvest media items pointed to from
     * galleries, and have them be shown to the user so the user can choose which ones they
     * want. 
     */
    digFileOptions() {
        this.setupProcess(C.ACTION.DIG, true, 'Initializing: Collecting gallery uris from page.');
        var me = this;        
 
        // Begin by communicating with the ContentPeeper for information 
        // about the target page. Then present the user with choices on what to download,
        // with either the galleryMap from the ContentPeeper, or from the this.digger.
        return (
            this.processContentPage()
            .then((locDoc) => {
                // Just download from here if all of our linkHrefs should already point directly at a valid imgUrl.
                if ((me.digOpts.doDig === false) && (me.digOpts.doScrape === false)) {
                    me.digger.redrawOutputFileOpts(me.galleryMap);

                    this.log.log('Downloading ContentHelper uris');
                    
                    chrome.storage.local.set(
                        Storing.storePrevUriMap(me.galleryMap),
                        () => {
                            this.log.log('Setting prevUriMap');
                        }
                    );
                    return Promise.resolve(me.galleryMap);
                }
                else {
                    return me.digger.digGallery(
                        new GalleryOptions(locDoc.doc, locDoc.loc, me.digOpts, me.galleryMap)
                    );                      
                }
            })
            .then((harvestedMap) => {
                return me.presentFileOptions(harvestedMap);
            })
            .catch((errorMessage) => {
                me.output.toOut('There was an internal error. Please try refreshing the page.');
                console.log(errorMessage);
                return Promise.reject(errorMessage);
            })
            .finally(() => {
                chrome.storage.local.set(
                    Storing.storePrevUriMap(me.galleryMap),
                    () => {
                        this.log.log('Set prevUriMap in storage');
                        this.log.log('--- harvest is of count -> ' + Object.keys(me.galleryMap).length + '------');
                    }
                );

                me.output.setIsDigging(false);     
            })
        );
    };


     /**  
     * The main entry point of the app if you want to harvest media items in galleries which
     * are themselves on a page that is a gallery. Show retuslts to the user so the user can 
     * choose which ones they want. 
     */
    digGalleryGallery() {
        this.setupProcess(C.ACTION.DIG_GG, false, 'Initializing: Collecting uris to galleries from page.');
        
        var locDocs = [];
        var combinedMap = {};
        var me = this; 

        // Begin by communicating with the ContentPeeper for information 
        // about the target page. Then present the user with choices on what to download,
        // with either the galleryMap from the ContentPeeper, or from the this.digger.
        return ( 
            this.processContentPage()
            .then((locDoc) => {
                return me.digger.digGallery(
                    new GalleryOptions(locDoc.doc, locDoc.loc, new DigOpts(true, false), Object.assign({}, me.peeperMap))
                );
            })
            .then((mapOfGalleryLinks) => {
                var p = Promise.resolve(true);

                // make a simple chain of XHRs fetching the linked-to gallery pages
                var galleryCount = 0;
                Object.values(mapOfGalleryLinks).forEach((uri) => { 
                    if (!!uri && !!uri.trim()) {                   
                        p = p.then(() => { 
                            return Utils.getXhrResponse(C.ACTION.GET, uri, C.DOC_TYPE.DOC)
                            .then((d) => {
                                if (me.stop) { 
                                    return Promise.reject(C.ACTION.STOP); 
                                };

                                this.log.log('Executed load of gallery page ' + uri);
                                me.output.toOut('Loading gallery page ' + uri);
                                
                                chrome.browserAction.setBadgeText({ text: (C.ST.E + (++galleryCount) + C.ST.E) });
                                chrome.browserAction.setBadgeBackgroundColor(C.COLOR.NEW_FOPTS);

                                locDocs.push(new LocDoc(new URL(uri), d));

                                return Promise.resolve(true);
                            }).catch((e) => {
                                if (e === C.ACTION.STOP) {
                                    this.log.log('Stop was called. Stopping digging operations.');
                                    this.output.toOut('Stopping...');

                                    return Promise.reject(false);
                                }
                                this.log.log('Failed to load gallery doc ' + uri)
                                console.log('      Error: ' + e);
                                
                                me.output.toOut('Failed to load gallery page ' + uri);
                                galleryCount--;

                                return Promise.resolve(true);
                            });
                        });
                    }
                });

                // This is a promise chain of operations to load the gallery pages
                // with XRHs. It always resolves, so the promises that do have successful
                // fetches keep going. Only the STOP command rejects.
                return p;
            })
            .then(() => {
                var p = Promise.resolve(true);

                // Using the locDocs collected for each gallery page that is linked to from the
                // gallery-gallery-page. Use them to create a promise chain of digGallery(...)
                // calls on each locDoc. 
                locDocs.forEach((lDoc) => {
                    if (me.stop === true) { 
                        p = Promise.reject(STOP); 
                        return p; 
                    };

                    this.log.log('creating dig promise for ' + lDoc.loc.href);
                    me.output.toOut('Beginning dig for ' + lDoc.loc.href);

                    // Build the promise chain of digging all the galleries linked to from the
                    // gallery-gallery-page. First we call digGallery in scrape-only mode to 
                    // get us a starting harvested gallery map. Then we do a scrape+dig (normally)
                    // unless the Logicker's special rules invalidate doScrape or doDig. That
                    // resolves with digGallery(...) harvested map, which we add to the combined map 
                    // at the end.
                    p = p.then(() => {
                        return me.digger.digGallery(
                            new GalleryOptions(lDoc.doc, lDoc.loc, new DigOpts(true, false), {})
                        )
                        .then((harvestedMap) => {
                            this.log.log('Received initial gallery map length: ' + Object.getOwnPropertyNames(harvestedMap).length + C.ST.E);
                            this.log.log('Applying post-processing to: ' + lDoc.loc.href);
                            var inst = Logicker.postProcessResponseData(harvestedMap, lDoc.loc.href);

                            return me.digger.digGallery(
                                new GalleryOptions(lDoc.doc, lDoc.loc, new DigOpts(inst.doScrape, inst.doDig), inst.processedMap)
                            );
                        })
                        .then((gMap) => {
                            me.output.toOut('Received file list for ' + lDoc.loc.href);
                            this.log.log('Received ' + Object.getOwnPropertyNames(gMap).length + C.ST.E);
                            Object.assign(combinedMap, gMap);
                            
                            if (this.stop === true) {
                                return Promise.reject(C.ACTION.STOP)
                            }
                            else {
                                return Promise.resolve(true);
                            }
                        });
                    });
                });

                // This is a promise chain of scraping, digging, and combining all the galleries'
                // harvested thumbUri -> zoomUri maps into "combinedMap";
                return p;
            })
            .then(() => {
                if (this.stop === true) {
                    return Promise.reject(C.ACTION.STOP);
                }

                // Taking the combined gallery maps, Make FileOpts for them. Then we resolve with the combined
                // map, which takes those  FileOpts and makes FileEntry (checkbox and thumbnail) objects for
                // them, and presentFileOptions(...) shows all the FileEntry objects.
                me.digger.redrawOutputFileOpts(combinedMap);
                this.log.log('Received combinedMap.');
                me.output.toOut('Received file list of length: ' + Object.keys(combinedMap).length);

                return Promise.resolve(combinedMap); 
            })
            .then(me.presentFileOptions)
            .catch((errorMessage) => {
                // See if we're being asked to stop.
                if (errorMessage === C.ACTION.STOP) {
                    console.log("[App] Stop was called.")
                    me.presentFileOptions(me.galleryMap);
                    return Promise.resolve(true);
                }
                else {
                    me.output.toOut('There was an internal error. Please try refreshing the page.');
                    console.log('[App]: ' + errorMessage);
                    return Promise.reject(errorMessage);
                }
            })
            .finally(() => {
                chrome.storage.local.set(
                    Storing.storePrevUriMap(me.galleryMap),
                    () => {
                        this.log.log('Set prevUriMap in storage');
                        this.log.log('--- harvest is of count -> ' + Object.keys(me.galleryMap).length + '------');
                    }
                );

                me.diggingGalleryGallery = false;
                me.output.setIsDigging(false);
                me.output.setIsScraping(false);
            })
        );
    };


    /**
     * Tell the scraper and the digger to stop harvesting immediately and just resolve with what
     * they've already found.
     */
    stopHarvesting() {
        this.stop = true;

        if (!!this.scraper) {
            this.scraper.stopHarvesting();
        }

        if (!!this.digger) {
            this.digger.stopHarvesting();
        }

        if (!!this.output) {
            this.output.setIsScraping(false);
            this.output.setIsDigging(false);
        }
    };
}

// Set the class on the window, just in case.
if (!window.hasOwnProperty(C.WIN_PROP.APP_CLASS) && Utils.isBackgroundPage(window)) {
    window[C.WIN_PROP.APP_CLASS] = App;
}

// export.
export default App;
    
