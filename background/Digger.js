import { default as Scraper } from './Scraper.js';
import { default as Output } from './Output.js';
import { default as Logicker } from './Logicker.js';
import { default as Utils } from './Utils.js';
import { default as C } from '../lib/C.js';
import {
    Storing, 
    FileOption, 
    UriPair, 
    Log
} from '../lib/DataClasses.js'
import CommonBase from '../lib/CommonBase.js';


/** 
 * Worker bee for GimmeGimmeGimme. Looks through various types of linked media, resolves
 * the harvested map of thumbnail URLs -> full-size URLs to the popup.
 */
class Digger extends CommonBase {
    // members for tracking the thumb -> zoomUri pairs.
    startingGalleryMap = {};
    harvestedUriMap = {};
    outputIdMap = {};
    
    // members for background object instances. (Note: Logicker and Utils are static.)
    scraper = undefined;
    output = undefined;

    // member for the digging options as set by Logicker and App.
    digOpts = { 
        doScrape: true, 
        doDig: true 
    };
    
    // members for tracking inspections and their XHRs.
    completedXhrCount = 0;
    batchCount = 0;
    inspectionOptions = {};
    soleInspectionOption = false;

    // Map of inspection-scraping DiggerScrapeKey -> Scraper Method pairs.
    SCRAPING_TOOLS = {};
 
    // Two static, configurable properties. They affect how many batches we dig
    // concurrently (CHANNELS), and how many we batch together in a promise chain
    // at any given time (BATCH_SIZE)
    static BATCH_SIZE = C.DIG_CONF.BATCH_SIZE;
    static CHANNELS = C.DIG_CONF.CHANNELS;


    /**
     * Constructor for the Digger class. Digger is the worker-bee for the "dig" actions of
     * the extension, utilizing the other background-page objects to dig galleries and dig
     * gallery galleries. 
     * 
     * @param {Scraper} Scraper 
     * @param {Output} Output 
     * @param {Utils} Utils 
     * @param {InspecionOptions} someInspectionOptions 
     */
    constructor(aScraper, someInspectionOptions) {
        // Set up Log and STOP handler.
        super(C.LOG_SRC.DIGGER);

        // set class refs.
        this.scraper = aScraper;
        this.output = Output.getInstance();

        // set the inspection options.
        this.inspectionOptions = someInspectionOptions;

        // Do additional setup.
        this.setupOptions();
        this.setupScrapingTools();
    }


    /**
     * Fill out the SCRAPING_TOOLS object to point to the right scraper methods for all the
     * scrape options. Called by constructor.
     */
    setupScrapingTools() {
        this.SCRAPING_TOOLS[C.DS_KEY.IMGS] = this.scraper.getAllImgUrls;
        this.SCRAPING_TOOLS[C.DS_KEY.CSS_BGS] = this.scraper.getAllCssBackgroundUrls;
        this.SCRAPING_TOOLS[C.DS_KEY.VIDEOS] = this.scraper.getAllVideoUrls;
        this.SCRAPING_TOOLS[C.DS_KEY.AUDIOS] = this.scraper.getAllAudioUrls;
        this.SCRAPING_TOOLS[C.DS_KEY.JS] = this.scraper.getAllJsUrls;
        this.SCRAPING_TOOLS[C.DS_KEY.QS] = this.scraper.getAllQsUrls;  
    }


    /**
     * If we were not passed in options of which assets to search, make the default search options here.
     * Also see if there's only one inspection option. This is Called by constructor.
     */
    setupOptions() {
        if (!this.inspectionOptions) {
            for (var o in C.DS_KEY) {
                this.inspectionOptions[o] = true;
            }
        }
        else {
            // Check if we only have 1 option enabled.
            this.soleInspectionOption = Object.keys(this.inspectionOptions).reduce(
                (soleOpt, optName) => {
                    return soleOpt + (this.inspectionOptions[optName] ? optName : C.ST.E);
                }, 
                C.ST.E
            );
        }
    }


    /**
     * Is this the only inspection option? 
     */
    isSoleOption(optName) {
        return (optName === this.soleInspectionOption);
    }


    /**
     * Promise to resolve everything that has been dug.
     */
    resolveDigHarvest(uriMap) {
        var h = uriMap;
        var me = this;

        return (new Promise((resolve, reject) => {
            chrome.storage.local.set(
                Storing.storePrevUriMap(h),
                () => {                    
                    me.log.log('Set prevUriMap in storage');
                    me.log.log('---Returning dig harvest -> ' + Object.keys(h).length + '------');
                    resolve(h);
                }
            );
        }));
    }


