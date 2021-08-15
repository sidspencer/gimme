import { default as CommonBase } from '../baselibs/CommonBase.js';
import { default as Utils } from './Utils.js';
import { default as Logicker } from './Logicker.js';
import { default as Output } from './Output.js';
import { default as Digger } from './Digger.js';
import { default as Scraper } from './Scraper.js';
import { default as C } from '../baselibs/C.js';
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
} from '../baselibs/DataClasses.js'
import MessageStrings from '../baselibs/MessageStrings.js';


/**
 * Class for the main "Application" backend of Gimme.
 */
class App extends CommonBase {
    // vars for our background object instances.
    output = undefined;
    digger = undefined;
    scraper = undefined;

    // Vars for harvested URIs.
    galleryMap = {};
    peeperMap = {};
    alreadyDownloaded = {};
    fileOptions = [];
    filesDug = [];

    // Configuration vars.
    digOpts = new DigOpts(true, true);
    contentScriptSelection = true;
    isDiggingGalleryGallery = false;
    downloadsDir = C.F_NAMING.DOWNLOADS_DIR;


    /**
     * Constructor for App.
     */
    constructor(aDigger, aScraper) {
        // set up log and STOP listener.
        super(C.LOG_SRC.APP);

        // instance vars
        this.output = Output.getInstance();
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

           if (Utils.isTrue(this.contentScriptSelection)) {
               var d = Logicker.getMessageDescriptorForUrl(tab.url);
               message = Object.assign({}, d);
           }
           else if (Utils.isTrue(this.isDiggingGalleryGallery)) {
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

            this.lm('Processed LocDoc with digOpts: ' + JSON.stringify(this.digOpts));

            // But make it do everything if it came back as 0.
            if (Object.keys(this.galleryMap).length === 0) {
                this.digOpts = new DigOpts(true, true);
            }

            // log the linkHrefs from ContentPeeper.
            // Then, log the thumbSrcs from ContentPeeper.
            var mapSize = Object.getOwnPropertyNames(this.galleryMap).length;
            this.lm('Initial processed response has ' + mapSize + ' thumb uris -> zoom link uris.');

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
                this.lm('called with null harvestedMap.');
                return Promise.resolve([]);
            }

            var thumbUris = Object.keys(harvestedMap);
            var length = thumbUris.length;

            if (length < 1) {
                this.lm('No files to download.');
                this.output.toOut('No URLs to download.');
            }

            this.lm('Count of files to download: ' + length);
            this.output.toOut('Click on the files in the list to download them.');
            this.output.clearFilesDug();

            var fileOptionzzz = [];

            // Set up the download options for each of the uris returned.
            for (var thumbUri in harvestedMap) {
                var uri = harvestedMap[thumbUri];

                if (!uri || !uri.replace || uri.indexOf(C.ST.D) === 0) {
                    this.lm('Bad uri string for download: ' + JSON.stringify(uri));
                    delete harvestedMap[thumbUri];
                    continue;
                }
                else if (Utils.isTextOnlyFile(uri)) {
                    this.lm('Rejecting uri for text-fbased file for download: ' + JSON.stringify(uri));
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

            // ***Assign a new cloned object of harvestedMap on this.galleryMap.***
            // It is done this way so that there are no references shared between
            // galleryMap and harvestedMap.
            this.galleryMap = Object.assign({}, harvestedMap);

            // Update the badge with accurate counts of files available.
            chrome.browserAction.setBadgeText({ text: C.ST.E + this.fileOptions.length + C.ST.E });
            chrome.browserAction.setBadgeBackgroundColor(C.COLOR.AVAILABLE_FOPTS);

            // Log, and tell the user to start selecting checkboxes.
            this.lm('Presented ' + this.fileOptions.length + ' file options.');
            this.output.toOut('Please select which of the ' + this.fileOptions.length + ' files you would like to download.');

            // Show the action buttons, and reset the downloader.
            this.output.showActionButtons();
            Utils.resetDownloader();

            // Resolve with the combined fileOptionszzz array. (But I don't think anyone reads it...)
            return Promise.resolve(fileOptionzzz);
        };
    }


    /**
     * Set the given prevUriMap in storage, log the happening, and reset
     * isScraping/isDigging/diggingGalleryGallery all to false.
     *
     * @param {Map} uriMap
     * @returns {Promise} did setInStorage work or not
     */
    storeUriMapAndTeardown(uriMap) {
        this.output.setIsScraping(false);
        this.output.setIsDigging(false);
        this.setIsDiggingGalleryGallery(false);

        return Utils.setInStorage(
                Storing.buildPrevUriMapStoreObj(uriMap),
                'local'
            )
            .then(() => {
                this.lm(MessageStrings.STORING_URIMAP);
                this.lm(MessageStrings.HARVEST_START + Object.keys(uriMap).length + MessageStrings.HARVEST_END);

                // Just give a resolve(true).
                return C.CAN_FN.PR_RS_DEF();
            })
            .catch((err) => {
                this.output.toOut(
                    'Error storing the found links. Please download what you want before ' +
                    'letting this popup window close -- once closed, these results will be gone.'
                );
                this.lm(`Error caught in storeUriMapAndTeardown. Logging, then rejecting with error: ${JSON.stringify(err)}`);

                // Reject with the same error we got.
                return C.CAN_FN.PR_RJ(err);
            });
    }


    /**
     * Once we have the dug uris from the response, this callback downloads them.
     */
    startDownloading(harvestedMap) {
        var me = this;
        var length = Object.keys(harvestedMap).length;

        if (Utils.exists(harvestedMap) && length > 0) {
            this.galleryMap = harvestedMap;
        }

        this.digger.redrawOutputFileOpts(harvestedMap);

        if (!harvestedMap || length < 1) {
            this.lm('No files to download.');
            this.output.toOut('No URLs to download.');
        }
        else {
            this.lm('Downloading ' + length + ' files.')
            this.output.toOut(C.ST.E + length + ' Downloading!');
        }

        this.lm('STARTING ZIP DOWNLOAD');

        Utils.downloadInZip(harvestedMap.values()).then(() => {
            for (var index = 0; index < harvestedMap.values(); index++) {
                me.output.setEntryAsDownloading(index);
            };
        });

        return Promise.resolve([]);
    }


    /**
     * Simple setter for isDiggingGalleryGallery
     *
     * @param {bool} yesWeAre
     */
    setIsDiggingGalleryGallery(yesWeAre) {
        this.isDiggingGalleryGallery = yesWeAre;
    }


    /**
     * Fetch the document on which we are scraping/digging.
     * Please note, no <script>s will be run, so it's only the base html, and often not useful.
     */
    getLocDoc(loc) {
        return (
            Utils.getXhrResponse(C.ACTION.GET, loc.href, C.DOC_TYPE.DOC)
            .then((xhrResponse) =>{
                return Promise.resolve(
                    new LocDoc(loc, xhrResponse)
                );
            })
            .catch((err) => {
                this.lm(`Error from XHR in getLocDoc(): ${JSON.stringify(err)}`);
                return Promise.reject(err);
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

        // Only clear the gallery data on hard boolean "false"
        this.clearGalleryData(
            !Utils.isFalse(clearGalleryItems)
        );

        // reset the flags as to what action we're doing.
        this.output.setIsDigging(
            (action === C.ACTION.DIG || action === C.ACTION.DIG_GG)
        );
        this.output.setIsScraping(
            (action === C.ACTION.SCRAPE)
        );
        this.setIsDiggingGalleryGallery(
            (action === C.ACTION.DIG_GG)
        );
    }



    //-------
    // The entrypoint methods called by EventPage are defined below here.
    //-------

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
                    if (Utils.isFalse(me.digOpts.doScrape) || me.isSTOP()) {
                        if (me.isSTOP()) {
                            me.lm(
                                `${C.ST.STOP_BANG} just after processContentPage() in scrape(). ` +
                                `Continuing with the flow of just downloading ContentPeeper URIs of count: ${Object.keys(me.galleryMap).length}`
                            );
                        }
                        else {
                            me.lm(`Not scraping due doScrape being false, just downloading ContentPeeper URIs of count: ${Object.keys(me.galleryMap).length}.`);
                        }

                        // The downloads start immediately.
                        me.digger.redrawOutputFileOpts(me.galleryMap);
                        return Promise.resolve(me.galleryMap);
                    }
                    else {
                        me.lm('Performing scrape in scrape().');
                        return (
                            new ScrapeOptions(locDoc.doc, locDoc.loc, options)
                        );
                    }
                })
                .then(me.startDownloading)
                .catch((err) => {
                    // If STOP, it was called during startDownloading(). Just let them have downloaded what they already downloaded.
                    // If a different error, assume the worst, so redraw and then present the options.
                    if (me.isSTOP(err)) {
                        me.lsm(`in scrape() after already perhaps starting downloads -- Do nothing. They got what they got.`);

                        // Resolve just in case we're chained off of in the future.
                        return C.CAN_FN.PR_RS_STOP();
                    }
                    else {
                        me.output.toOut(`${MessageStrings.PLEASE_REFRESH} Error:\n     ${JSON.stringify(err)}`);
                        me.lm(`scrape() got unexpected error:\n       ${JSON.stringify(err)}`);

                        me.redrawOutputFileOpts(me.galleryMap);
                        me.presentFileOptions(me.galleryMap);

                        // Reject just in case we're chained off of in the future.
                        return Promise.reject(err);
                    }
                })
                .finally(() => {
                    // Store the gallery map and reset flags.
                    return me.storeUriMapAndTeardown(me.galleryMap);
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
                // If either digOpts.doScrape is false or STOP is set, just display the peeperMap galleryMap.
                // In all other cases, actually call the Scraper.scrape() method.
                // Both paths resolve maps to presentFileOptions().
                if (Utils.isFalse(me.digOpts.doScrape) || me.isSTOP()) {
                    if (me.isSTOP()) {
                        me.lsm(`just after processContentPage() in scrapeFileOptions(). Displaying ContentPeeper URIs.`);
                    }
                    else {
                        me.lm('Presenting ContentPeeper uris, not scraping due to digOpts.doScrape being false.');
                    }

                    // redraw the file opts in preparation for presentFileOptions().
                    me.digger.redrawOutputFileOpts(me.galleryMap);
                    return Promise.resolve(me.galleryMap);
                }
                else {
                    me.output.toOut(`Scraping ${locDoc.loc.href}...`);
                    me.lm(`Scraping with the app\'s scraper instance for ${locDoc.loc.href}`);

                    // Do a real scrape. It resolves with a gallery map, ready for presentFileOptions().
                    return me.scraper.scrape(
                        new ScrapeOptions(locDoc.doc, locDoc.loc, options)
                    );
                }
            })
            .then(me.presentFileOptions)
            .catch((err) => {
                // See if we're being asked to stop, or if it's a different error.
                // The STOP could have been thrown at any previous time, so have the STOP path display the options again.
                // The error case is an error -- don't display, just ask the user to try again and reject().
                if (me.isSTOP(err)) {
                    me.output.toOut(MessageStrings.STOPPING_DDD);
                    me.lsm(`thrown sometime in scrapeFileOptions(). Presenting the options again, Just in case.`);

                    me.redrawOutputFileOpts(me.galleryMap);
                    me.presentFileOptions(me.galleryMap);

                    // resolving, just in case we get chained off of sometime in the future.
                    return C.CAN_FN.PR_RS_DEF();
                }
                else {
                    me.output.toOut(MessageStrings.PLEASE_REFRESH);
                    me.lm(`Unexpected error in scrapeFileOptions(). Not showing file options. Error is:\n        ${JSON.stringify(err)}`);

                    // rejecting, just in case we get chained off of in the future. Let them know the
                    // last link in this chain was an unexpected error.
                    return Promise.reject(err);
                }
            })
            .finally(() => {
                // Store prevUriMap in storage.local, and set the flags to not digging, scraping, etc.
                return me.storeUriMapAndTeardown(me.galleryMap);
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
            me.processContentPage()
            .then((locDoc) => {
                // If stopped here, continue execution through the path of doDig and doScrape both being false.
                if (me.isSTOP()) {
                    me.output.toOut(MessageStrings.STOPPING_DDD);
                    me.lsm(`right before dig, after processContentPage(). We do not resolve or reject, rather piggyback on the no-scrape-or-dig path.`);
                }

                // Based upon the Logicker's special rules for sites, either just
                // resolve with the ContentPeeper's processed uri info, or do the dig.
                // STOP uses the doDig and doScrape are false path -- peeperMap.
                if ((Utils.isFalse(me.digOpts.doDig) && Utils.isFalse(me.digOpts.doScrape)) || me.isSTOP()) {
                    me.digger.redrawOutputFileOpts(me.galleryMap);
                    me.lm('Downloading ContentPeeper uris');

                    // Resolve with the Logicker-processed peeperMap. Downloading starts automatically.
                    return Promise.resolve(me.galleryMap);
                }
                else {
                    // Do an actual scrape/dig using the options provided. Resolve with that galleryMap,
                    // Downloading will then start automatically.
                    me.lm('Performing gallery dig.')
                    return me.digger.digGallery(
                        new GalleryOptions(locDoc.doc, locDoc.loc, me.digOpts, me.galleryMap)
                    );
                }
            })
            .then(me.startDownloading)
            .catch((err) => {
                if (me.isSTOP(err)) {
                    // If we are now dispatched STOP here, it's a little late in the game, and we don't really know
                    // where it stopped. So, redraw the file outputs and present the file options. Don't try
                    // to automagically download everything, as we need user input for this.
                    me.lsm(`Presenting whatever is in the galleryMap.`);

                    me.digger.redrawOutputFileOpts(me.galleryMap);
                    me.presentFileOptions(me.galleryMap);

                    // Resolve STOP, but only for if someone chains off of us in the future.
                    return C.CAN_FN.PR_RS_STOP();
                }
                else {
                    // For real error cases, these might have been thrown anywhere along the promise chain. Just
                    // present the user with the "please refresh" message, and reject.
                    me.output.toOut(MessageStrings.PLEASE_REFRESH);
                    me.lm(`Error caught in digGallery(). It is:\n         ${JSON.stringify(err)}`);

                    // Reject only for if someone chains off of us in the future.
                    return Promise.reject(err);
                }
            })
            .finally(() => {
                // In any case we will get here. Set the previousUriMap and reset all the flags.
                return me.storeUriMapAndTeardown(me.galleryMap);
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
                    // If stop was signaled already, we want to do the doDig and doScrape both false path. Just
                    // Follow the flow that way.
                    if (me.isSTOP()) {
                        me.output.toOut(MessageStrings.STOPPING_DDD);
                        me.lsm(`Will resolve with ContentPeeper map we have. Fall-through...`);
                    }

                    // doDig and doScrape are false, or STOP, will take us down the path of using whatever we already
                    // have in the galleryMap.
                    if ((Utils.isFalse(me.digOpts.doDig) && Utils.isFalse(me.digOpts.doScrape)) || me.isSTOP()) {
                        // show the file opts.
                        me.digger.redrawOutputFileOpts(me.galleryMap);

                        // Store the prevUriMap, but throw away its promise. We want to resolve with me.galleryMap
                        // to continue giving the user all the file options we can before hard stop. It will at the very
                        // least be the Logicker-processed peeperMap.
                        Utils.setInStorage(Storing.buildPrevUriMapStoreObj(me.galleryMap), 'local')
                            .then(() => {
                                me.lm('Setting prevUriMap');
                            })
                            .catch((err) => {
                                me.lm(`Got error setting prevUriMap, but still resolving. Error is:\n      ${JSON.stringify(err)}`);
                            });

                        // Resolving with me.galleryMap.
                        me.lm('Resolving with ContentPeeper\'s galleryMap.');
                        return Promise.resolve(me.galleryMap);
                    }
                    else {
                        // If not STOP or degenerate digOpts, do an actual Digger.digGallery(). It returns a uriMap, ready for
                        // the next part of the chain.
                        return me.digger.digGallery(
                            new GalleryOptions(locDoc.doc, locDoc.loc, me.digOpts, me.galleryMap)
                        );
                    }
                })
                .then((harvestedMap) => {
                    // Create a new galleryMap object from the harvestedMap.
                    // Note: harvestedMap might === galleryMap from the digOpts-degenerate/STOP path.
                    me.galleryMap = Object.assign({}, harvestedMap);

                    // Present the harvestedMap options for the user to choose to download.
                    // Then if we get STOP here, we reject with STOP to do the catch block.
                    // If not STOP, do a default resolve to go straight to finally().
                    me.presentFileOptions(me.galleryMap).then(() => {
                        return (
                            me.isSTOP() ?
                            C.CAN_FN.PR_RJ_STOP() :
                            C.CAN_FN.PR_RS_DEF()
                        );
                    });
                })
                .catch((err) => {
                    // We got here either by a STOP or by a true error.
                    if (me.isSTOP(err)) {
                        // For stop, just clean up the file opts, which can get a little wrong on STOP.
                        me.lsm(`Did present file options, all good.`);
                        me.output.clearNonFileOpts();
                    }
                    else {
                        // For real errors, give the "please refresh" message.
                        me.output.toOut(MessageStrings.PLEASE_REFRESH);
                        me.lm(`Unexpected error caught in digFileOptions(). Error is:\n       ${JSON.stringify(err)}`);
                    }

                    // In either above case, we just reject with err here. Not used for anything in
                    // the finally(), but useful if chained off of in the future.
                    return Promise.reject(err);
                })
                .finally(() => {
                    // Store the harvested uriMap, and reset the flags.
                    return me.storeUriMapAndTeardown(me.galleryMap);
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

        // Variables, all closure all the time.
        var locDocs = [];
        var combinedMap = {};
        var me = this;
        var p = C.CAN_FN.PR_RS_DEF();

        // Begin by communicating with the ContentPeeper for information
        // about the target page. Then present the user with choices on what to download,
        // with either the galleryMap from the ContentPeeper, or from the this.digger.
        return (
            me.processContentPage()
                .then((locDoc) => {
                    // If stop is already called, reject with STOP to shoot to the final catch(). Set a flag so we
                    // know this was an early STOP.
                    if (me.isSTOP()) {
                        me.output.toOut(MessageStrings.STOPPING_DDD);
                        me.lsm(`after processContentPage(), before any digging. Reject with STOP.`);
                        return C.CAN_FN.PR_RJ_STOP();
                    }

                    // Do a special gallery dig to find the links on the meta-gallery to the galleries.
                    return me.digger.digGallery(
                        new GalleryOptions(locDoc.doc, locDoc.loc, new DigOpts(true, false), Object.assign({}, me.peeperMap))
                    );
                })
                .then((mapOfGalleryLinks) => {
                    // Fix the placement of this.
                    if (me.isSTOP()) {
                        me.output.toOut(MessageStrings.STOPPING_DDD);
                        me.lsm(`while building gallery-fetching promises. Ending this promise chain here, resolving with STOP.`);

                        // Instead of a bunch of resolve STOP promises in a chain, set the whole promise chain to our resolve(STOP), set a flag so
                        // we don't reset p again the next time through (we're stuck in a forEach), and return p.
                        return C.CAN_FN.PR_RJ_STOP();
                    }

                    // We make a simple chain of XHR promises fetching the linked-to gallery pages
                    var galleryCount = 0;
                    Object.values(mapOfGalleryLinks).forEach((uri) => {
                        if (!!uri && !!uri.trim()) {
                            if (me.isSTOP()) {
                                me.output.toOut(MessageStrings.STOPPING_DDD);
                                me.lsm(`while creating gallery-fetching promises. Ending this promise chain here, resolving with STOP.`);

                                return C.CAN_FN.PR_RJ_STOP();
                            }

                            // If the URI was good enough, chain up the promise.
                            p = p.then(() => {
                                // A STOP here means we may have already fetched a few galleries, or we may not have. In
                                // any case, we need to set the promise chain to just resolve with STOP and not do any more
                                // XHRs.
                                if (me.isSTOP()) {
                                    me.output.toOut(MessageStrings.STOPPING_DDD);
                                    me.lsm(`while executing gallery-fetching promises. Ending this promise chain here, resolving with STOP.`);
                                    return C.CAN_FN.PR_RJ_STOP();
                                }

                                // Do a document-response XHR to get each gallery document from the meta-gallery's links. We do a simple
                                // chain here. Each p.then() is the next gallery sequentially.
                                return Utils.getXhrResponse(C.ACTION.GET, uri, C.DOC_TYPE.DOC)
                                    .then((d) => {
                                        // Update the log and the user as to what gallery page we just received the document for.
                                        me.lm('Executed load of gallery page ' + uri);
                                        me.output.toOut('Loading gallery page ' + uri);

                                        // Update the badge with some numbers.
                                        chrome.browserAction.setBadgeText({ text: (C.ST.E + (++galleryCount) + C.ST.E) });
                                        chrome.browserAction.setBadgeBackgroundColor(C.COLOR.NEW_FOPTS);

                                        if (me.isSTOP()) {
                                            // If we got a STOP now, just reject to get to this p.then()'s catch().
                                            return C.CAN_FN.PR_RJ_STOP();
                                        }
                                        else {
                                            // The success case is to construct a LocDoc from the newly-fetched
                                            // gallery document and push it into the locDocs array. Then resolve, going
                                            // on to fetch the next doc. (and skipping the catch().)
                                            locDocs.push(new LocDoc(new URL(uri), d));
                                            return C.CAN_FN.PR_RS_DEF();
                                        }
                                    }).catch((e) => {
                                        // This gets any STOP in this promise link.
                                        if (me.isSTOP(e)) {
                                            me.output.toOut(MessageStrings.STOPPING_DDD);
                                            me.lsm(`all doc-fetching operations halting, setting the entire promise chain to resolve(STOP).`);
                                            p = C.CAN_FN.PR_RS_STOP();
                                            return p;
                                        }
                                        else {
                                            // We got a real unexpected error from the gallery doc loading. Just log it and
                                            // tell the user, but then move on.
                                            me.lm(`Failed to load gallery doc ${uri}. Error was:\n\t${e}`);
                                            me.output.toOut('Failed to load gallery page ' + uri);
                                            galleryCount--;

                                            // Resolve so we can keep trying with the rest of the gallery docs.
                                            return C.CAN_FN.PR_RS_DEF();
                                        }
                                    });
                            });
                        }
                    });

                    // This is a promise chain of operations to load each gallery page from an XHR document-request.
                    // The resolved value of this promise is always either boolean "true" or "STOP", as the closure
                    // variable array locDocs collects the data needed for the next stage. a STOP will have truncated
                    // the promise-chain to only have a subset of the galleries we found on the meta-gallery page.
                    return p;
                })
                .then((trueOrStop) => {
                    // Set up a new promise chain starter.
                    var p = Promise.resolve(true);

                    // Using the locDocs collected for each gallery page that is linked to from the
                    // gallery-gallery-page. Use them to create a promise chain of digGallery(...)
                    // calls on each locDoc.
                    locDocs.forEach((lDoc) => {
                        // A STOP here means we will truncate the promise-chain to only the locDocs we have processed
                        // up until this point.
                        if (me.isSTOP(trueOrStop)) {
                            me.output.toOut(MessageStrings.STOPPING_DDD);
                            me.lsm(`while going through locDocs. Truncating promise chain.`);
                            return C.CAN_FN.PR_RJ_STOP();
                        };

                        // Build the promise chain of digging all the galleries linked to from the
                        // gallery-gallery-page. First we call digGallery() in scrape-only mode to
                        // get us a starting harvested gallery map. Then we do a scrape+dig (normally)
                        // unless the Logicker's special rules invalidate doScrape or doDig. That
                        // resolves with digGallery()'s harvested map, which we add to the combined map
                        // at the end.
                        me.lm('creating dig promise for ' + lDoc.loc.href);
                        me.output.toOut('Beginning dig for ' + lDoc.loc.href);

                        // Chain up the promises.
                        p = p.then(() => {
                            // A stop here means the STOP was signalled while the promises were executing. We do similarly
                            // to above, setting the whole chain to just one resolve(STOP)
                            if (me.isSTOP()) {
                                me.output.toOut(MessageStrings.STOPPING_DDD);
                                me.lsm(`Right before digging gallery ${lDoc.loc.href}. Truncating promise chain.`);
                                return C.CAN_FN.PR_RS_STOP();
                            }

                            // Call the Digger to do a gallery scrape only, giving us something very similar to peeperMap from
                            // ContentPeeper. We can then post-process with Logicker, then do a full scrape-n-dig of the
                            // gallery to get the thumbUri -> zoomImgUri mappings.
                            return me.digger.digGallery(
                                new GalleryOptions(lDoc.doc, lDoc.loc, new DigOpts(true, false), {})
                            )
                            .then((harvestedMap) => {
                                me.lm('Received initial gallery map length: ' + Object.getOwnPropertyNames(harvestedMap).length + C.ST.E);
                                me.lm('Applying post-processing to: ' + lDoc.loc.href);
                                var inst = Logicker.postProcessResponseData(harvestedMap, lDoc.loc.href);

                                // STOP here means At Least one promise-link of the chain did a Digger.digGallery() for scraping and
                                // Logicker post-processing, and probably multiple links have executed. Our STOP here is to truncate
                                // the chain to only what we have already dug. This is done in multiple stages. This is stage 1,
                                // to set the whole chain to just resolve of the inst.processedMap.
                                if (me.isSTOP()) {
                                    me.output.toOut(MessageStrings.STOPPING_DDD);
                                    me.lsm(`Resolving with the Logicker\'s post-processed-data.`);


                                    return C.CAN_FN.PR_RS_STOP();
                                }
                                else {
                                    // Normal operation is to do a full scrape-n-dig (at Logicker's discretion), and resolve
                                    // with that harvestedMap and fold it into the combinedMap.
                                    return me.digger.digGallery(
                                        new GalleryOptions(lDoc.doc, lDoc.loc, new DigOpts(inst.doScrape, inst.doDig), inst.processedMap)
                                    );
                                }
                            })
                            .then((harvestedUriMap) => {
                                // Use the combinedMap closure var to collect the new entries from the harvestedUriMap. Now we're
                                // gallery-gallery-digging!
                                me.output.toOut('Received file list for ' + lDoc.loc.href);
                                me.lm('Received ' + Object.getOwnPropertyNames(harvestedUriMap).length + C.ST.E);
                                Object.assign(combinedMap, harvestedUriMap);

                                // STOP here means to not dig any more galleries, or fold any more entries into combinedMap.
                                // Do the same promise-chain truncation trick, resolve of STOP, and set alreadyStopping so we
                                // don't do it a bunch of times.
                                if (me.isSTOP()) {
                                    me.output.toOut(MessageStrings.STOPPING_DDD);
                                    me.lsm(`Rejecting with "STOP".)`);
                                    return C.CAN_FN.PR_RJ_STOP();
                                }

                                // Resolve true to skip the catch and go on to the next link.
                                return C.CAN_FN.PR_RS_STOP();
                            })
                            .catch((err) => {
                                // A stop here is unlikely, but possible. Take the exact same steps as the above then() to
                                // truncate the promise-chain so we do no more digGallery()s.
                                if (me.isSTOP(err)) {
                                    me.output.toOut(MessageStrings.STOPPING_DDD);
                                    me.lsm(`caught thrown STOP. Resolve with "STOP".`);
                                    return C.CAN_FN.PR_RS_STOP();
                                }

                                // If we got a real error, ask the user to refresh again, log the stringified error, and reject.
                                me.output.toOut(MessageStrings.PLEASE_REFRESH);
                                me.lm(`Promise chain hit an unhandled error. Rejecting. Error is:\n       ${JSON.stringify(err)}`);
                                return Promise.reject(err);
                            });
                        });
                    });

                    // This is the promise chain of scraping, digging, and combining all the galleries'
                    // harvested thumbUri -> zoomUri maps into "combinedMap".
                     // If stop is already called, reject with STOP to shoot to the final catch(). Set a flag so we
                    // know this was an early STOP.
                    if (me.isSTOP()) {
                        me.output.toOut(MessageStrings.STOPPING_DDD);
                        me.lsm(`after processContentPage(), before any digging. Reject with STOP.`);

                        // Reject with STOP so we go to the final catch(), skipping everything else.
                        p = C.CAN_FN.PR_RS_STOP();
                    }

                    return p;
                })
                .then((trueOrStop) => {
                    // STOP here is a fine value, just signalling that we didn't dig all the galleries found by
                    // the meta-gallery scrape. As we want the user to get all the data possible, just pass-through
                    // and let the resolve(combinedMap) happen.
                    if (me.isSTOP(trueOrStop)) {
                        me.output.toOut(`${MessageStrings.STOPPING_DDD} But first presenting our findings up til now.`);
                    }

                    // Taking the combined gallery maps, Make FileOpts for them. Then we resolve with the combined
                    // map, which takes those  FileOpts and makes FileEntry (checkbox and thumbnail) objects for
                    // them, and presentFileOptions() shows all the FileEntry objects.
                    var length = Object.keys(combinedMap).length;
                    me.digger.redrawOutputFileOpts(combinedMap);

                    me.lm(`Received final combinedMap, and redrew with it. File list is of length: ${length}`);
                    me.output.toOut(`Received file list of length: ${length}`);

                    // Resolve the combinedMap, though it's a closure variable and we don't really need to.
                    return Promise.resolve(combinedMap);
                })
                .then((cMap) => {
                    // Present all the file options we found that are in the combinedMap.
                    return me.presentFileOptions(cMap).then(() => {
                        // This then() is merely to check for STOP. We reject to hit the catch() if STOP.
                        // For normal operation, we just resolve(true) to skip the catch() and go straight to the
                        // finally().
                        if (me.isSTOP()) {
                            me.lsm(`after having presented the file opts. rejecting with STOP to hit the catch.`)
                            return C.CAN_FN.PR_RJ_STOP();
                        }
                        else {
                            return C.CAN_FN.PR_RS_DEF();
                        }
                    });
                })
                .catch((err) => {
                    // We may have thrown ANYWHERE along the chain to get here. We may only have the meta-gallery map,
                    // or we may have just now thrown in presentFileOptions(), or anywhere in-between.
                    return new Promise((resolve, reject) => {
                        if (me.isSTOP(err)) {
                            if (stoppedBeforeDig) {
                                // Say that we're stopped. Log why. Only that first isSTOP() block rejects, so we can
                                // be pretty sure nothing got done.
                                me.output.toOut('Stopped.');
                                me.lsm(`stopped digGalleryGallery() before digging anything.`);
                                me.output.clearFilesDug();
                            }
                            else {
                                // As all the STOP paths RESOLVE through this chain (except the stoppedBeforeDig one),
                                // so we can assume all the file opts we dug were presented, so all is ok.
                                // The user doesn't need a special message about this, but Log one.
                                me.lsm(`File opts probably already presented so All Good. Resolving into the finally().`);
                            }

                            // Resolve with STOP in both STOP cases. It's just for the future, if this gets chained off of.
                            // (Only the finally() is left in this chain.)
                            resolve(err);
                        }
                        else {
                            // A real, unexpected error occurred somewhere in the chain... Just ask the user to refresh, and
                            // log the stringified error.
                            me.output.toOut(MessageStrings.PLEASE_REFRESH);
                            me.lm(`Caught error in digGalleryGallery():\n      ${JSON.stringify(err)}`);
                            me.output.clearFilesDug();

                            // Reject with this unexpected err. Done in case we are chained off of in the future.
                            // (Only the finally() is left in this chain.)
                            reject(err);

                        }
                    })
                })
                .finally(() => {
                    // Store the combined harvest map, which galleryMap is set to, in storage and reset the flags. Fini!
                    return me.storeUriMapAndTeardown(me.galleryMap);
                })
        );
    }
}


// Set the class on the window, just in case.
if (Utils.isBackgroundPage(window) && !window.hasOwnProperty(C.WIN_PROP.APP_CLASS)) {
    window[C.WIN_PROP.APP_CLASS] = App;
}


// export.
export default App;
