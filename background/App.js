import { default as Utils } from './Utils.js';
import { default as Logicker } from './Logicker.js';
import { default as Output } from './Output.js';
import { default as Digger } from './Digger.js';
import { default as Scraper } from './Scraper.js';

/**
 * Factory function for the main "Application" backend of Gimme.
 */
class App {
    constructor(output, digger, scraper, Logicker, Utils) {
        this.u = Utils;
        this.output = output;
        this.digger = digger;
        this.scraper = scraper;

        this.galleryMap = {};
        this.peeperMap = {};
        this.downloadsDir = 'Gimme-site_pagename-tmp';
        this.digOpts = {
            doScrape: true,
            doDig: true,
        };
        this.alreadyDownloaded = {};
        this.fileOptions = [];
        this.filesDug = [];
        this.contentScriptSelection = true;
        this.diggingGalleryGallery = false;


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
               message = {
                   command: 'peepAround',
                   linkSelector: 'a[href]',
                   linkHrefProp: 'href',
                   thumbSubselector: ':scope img',
                   thumbSrcProp: 'src',
                   useRawValues: false,
               };    
           }
                   
           var tabMessage = this.u.createTabMessage(tab, message); 
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
            var peeperDoc = domParser.parseFromString(resp.docInnerHtml, "text/html");
            
            // Fallback to getting the document via XHR if we have to. (worse, because scripts will not have run.)
            if (!peeperDoc || !resp.docInnerHtml) {
                return getLocDoc(loc);
            }
            else {
                return Promise.resolve(Utils.createLocDoc(loc, peeperDoc));
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

            console.log('[App] Processed LocDoc with digOpts: ' + JSON.stringify(this.digOpts));

            // But make it do everything if it came back as 0.
            if (Object.keys(this.galleryMap).length === 0) {
                this.digOpts.doDig = true;
                this.digOpts.doScrape = true;
            }

            // log the linkHrefs from ContentPeeper.
            // Then, log the thumbSrcs from ContentPeeper.
            var mapSize = Object.getOwnPropertyNames(this.galleryMap).length;
            console.log('[App] Initial processed response has ' + mapSize + ' thumb uris -> zoom link uris.');

            if (locDoc) {
                return Promise.resolve(locDoc);
            }
            else {
                this.output.toOut('Could not scrape. Would you try refreshing the page, please?');
                return Promise.reject('[App] Aborting. Received null document object.');
            }       
        };


        /**
         * Give the user a list of media that was found. Download based upon their preference
         * and interaction.
         */
        this.presentFileOptions = (harvestedMap) => {
            if (!harvestedMap) {
                console.log('[App] called with null harvestedMap.');
                return Promise.resolve([]);
            }

            Object.assign(this.galleryMap, harvestedMap);
            
            var thumbUris = Object.keys(harvestedMap);
            var length = thumbUris.length;

            if (length < 1) {
                console.log('[App] No files to download.');
                this.output.toOut('No URLs to download.');            
            }
            
            console.log('[App] Count of files to download: ' + length);
            this.output.toOut('Click on the files in the list to download them.');
            this.output.clearFilesDug();

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

                var destFilePath = this.downloadsDir + '/' + destFileName;
                var optIdx = this.fileOptions.push(destFilePath);
                var fileOption = Utils.createFileOption(optIdx+'', uri, thumbUri, destFilePath, Utils.downloadFile);

                this.output.addFileOption(fileOption);
                fileOptionzzz.push(fileOption);
            }
            
            chrome.browserAction.setBadgeText({ text: '' + this.fileOptions.length + '' });
            chrome.browserAction.setBadgeBackgroundColor({ color: [247, 81, 158, 255] });

            console.log('[App] Presented ' + this.fileOptions.length + ' file options.');
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
        var length = Object.keys(harvestedMap).length;        
        this.galleryMap = harvestedMap;
        var me = this;

        this.digger.redrawOutputFileOpts(harvestedMap);

        if (!harvestedMap || length < 1) {
            console.log('[App] No files to download.');
            this.output.toOut('No URLs to download.');
        }
        else {
            console.log('[App] Downloading ' + length + ' files.')
            this.output.toOut('' + length + ' Downloading!');
        }