    /**
     * @description redraw he output files in popup.
     * @memberof Digger
     */
    redrawOutputFileOpts(uriMap) {
        this.output.clearFilesDug();
        var dir = Utils.getSaltedDirectoryName();

        var idx = 0;
        for (var thumbUri in uriMap) { 
            var uri = uriMap[thumbUri];
            var queryPos = uri.lastIndexOf(C.ST.Q_MARK);

            if (queryPos === -1) {
                queryPos = uri.length;
            }

            this.outputIdMap[thumbUri] = idx;
                      
            var filePath = dir + C.ST.WHACK + uri.substring(uri.lastIndexOf(C.ST.WHACK), queryPos);
            this.output.addFileOption(
                new FileOption((idx++), uri, thumbUri, filePath, Utils.downloadFile)
            );
        }
        
        chrome.browserAction.setBadgeText({ text: C.ST.E + idx + C.ST.E });
        chrome.browserAction.setBadgeBackgroundColor(C.COLOR.AVAILABLE_FOPTS);

        return Promise.resolve(uriMap);
    }


    /**
     * Recursive wrapper around digNextBatch()
     */
    digNextBatchLink(galleryMap) {
        if (this.stop === true) {
            this.output.toOut('Stopping...');
            return Promise.reject(C.ACTION.STOP);
        }
        else if (Object.keys(galleryMap).length > 0) {
            return this.digNextBatch(galleryMap).then(() => {
                return this.digNextBatchLink(galleryMap);
            });
        }
        else {
            return Promise.resolve({});
        } 
    }


    /**
     * Alternate way to dig the gallery batches, more strictly in channeled chains.
     */
    digGalleryBatches(galleryMap, thumbUris) {
        // Each channel is a promise chain that takes its own subset of the map
        // entries in galleryMap. The entries are equally distributed, with one 
        // map getting the remainder. 
        var promises = [];
        var thumbUris = Object.keys(galleryMap);
        var thumbsPerChannel = Math.floor(thumbUris.length / (Digger.CHANNELS - 1)) || 1;

        this.log.log('Digging ' + thumbUris.length + ' scraped thumbnails.');
        this.output.toOut('Now digging ' + thumbUris.length + ' thumbnails found in gallery.');
        
        // Make the submaps, build the promise chains.
        while (thumbUris.length > 0) {
            var subMap = {};

            for (var j = 0; j < thumbsPerChannel && thumbUris.length > 0; j++) {
                var thumbUri = thumbUris.pop();
                subMap[thumbUri] = C.ST.E + galleryMap[thumbUri];
                delete galleryMap[thumbUri];
            }

            promises.push(this.digNextBatchLink(subMap));
        }
        
        var me = this;
        // Note, all these promises must resolve, or it'll kill the whole batch.
        return Promise.all(promises).then((resolvedUriMap__unused) => {
            me.log.log(
                'Resolving digGalleryBatches with ' + 
                Object.keys(this.harvestedUriMap).length + ' harvested entries.'
            );

            return Promise.resolve(this.harvestedUriMap);
        }).catch((err) => {
            var harvestCount = Object.keys(this.harvestedUriMap).length;

            // Stop is implemented as a reject(STOP) from digNextBatchLink(...).
            // Other rejects are probably from real errors.
            if (err === C.ACTION.STOP) {
                 me.log.log(`STOP was signaled. Rejecting all promises. Setting ${harvestCount} pairs in storage.`);
                return this.resolveDigHarvest(this.harvestedUriMap).then((hMap) => {
                    return this.redrawOutputFileOpts(hMap);
                });
            }
            else {
                me.log.log(
                    'Caught error in digGalleryBatches\'s Promise.all() while resolving dig harvest promises: ' + 
                    JSON.stringify(err) + '\n\tResolving with the ' + harvestCount + ' uris already harvested.'
                );
                return Promise.resolve(this.harvestedUriMap);
            }
        });  
    }  


    /**
     * Build and execute the next batch of digDeep() promises. 
     */
    digNextBatch(galleryMap) {
        var diggingBatch = [];
        var startingOutputId = (++this.batchCount) * Digger.BATCH_SIZE;
        
        // Set up the output entry, and enter the uriPair's digDeep() execution
        // into the promise batch's array. Skip nulls. 
        var allThumbUris = Object.keys(galleryMap);    
        for (var i = 0; i < Digger.BATCH_SIZE && allThumbUris.length > 0; i++) {
            // Pop a thumb/link pair from the map.
            var thumbUri = allThumbUris[i];
            var zoomPageUri = galleryMap[thumbUri];
            delete galleryMap[thumbUri];

            // sanity check, then set up the dig.
            if (!!thumbUri && !!thumbUri.substring && !!zoomPageUri && !!zoomPageUri.substring) {
                this.setUpOutput(thumbUri, startingOutputId + i);
                diggingBatch.push(this.digDeep(thumbUri, zoomPageUri));     
            }     
        }

        // Execute all the Promises together. They must all resolve, or
        // it'll kill the whole batch.
        return (
            Promise.all(diggingBatch)
            .then((pairs) => {
                return this.harvestBatch(pairs);
            }).catch((err) => {
                return this.logDiggingErrorsAndContinue(err);
            })
        );
    }


    /**
     * Take the results from the digDeep() promises and integrate them into the 
     * harvestedUriMap. Skip any nulls or duplicate zoomUris. Resolve with a dummy value.
     * What's important is that we resolve.
     */
    harvestBatch(uriPairs) {
        for (var i = 0; i < uriPairs.length; i++) {
            var uriPair = uriPairs[i];

            // Do some sanity checks. 
            if (!uriPair || uriPair === null) {
                this.log.log('Called to harvest a null uriPair. Skipping... ')
                continue;
            }
            
            // Add the new pair to the map, but don't duplicate zoom item uris.
            if (!!uriPair.thumbUri && !!uriPair.zoomUri) {
                if (Object.values(this.harvestedUriMap).indexOf(uriPair.zoomUri) == -1) {
                    this.harvestedUriMap[uriPair.thumbUri] = uriPair.zoomUri;
                }
            }
        }
        
        // Resolve. The value is unimportant in this code rev, however.
        return Promise.resolve();
    }


    /**
     * Put the thumbUri into the xhr tracking array, and give it an entry
     * in the popup's list UI.
     */
    setUpOutput(thumbUri, id) {
        this.outputIdMap[thumbUri] = id;
        this.output.addNewEntry(id, thumbUri);
    }


    /**
     * Log any errors that killed the batch. This is relatively catastrophic,
     * as it means BATCH_SIZE number of digs were killed. 
     */
    logDiggingErrorsAndContinue(errorMessages) {
        var diggingErrors = 
            (errorMessages && errorMessages.length) ?
            [].concat(errorMessages) :
            [errorMessages];
        var me = this;

        diggingErrors.forEach((diggingError) => {
            me.log.log('Batch-stopping error: ' + diggingError);
        });

        // Resolve. The value is unimportant in this rev.
        return Promise.resolve({});
    }


    /**
     * Take the passed-in map, and add all the src->uri mappings in from to
     * said passed-in map. Set up the other tracking and ui needed. 
     * UPDATES THE "to" AND "ids" MAPS IN-PLACE!
     */
    mergeGalleryMaps(from, to, ids) {
        var fromKeys = Object.keys(from);
        var nextId = fromKeys.length + Object.keys(to).length;

        to = Object.assign(to, from);
    }


    /**
     * Add a thumb -> zoom to a map, skipping duplicate entries for a given
     * thumb.
     */
    addToMap(thumbUrl, linkUrl, map) {
        var thumbUri = thumbUrl.href;
        var zoomUri = linkUrl.href;

        // Create entries in the gallery map, the XHR tracking array, and the UI.
        if (Utils.exists(thumbUri) && Utils.exists(zoomUri)) {
            if (!Logicker.isKnownBadImg(zoomUri)) {
                this.log.log(
                    ' Adding to map:\n' + 
                    '         thumbUri: ' + thumbUri + '\n' + 
                    '         zoomUri:  ' + zoomUri + C.ST.E
                );

                // Create the associations, but do not add duplicates.
                if (thumbUri in map) {
                    return;
                }
                else {
                    var newId = Object.keys(map).length;
                    map[thumbUri] = zoomUri;                        
                    this.outputIdMap[thumbUri] = newId;
                    this.output.addNewEntry(newId, thumbUri);
                }
            }
        }
    }