        console.log('STARTING DOWNLOAD')
        Utils.downloadInZip(harvestedMap.values()).then(function() {
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
            Utils.getXhrResponse('GET', loc.href, 'document')
            .then(function processXhrResponse(xhrResponse) {
                return Promise.resolve(Utils.createLocDoc(loc, xhrResponse));
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
            .then(this.buildTabMessage)
            .then(Utils.sendTabMessage)
            .then(this.processTabMessageResponse)
            .then(this.processLocDoc)
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
     * Main entry point of the app for scraping media from the immediate page, and not having
     * any choice over which media gets downloaded. 
     */
    scrape(options) {
        this.output.toOut('Initializing: Collecting uris from page.');        
        this.clearGalleryData(false);
        this.output.setIsScraping(true);
        var me = this;        

        // Begin by communicating with the ContentPeeper for information 
        // about the target page. Then either use the ContentPeeper's processed
        // galleryMap or the one from the Scraper in order to download immediately.
        // No user choice on what to download.
        return (
            this.processContentPage()
            .then(function doScraping(locDoc) {
                // Based upon the Logicker's special rules for sites, either just
                // resolve with the ContentPeeper's processed uri info, or do a scrape.
                if (me.digOpts.doScrape === false) {
                    me.digger.redrawOutputFileOpts(me.galleryMap);                    
                    console.log('[App] Downloading ContentPeeper uris, not scraping.');
                    return Promise.resolve(me.galleryMap);
                }
                else {
                    console.log('[App] Performing scrape.')
                    return (me.scraper.scrape({
                            node: locDoc.doc, 
                            loc: locDoc.loc, 
                            opts: options
                        })
                    );
                }
            })
            .then(me.startDownloading)            
            .catch(function onDocRequestError(errorMessage) {
                me.output.toOut('There was an internal error. Please try refreshing the page.');
                console.log(errorMessage);
                return Promise.reject(errorMessage);
            })
            .finally(function setUriMapInStorage() {
                chrome.storage.local.set({
                        prevUriMap: me.galleryMap,
                    },
                    function storageSet() {
                        console.log('[Digger] Set prevUriMap in storage');
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
        this.output.toOut('Initializing: Collecting uris from page.');        
        this.clearGalleryData(true); 
        this.output.setIsScraping(true); 
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
            .then(function doScraping(locDoc) {
                console.log('[App] Scraping with the this.scraper.')
                return me.scraper.scrape({
                    node: locDoc.doc, 
                    loc: locDoc.loc, 
                    opts: options,
                });
            })
            .then(me.presentFileOptions)            
            .catch(function handleError(errorMessage) {
                me.output.toOut('There was an internal error. Please try refreshing the page.');
                console.log(errorMessage);
                return Promise.reject(errorMessage);
            })
            .finally(function setUriMapInStorage() {
                chrome.storage.local.set({
                        prevUriMap: me.galleryMap,
                    },
                    function storageSet() {
                        console.log('[Digger] Set prevUriMap in storage');
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
        this.output.toOut('Initializing: Collecting uris from page.');        
        this.clearGalleryData(true);
        this.output.setIsDigging(true);
        var me = this;     
        
        // Begin by communicating with the ContentPeeper for information 
        // about the target page. Then immediately start downloading
        // with either the galleryMap from the ContentPeeper, or from the this.digger.
        // No user choice in what to download.         
        return (
            this.processContentPage()
            .then(function goDig(locDoc) {
                // Based upon the Logicker's special rules for sites, either just
                // resolve with the ContentPeeper's processed uri info, or do the dig.
                if ((me.digOpts.doDig === false) && (me.digOpts.doScrape === false)) {
                    me.digger.redrawOutputFileOpts(me.galleryMap);
                    console.log('[App] Downloading ContentPeeper uris');
                    return Promise.resolve(me.galleryMap);
                }
                else {
                    console.log('[App] Performing gallery dig.')               
                    return this.digger.digGallery({
                        doc: locDoc.doc,
                        loc: locDoc.loc,
                        digOpts: this.digOpts,
                        galleryMap: this.galleryMap,
                    })
                }
            })
            .then(me.startDownloading)
            .catch(function handleError(errorMessage) {
                me.output.toOut('There was an internal error. Please try refreshing the page.');
                console.log(errorMessage);
                return Promise.reject(errorMessage);
            })
            .finally(function setUriMapInStorage() {
                chrome.storage.local.set({
                        prevUriMap: me.galleryMap,
                    },
                    function storageSet() {
                        console.log('[Digger] Set prevUriMap in storage');
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
        this.output.toOut('Initializing: Collecting uris from page.');        
        this.clearGalleryData(true); 
        this.output.setIsDigging(true); 
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
                    return me.digger.digGallery({
                        doc: locDoc.doc,
                        loc: locDoc.loc,
                        digOpts: me.digOpts,
                        galleryMap: me.galleryMap,
                    });
                }
            })
            .then(me.presentFileOptions)
            .catch((errorMessage) => {
                me.output.toOut('There was an internal error. Please try refreshing the page.');
                console.log(errorMessage);
                return Promise.reject(errorMessage);
            })
            .finally(() => {
                chrome.storage.local.set({
                        prevUriMap: me.galleryMap,
                    },
                    function storageSet() {
                        console.log('[Digger] Set prevUriMap in storage');
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
        this.output.toOut('Initializing: Collecting links to galleries from page.');        
        this.clearGalleryData(false);
        this.diggingGalleryGallery = true;
        var locDocs = [];
        var combinedMap = {};
        var me = this; 

        me.output.setIsDigging(true);

        // Begin by communicating with the ContentPeeper for information 
        // about the target page. Then present the user with choices on what to download,
        // with either the galleryMap from the ContentPeeper, or from the this.digger.
        return ( 
            this.processContentPage()
            .then(function buildPromises(locDoc) {
                return me.digger.digGallery({
                    doc: locDoc.doc,
                    loc: locDoc.loc,
                    digOpts: { doScrape: true, doDig: false },
                    galleryMap: Object.assign({}, me.peeperMap),
                })
            })
            .then(function(mapOfGalleryLinks) {
                var p = Promise.resolve(true);

                // make a simple chain of 
                var id = 0;
                var galleryCount = 0;
                Object.values(mapOfGalleryLinks).forEach(function(uri) { 
                    if (!!uri && !!uri.trim()) {                   
                        p = p.then(function() { 
                            return Utils.getXhrResponse('GET', uri, 'document')
                            .then(function pushDoc(d) {
                                console.log('[App] Executed load of gallery page ' + uri);
                                me.output.toOut('Loading gallery page ' + uri);
                                chrome.browserAction.setBadgeText({ text: '' + (++galleryCount) + '' });
                                chrome.browserAction.setBadgeBackgroundColor({ color: '#4444ff' });

                                locDocs.push({
                                    loc: new URL(uri),
                                    doc: d,
                                });
                                return Promise.resolve(true);
                            }).catch(function(e) {
                                console.log('[App] Failed to load gallery doc ' + uri)
                                console.log('      Error: ' + e);
                                me.output.toOut('Failed to load gallery page ' + uri);
                                galleryCount--;

                                return Promise.resolve(true);
                            });
                        });
                    }
                });

                return p;
            })
            .then(function docsLoaded() {
                var p = Promise.resolve(true);

                locDocs.forEach(function(lDoc) {
                    console.log('[App] creating dig promise for ' + lDoc.loc.href);
                    me.output.toOut('Beginning dig for ' + lDoc.loc.href);

                    p = p.then(function peepAroundForInitialMap() {
                        return me.digger.digGallery({
                            doc: lDoc.doc,
                            loc: lDoc.loc,
                            digOpts: { doScrape: true, doDig: false },
                            galleryMap: {},
                        })
                        .then(function doDigging(scrapedMap) {
                            console.log('[App] Received initial gallery map length: ' + Object.getOwnPropertyNames(scrapedMap).length + '');
                            console.log('[App] Applying post-processing to: ' + lDoc.loc.href);
                            var inst = Logicker.postProcessResponseData(scrapedMap, lDoc.loc.href);

                            return me.digger.digGallery({
                                doc: lDoc.doc,
                                loc: lDoc.loc,
                                digOpts: { doScrape: inst.doScrape, doDig: inst.doDig },
                                galleryMap: Object.assign({}, inst.processedMap)
                            });
                        })
                        .then(function receiveGalleryMap(gMap) {
                            me.output.toOut('Received file list for ' + lDoc.loc.href);
                            console.log('[App] Received ' + Object.getOwnPropertyNames(gMap).length + '');
                            Object.assign(combinedMap, gMap);
                            
                            return Promise.resolve(true);
                        });
                    });
                });

                return p;
            })
            .then(function() {
                me.digger.redrawOutputFileOpts(combinedMap);

                console.log('[App] Received combinedMap.');
                me.output.toOut('Received file list of length: ' + Object.keys(combinedMap).length);

                return Promise.resolve(combinedMap); 
            })
            .then(me.presentFileOptions)
            .catch(function handleError(errorMessage) {
                me.output.toOut('There was an internal error. Please try refreshing the page.');
                console.log(errorMessage);
                return Promise.reject(errorMessage);
            })
            .finally(function setUriMapInStorage() {
                chrome.storage.local.set({
                        prevUriMap: me.galleryMap,
                    },
                    function storageSet() {
                        console.log('[Digger] Set prevUriMap in storage');
                    }
                );

                me.diggingGalleryGallery = false;
                me.output.setIsDigging(false);
            })
        );
    };

}

window.app = App;

export default App;