    /**
     * Find the uri that might be gone to if the element was clicked, whether it is the
     * target, or some ancestor is the target. 
     * spec is like: { selector: 'img', keyPropPath: 'parentElement.src', altKeyPropPath: 'currentSrc' }
     */
    getClickUriMap(node, loc, spec) {
        // Throw errors if no node (usually document) or loc.
        if (!node || !loc || !node.querySelectorAll || !loc.origin) {
            this.log.log('Cannot build gallery click-map without both node and location.');
            return {};
        }

        // Use defaults if not passed in a full spec. Note clickProps are rarely passed in.
        if (!spec.selector) { 
            spec.selector = C.DEF_SEL.DEFAULT_SELECTOR; 
        }
        if (!Array.isArray(spec.propPaths) || !spec.propPaths.length) { 
            spec.propPaths = C.DEF_SEL.PROP_PATHS; 
        }
        if (!spec.clickProps) { 
            spec.clickProps = C.DEF_SEL.CLICK_PROPS; 
        }

        // Amass the possible thumbnails (the subjects of the search).
        var subjects = node.querySelectorAll(spec.selector);
        var clickMap = {};
        var me = this;

        // Decide whether or not this subject is a real thumbnail image.
        this.log.log('Found ' + subjects.length + ' possible thumbnails.');
        subjects.forEach((tag) => {
            // Use the first propPath in the array which works. They are in 
            // priority order.  
            var src = C.ST.E;
            spec.propPaths.forEach((propPath) => {
                if (!!src) { return; }

                var value = Logicker.extractUrl(tag, propPath, loc);
                if (!!value && !!value.href) {
                    src = value.href;
                }
            });
            if (!src) {
                me.log.log('No src found for tag.'); 
                return; 
            }

            if (Logicker.isKnownBadImg(src)) {
                me.log.log('Skipping known bad src: ' + src);
                return;
            }

            // Iterate through parent elements up the DOM until we find one that
            // has at least one clickable prop on it. It itself might even be clickable.
            // also check to make sure there isn't a link inside this tag. It's a
            // new trick.
            var iterator = tag.firstElementChild ? tag.firstElementChild : tag;
            var foundClickProps = [];            
            while (foundClickProps.length === 0 && !(typeof iterator === 'undefined' || iterator === null || !iterator)) {
                // Are any of the CLICK_PROPS present on the iterator element? If so, we
                // probably have the link.
                for (var i = 0; i < spec.clickProps.length; i++) {
                    var val = iterator[spec.clickProps[i]];

                    if (typeof val !== 'undefined' && !!val && val !== null) {
                        foundClickProps.push(spec.clickProps[i]);
                    }                    
                }
                
                // End the loop once we've found a click prop value. 
                if (foundClickProps.length !== 0) { break; };
                  
                // Otherwise, iterate up the DOM.
                iterator = iterator.parentElement;                
            }            
            if (!iterator || iterator === null || foundClickProps.length === 0) { return; };

            // For each click prop on the iterator, try to get a URI from it.
            var uris = [];                        
            for (var j = 0; j < foundClickProps.length; j++) {
                var url = Logicker.extractUrl(iterator, foundClickProps[j], loc);
                if (!!url && !!url.href) { uris.push(url.href); };
            }
            if (uris.length === 0) { return; };

            // Figure out which of the URIs is the best.
            var bestUri = uris[0]; 
            for (var k = 1; k < uris.length; k++) {
                var bestUri = Logicker.chooseBetterMatchingUri(src, bestUri, uris[k]);
            }

            // Do a sanity check.
            if (!Utils.isSupportedMediaUri(bestUri)) {
                me.log.log(
                    ' Rejecting "bestUri" as it is an unsupported media type.\n' +
                    '         bestUri -> ' + bestUri + C.ST.E
                )
                return;
            } 
            
            // Log that we're adding a new pair.
            me.log.log(
                ' New pair added to gallery click-map:\n' +
                '         thumbSrc: ' + src + '\n' +
                '         zoomPage: ' + bestUri + C.ST.E
            );

            // Add this pair's full URLs to the map and the Output.
            var thumbUrl = new URL(src);
            var linkUrl = new URL(bestUri);
            me.addToMap(thumbUrl, linkUrl, clickMap);
        });

        return clickMap;
    }


    /**
     * Build a gallery map based upon multiple calls to getClickUriMap(), which 
     * Finds what navigation action will happen if clicking on the image's area.
     */
    buildGalleryMap(doc, loc) {
        // Start with <img> tags.
        var imgMap = this.getClickUriMap(
            doc,
            loc,
            { 
                selector: 'img', 
                propPaths: ['src', 'currentSrc', 'srcset', 'dataset.src'], 
            }
        );

        // Also try <div>s and <span>s with css background-images.
        var cssBgMap = this.getClickUriMap(
            doc,
            loc,
            { 
                selector: 'div,span', 
                propPaths: ['style.backgroundImage', 'style.background', 'dataset.lazy']
            }
        );

        var galleryMap = Object.assign({}, imgMap, cssBgMap);        
        return galleryMap;
    }        


    /**
     * Find all the "full-sized"/"zoomed" media on zoom pages, as indicated by a 
     * galleryMap (thumbUri -> zoomPageUri).
     */
    discoverGallery(doc, loc) {
        // Make a map of all the <img> srcs contained in <a> tags. Sort it as thumbUri -> linkUri.
        // If the Digger got us stuff, there will already be some entries. Merge them in.
        var galleryMap = {};
        this.outputIdMap = {};

        if (this.digOpts.doScrape !== false) {
            galleryMap = this.buildGalleryMap(doc, loc);
        }

        // This merges, and also manages the Output entries.
        if (!!this.startingGalleryMap && !!Object.keys(this.startingGalleryMap).length) {
            galleryMap = Object.assign({}, this.startingGalleryMap, galleryMap);
        }

        // Begin digging, or stop if instructed to.
        if (this.digOpts.doDig === false) {
            this.log.log('Instructed to not dig. Responding with discovered URIs.')
            return Promise.resolve(galleryMap);
        }
        else {
            return this.digGalleryBatches(galleryMap);
        }  
    }


    /**
     * Update the UI and that we dug a zoomUri. 
     */
    recordDigResult(thumbUri, zoomedImgUri, isFailure) {
        var id = this.outputIdMap[thumbUri];

        this.log.log(
            ' Zoomed image reported.\n' +
            '         thumbUri: ' + thumbUri + '\n' +
            '         zoomedImgUri: ' + zoomedImgUri + C.ST.E
        );

        // Set the entry as failed or dug.
        if (isFailure) {
            this.output.setEntryAsFailed(id, zoomedImgUri || '[failed]');
        }
        else {
            this.output.setEntryAsDug(id, zoomedImgUri);
        } 
        
        // Update the out text and the badge.
        this.output.toOut('Completed ' + (++this.completedXhrCount) + ' media fetches...');
        chrome.browserAction.setBadgeText({ text: C.ST.E + this.completedXhrCount + C.ST.E });
        chrome.browserAction.setBadgeBackgroundColor(C.COLOR.NEWLY_DUG);
    }


    /**
     * Syntactic sugar for completing XHR successfully with the proper "full-size" media item.
     */
    reportDigSuccess(thumbUri, zoomUri) {
        this.recordDigResult(thumbUri, zoomUri);
        return new UriPair(thumbUri, zoomUri);
    }


    /**
     * Syntactic sugar for completing the XHR without finding a suitable "full-size" media item. 
     */
    reportDigFailure(thumbUri, zoomUri) {
        this.recordDigResult(thumbUri, zoomUri, true);
        return null;
    }


    /**
     * Find all the clicked-through (hopefully) large versions of images on pic detail page.
     * Do it by finding all the 'a img' selecteds, and then grabbing the document specified by
     * the <a> -- this is queried for any <img> with a similar filename to the supposed "thumbnail".
     */
    digGallery(config) {
        var doc = config.doc;
        var loc = config.loc;

        this.digOpts = config.digOpts;
        this.startingGalleryMap = config.galleryMap;
        this.harvestedUriMap = {};
        this.outputIdMap = {};

        if (this.digOpts.doScrape) {
            return this.discoverGallery(doc, loc);
        }
        else if (this.digOpts.doDig === false) {
            return this.digGalleryBatches(this.startingGalleryMap);
        }
        else {
            return this.discoverGallery(doc, loc)
        }
    };


    /**
     * A second way of digging, using Utils.loadUriDoc() to construct the whole document via an 
     * iframe. It is way more expensive and way slower, but allows full client-side rendering before 
     * we attempt to process the document.
     * This one *does* reject.
     */
    digDeeper(thumbUri, zoomPageUri, searchDepth) {
        if (searchDepth >= C.SEARCH_DEPTH.DIG_DEEPER) { searchDepth = C.SEARCH_DEPTH.DIG_DEEPER - 1; };

        // Validate URIs exist, and the zoomPageUri is of a fetchable protocol.
        if (!Utils.exists(thumbUri) || !Utils.exists(zoomPageUri) || !Utils.isFetchableUri(zoomPageUri)) {
            this.log.log(
                ' Cannot dig due missing/unfetchable URIs. [' + 
                (thumbUri || '-blank-') + ', ' + 
                (zoomPageUri || '-blank-') + ']'
            );

            return Promise.reject('Trying to digDeeper Bad URIs');
        }

        // Extract filenames for better output messages. 
        var thumbFilename = Utils.extractFilename(thumbUri);
        var zoomFilename = Utils.extractFilename(zoomPageUri);

        // Resolve if we can tell the zoom page URI points directly to media.
        if (Utils.isKnownMediaFileOrEndpoint(zoomPageUri)) {
            this.output.toOut('Found direct link to media: ' + zoomFilename);
            return Promise.resolve(new UriPair(thumbUri, zoomPageUri));
        }
        
        // Construct the ID used by loadUriDoc() to identify the <iframe>
        var uriDocId = zoomFilename.substring('id' + zoomFilename.substring(0, zoomFilename.indexOf(C.ST.DOT)));  
        this.log.log('uriDocId: ' + uriDocId);
        this.output.toOut('Finding zoom-item for thumbnail named ' + thumbFilename + C.ST.E);

        // Load the document and process it. Either resolve with the pair, or reject. digDeeper()
        // can safely reject, as it is the final attempt to look at the zoom page.
        var p = Utils.loadUriDoc(zoomPageUri, uriDocId)
        .then((doc) => {
            this.log.log('Digger loaded doc: ' + zoomPageUri);
            this.output.toOut('Loaded document ' + zoomFilename);
            
            return this.processZoomPage(doc, new URL(thumbUri), new URL(zoomPageUri), searchDepth);
        })
        .then((pair) => {
            return Promise.resolve(pair);
        })
        .catch((e) => {
            this.log.log('digDeeper iframe-load error: ' + JSON.stringify(e));       
            return Promise.reject(e);
        });

        return p;
    };


    /**
     * Use a HEAD request to resolve what Content-Type the gallery link points to. If it points to a media file, 
     * we're done looking. If it points to a document, then call processZoomPage() to look more closely for
     * the zoom-item.
     * 
     * Dig successes and failures are *only* reported in this function.
     */
    digDeep(thumbUri, zoomPageUri, searchDepth) {
        // Validate URIs exist, and the zoomPageUri is of a fetchable protocol.
        if (!Utils.exists(thumbUri) || !Utils.exists(zoomPageUri) || !Utils.isFetchableUri(zoomPageUri)) {
            this.log.log(
                ' Cannot dig due missing/unfetchable URIs. [' + 
                (thumbUri || '-blank-') + ', ' + 
                (zoomPageUri || '-blank-') + ']'
            );

            return Promise.resolve(this.reportDigFailure(thumbUri, zoomPageUri));
        }
        
        // Extract the filenames for better output.
        var thumbFilename = Utils.extractFilename(thumbUri);
        var zoomFilename = Utils.extractFilename(zoomPageUri);            

        this.output.toOut('Finding zoom-media for thumbnail named ' + thumbFilename + C.ST.E);
        this.log.log('working on ' + zoomPageUri);

        // Do a HEAD request XHR to discover the content-type of the zoom-page. Either it is
        // media, and we resolve with it, it is an HTML doc and we process it, or skip it if
        // it's something unknown.
        //
        // Catch *all* reject()s here. Always resolve(). Otherwise, we'll break the promise chain.
        var p = Utils.sendXhr('HEAD', zoomPageUri)
        .then((xhr) => {
            if (this.stop === true) {
                return Promise.reject(C.ACTION.STOP);
            }
            
            var mimeType = new String(xhr.getResponseHeader('content-type'));

            // Report anything other than HTML documents as found media.
            if (mimeType.indexOf(C.DOC_TYPE.HTML) !== -1) {
                this.output.toOut('Found image detail page ' + zoomFilename);
                
                return (
                    this.processZoomPage(false, new URL(thumbUri), new URL(zoomPageUri), searchDepth)
                    .then((pair) => {
                        return Promise.resolve(pair);
                    })
                );
            } 
            else if (Utils.isKnownMediaMimeType(mimeType)) {
                this.output.toOut('Found media ' + zoomFilename);
                return Promise.resolve(new UriPair(thumbUri, zoomPageUri));
            }
            else {
                return Promise.reject('Unknown Content-type ' + mimeType);
            }
        })
        .then((pair) => {
             // Double-check that we got a good result before reporting success.
            if (Utils.isKnownMediaFileOrEndpoint(pair.zoomUri)) {
                return this.reportDigSuccess(pair.thumbUri, pair.zoomUri);
            }
            else {
                this.log.log('Zoomed "image" was actually not a known media type. Not harvesting.');
                return this.reportDigFailure(pair.thumbUri, pair.zoomUri);
            }
        })
        .catch((errorMessage) => {
            this.log.log('digDeep error: ' + errorMessage);
            return Promise.resolve(this.reportDigFailure(thumbUri, zoomPageUri));
        });

        return p;
    };


    /**
     * XHR 'GET' the zoom page if we weren't passed it, then apply search methods
     * from least-intensive -> most intensive til we find something. Variable depth
     * search, defaults to trying every strategy in the app.
     */
    processZoomPage(inDoc, thumbUrl, zoomPageUrl, searchDepth) {
        if (!searchDepth) { searchDepth = C.SEARCH_DEPTH.DIG_DEEPER; };

        var zoomFilename = Utils.extractFilename(zoomPageUrl.href);                    
        var errors = [];
        var startingPromise = Promise.resolve({});
        var doc = inDoc;
        var me = this;

        // Get the doc if it was null, starting the promise chain. 
        if (!doc || doc === null) {
            startingPromise = 
                Utils.getXhrResponse(C.ACTION.GET, zoomPageUrl.href, C.DOC_TYPE.DOC)
                .catch((e) => {
                    if (e === C.ACTION.STOP) {
                        me.log.log(`Got STOP event. Not loading zoomPageUrl "${ zoomPageUrl.href }" for thumbnail "${ thumbUrl.href }".`);
                        return Promise.resolve(me.galleryMap);
                    }

                    me.log.log('processZoomPage xhr error: ' + JSON.stringify(e));
                    return Promise.resolve(e);
                });
        }

        // -Chain description-
        // Apply search methods from simplest (fastest) -> hardest (longest).
        // This is primarily a regection-based chain. 
        // Each step is executed only on the previous step's failure.
        // Each step is executed only if searchDepts says to go that deep.
        // Each step pushes the previous step's error into errors[].

        // 1 - Skim the document for low-hanging fruit.
        var p = startingPromise.then((d) => {
            if (!d || !d.querySelectorAll) {
                me.log.log('Processing started with error');
                return Promise.resolve(null);
            }
            else {
                doc = d;
                this.output.toOut('Skimming ' + zoomFilename);                        
                return this.skimZoomPage(doc, thumbUrl);
            }
        })
        // 2 - Look for the largest image
        .catch((previousError) => {
            errors.push(previousError);
            if (searchDepth < C.SEARCH_DEPTH.LARGEST_IMAGE) { return Promise.resolve(null); };
            if (this.inspectionOptions.imgs !== true) { return Promise.reject('Not looking for images'); };
            
            this.output.toOut('Looking for the largest Image on ' + zoomFilename);
            return Logicker.getPairWithLargestImage(thumbUrl.href, doc);
        })
        // 3 - Use document inspection, using each options-defined type of scrape.
        .catch((previousError) => {
            errors.push(previousError);                        
            if (searchDepth < C.SEARCH_DEPTH.INSPECT) { return Promise.resolve(null); };

            this.output.toOut('Inspecting all media on ' + zoomFilename);
            return this.inspectZoomPage(doc, thumbUrl, zoomPageUrl);                    
        })
         // 4 - Use TensorFlow's Mobilenet pre-trained ML model.
        .catch((previousError) => {
            errors.push(previousError);
            if (searchDepth < C.SEARCH_DEPTH.TF_MATCH) { return Promise.resolve(null); }

            return Logicker.tfClassificationMatch(thumbUrl.href, doc);
        })
        // 5- Iterate again, using Plan B. digDeeper() uses an iframe, so client-side rendering runs.
        .catch((previousError) => {
            errors.push(previousError);                        
            if (searchDepth < C.SEARCH_DEPTH.DIG_DEEPER) { return Promise.resolve(null); };

            this.output.toOut('Checking ' + zoomFilename + ' a second way');
            return this.digDeeper(thumbUrl.href, zoomPageUrl.href, (C.SEARCH_DEPTH.DIG_DEEPER - 1));
        })
        // Pair Found - Resolve with that pair.
        .then((pair) => {
            if (!pair || pair === null) {
                return Promise.reject('Invalid pair');
            }
            else {
                return Promise.resolve(pair);
            }
        })
        // No Pair - Log errors[], resolve with null.
        .catch((previousError) => {
            errors.push(previousError);

            // Reject with the combined error messages.
            var combinedMessage = errors.reduce(
                (previousMessage, errorMessage) => {
                    return previousMessage + '\n         ' + errorMessage;
                }, 
                ' No processing result for ' + zoomPageUrl.href
            );

            return Promise.reject(combinedMessage);
        });

        return p;
    }


    /**
     * Skim through the zoom page for low-hanging fruit.
     * reject if nothing is found.
     * TODO: Put more here. 
     */
    skimZoomPage(doc, thumbUrl) {
        // First look in the special rules for a strategy that's already 
        // been figured out by this. See if we can just get the Uri from there.
        var blessedZoomUri = Logicker.findBlessedZoomUri(doc, thumbUrl.href);                    
        if (!!blessedZoomUri) {
            this.log.log('Found blessed full-size uri: ' + blessedZoomUri);
            return Promise.resolve(new UriPair(thumbUrl.href, blessedZoomUri));
        }
        else if (this.inspectionOptions.imgs && doc.images.length === 1) {
            return Promise.resolve(new UriPair(thumbUrl.href, doc.images[0].src));
        }

        // TODO: Create more skim-worthy search strategies.        
        return Promise.reject('Skimming found nothing');
    }

    
    /**
     * inspect the zoom page imgs, cssBgs, videos, audios, js, Qs vals to find 
     * whatever zoom media item we can for the gallery thumb.
     */
    inspectZoomPage(doc, thumbUrl, zoomPageUrl) {
        var zoomUri = false;        
        var me = this;
        this.output.toOut('Searching through media on ' + Utils.extractFilename(zoomPageUrl.href));

        // For each enabled investigation option, try to find the zoom media item.
        Object.keys(this.inspectionOptions).forEach((optName) => {
            if (!!zoomUri) { return; };

            if (this.inspectionOptions[optName] === true) {
                zoomUri = me.findZoomUri(doc, thumbUrl, zoomPageUrl, optName);
            }
        });

        // Resolve if we found something that works. Otherwise, reject.
        if (!!zoomUri) {
            return Promise.resolve(new UriPair(thumbUrl.href, zoomUri));     
        }
        else {
            this.output.toOut('Inspection found nothing good on ' + Utils.extractFilename(zoomPageUrl.href));
            this.log.log('Inspection found nothing good on ' + Utils.extractFilename(zoomPageUrl.href));
            return Promise.reject('Inspection found no zoom-item on ' + zoomPageUrl.href);
        }
    }


    /**
     * Try to find the pointed-to media item in the document corresponding to the thumb. 
     */
    findZoomUri(d, tUrl, zpUrl, optionName) {
        if (!d && !tUrl && !zpUrl && !optionName) {
            return Promise.reject(' findZoomUri called with bad arguments. Skipping.');
        }

        var findMediaUris = this.SCRAPING_TOOLS[optionName] || (function() { return []; });
        var urls = findMediaUris(d, { href: zpUrl.href });
        var zUri = false;

        this.output.toOut('Sifting through ' + optionName + ' content on detail page.');
        this.log.log('Sifting through ' + optionName + ' content on ' + Utils.extractFilename(zpUrl.href));

        // If this is the only option enabled, and there's only one type of the media on the document, 
        // use it.
        if (this.isSoleOption(optionName) && urls.length === 1) {
            zUri = urls[0].href;
        }
        // Otherwise, use the Logicker's filename-matching on each object we find. Use the first match.
        else {
            urls.forEach((url) => {
                if (!!zUri) { return; };

                if (Utils.exists(url) && url.pathname) {
                    if (optionName === C.DS_KEY.VIDEOS && urls.length === 1) {
                        zUri = url.href;
                    }                                    
                    else if (Logicker.isPossiblyZoomedFile(tUrl, url)) {
                        zUri = url.href;
                    }
                }
            });
        }

        return zUri;
    }


    /**
     * Stop digging batches and just return what's already been harvested. All the functionality
     * of the stop flag is inside digNextBatchLink(...).
     */
    stopHarvesting() {
        this.stop = true;
    };


    /*
     * Set the gallerygallerydig batch size from the options.
     */
    static setBatchSize(size) {
        console.log(C.LOG_SRC.DIGGER + 'Attempt to set BATCH_SIZE to ' + size);

        if (!!size) {
            var numSize = parseInt(size+C.ST.E, 10);
    
            if (!isNaN(numSize)) {
                Digger.BATCH_SIZE = numSize;
                console.log(C.LOG_SRC.DIGGER + 'Successfully set BATCH_SIZE to ' + numSize + C.ST.E);
            }
        }
    }


    /*
     * Set the gallerygallerydig number of channels from the options.
     */
    static setChannels(size) {
        console.log(C.LOG_SRC.DIGGER + 'Attempt to set CHANNELS to ' + size);

        if (!!size) {
            var numSize = parseInt(size+C.ST.E, 10);

            if (!isNaN(numSize)) {
                Digger.CHANNELS = numSize;
                console.log(C.LOG_SRC.DIGGER + 'Successfully set CHANNELS to ' + numSize + C.ST.E);
            }
        }
    }
}

if (!window.hasOwnProperty(C.WIN_PROP.DIGGER_CLASS) && Utils.isBackgroundPage(window)) {
    window[C.WIN_PROP.DIGGER_CLASS] = Digger;
}

// export.
export default Digger;