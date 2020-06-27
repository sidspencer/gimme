import { default as Scraper } from './Scraper.js';
import { default as Output } from './Output.js';
import { default as Logicker } from './Logicker.js';
import { default as Utils } from './Utils.js';


// Options for what kind of scraping we do.
const OPT = {
    IMGS: 'imgs',
    CSS_BGS: 'cssBgs',
    VIDEOS: 'videos',
    JS: 'js',
    AUDIOS: 'audios',
    QS: 'qs',
};

// Options for how many heuristics to use when searching.
const SEARCH_DEPTH = {
    SKIM: 1,
    LARGEST_IMAGE: 2,
    INSPECT: 3,
    TF_MATCH: 4,
    DIG_DEEPER: 5,
};

// These CLICK_PROPS are in priority order of which to pay attention to.
const DEAULT_CLICK_PROPS = [ 'onclick', 'href' ];
const DEFAULT_PROP_PATHS = [ 'src', 'href', 'currentSrc' ];
const DEFAULT_SELECTOR = ':scope *';

/** 
 * Factory Function.
 * Worker bee for GimmeGimmieGimmie. Looks through various types of linked media, returns
 * the URLs to the popup.
 */
class Digger {
    // instance object
    me = {
        startingGalleryMap: {},
        
        scraper: undefined,
        output: undefined,
        logicker: undefined,
        utils: undefined,
        options: undefined,

        digOpts: { 
            doScrape: true, 
            doDig: true 
        },

        harvestedUriMap: {},
        outputIdMap: {},
        
        completedXhrCount: 0,
        batchCount: 0,
        soleInspectionOption: false,
    };

    // aliases
    u = undefined;

    // Map of scrape OPT to the scraper method for working with that OPT.
    SCRAPING_TOOLS = {};
 
    constructor(Scraper, Output, Logicker, Utils, Options) {
        this.me.scraper = Scraper;
        this.me.output = Output;
        this.me.logicker = Logicker;
        this.me.options = Options;
        this.u = Utils;

        this.setupOptions();
        this.setupScrapingTools();
    }


    /**
     * Fill out the SCRAPING_TOOLS object to point to the right scraper methods for all the
     * scrape options. Called by constructor.
     */
    setupScrapingTools() {
        this.SCRAPING_TOOLS[OPT.IMGS] = this.me.scraper.getAllImgUrls;
        this.SCRAPING_TOOLS[OPT.CSS_BGS] = this.me.scraper.getAllCssBackgroundUrls;
        this.SCRAPING_TOOLS[OPT.VIDEOS] = this.me.scraper.getAllVideoUrls;
        this.SCRAPING_TOOLS[OPT.AUDIOS] = this.me.scraper.getAllAudioUrls;
        this.SCRAPING_TOOLS[OPT.JS] = this.me.scraper.getAllJsUrls;
        this.SCRAPING_TOOLS[OPT.QS] = this.me.scraper.getAllQsUrls;  
    }


    /**
     * If we were not passed in options of which assets to search, make the default search options here.
     * Also see if there's only one inspection option. This is Called by constructor.
     */
    setupOptions() {
        if (!this.me.options) {
            for (var o in this.OPT) {
                this.me.options[o] = true;
            }
        }
        else {
            // Check if we only have 1 option enabled.
            this.me.soleInspectionOption = Object.keys(this.me.options).reduce(
                (soleOpt, optName) => {
                    return soleOpt + (this.me.options[optName] ? optName : '');
                }, 
                ''
            );
        }
    }


    /**
     * Is this the only inspection option? 
     */
    isSoleOption(optName) {
        return (optName === this.me.soleInspectionOption);
    }


    /**
     * Promise to resolve everything that has been dug.
     */
    resolveDigHarvest(uriMap) {
        var h = uriMap;

        return (new Promise((resolve, reject) => {
            chrome.storage.local.set({
                    prevUriMap: h,
                },
                () => {                    
                    console.log('[Digger] Set prevUriMap in storage');
                    console.log('[Digger] ---Returning dig harvest -> ' + Object.keys(h).length + '------');
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
        this.me.output.clearFilesDug();
        var dir = this.u.getSaltedDirectoryName();

        var idx = 0;
        for (var thumbUri in uriMap) { 
            var uri = uriMap[thumbUri];
            var queryPos = uri.lastIndexOf('?');

            if (queryPos === -1) {
                queryPos = uri.length;
            }

            this.me.outputIdMap[thumbUri] = idx;
                        
            this.me.output.addFileOption({ 
                id: (idx++), 
                uri: uri, 
                thumbUri: thumbUri,
                filePath: dir + '/' + uri.substring(uri.lastIndexOf('/'), queryPos),
                onSelect: this.u.downloadFile, 
            });
        }

        chrome.browserAction.setBadgeText({ text: '' + idx + '' });
        chrome.browserAction.setBadgeBackgroundColor({ color: [247, 81, 158, 255] });
    }


    /**
     * Recursive wrapper around digNextBatch()
     */
    digNextBatchLink(galleryMap) {
        if (Object.keys(galleryMap).length > 0) {
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
        var subMaps = [];
        var thumbUris = Object.keys(galleryMap);
        var thumbsPerChannel = Math.floor(thumbUris.length / (Digger.prototype.CHANNELS - 1)) || 1;

        console.log('[Digger] Digging ' + thumbUris.length + ' scraped thumbnails.');
        this.me.output.toOut('Now digging ' + thumbUris.length + ' thumbnails found in gallery.');
        
        // Make the submaps, build the promise chains.
        while (thumbUris.length > 0) {
            var subMap = {};

            for (var j = 0; j < thumbsPerChannel && thumbUris.length > 0; j++) {
                var thumbUri = thumbUris.pop();
                subMap[thumbUri] = '' + galleryMap[thumbUri];
                delete galleryMap[thumbUri];
            }

            promises.push(this.digNextBatchLink(subMap));
        }
        
        // Note, all these promises must resolve, or it'll kill the whole batch.
        return Promise.all(promises).then((uriMap) => { 
            return Promise.resolve(this.me.harvestedUriMap); //this.resolveDigHarvest(this.me.harvestedUriMap); 
        }).catch((err) => { 
            console.log('[Digger] Caught error in Promise.all() for resolving dig harvest. ' + JSON.stringify(err));
            return Promise.resolve(this.me.harvestedUriMap); //this.resolveDigHarvest(this.me.harvestedUriMap); 
        });  
    }  


    /**
     * Build and execute the next batch of digDeep() promises. 
     */
    digNextBatch(galleryMap) {
        var diggingBatch = [];
        var startingOutputId = (++this.me.batchCount) * Digger.prototype.BATCH_SIZE;

        // Set up the output entry, and enter the uriPair's digDeep() execution
        // into the promise batch's array. Skip nulls. 
        var allThumbUris = Object.keys(galleryMap);    
        for (var i = 0; i < Digger.prototype.BATCH_SIZE && allThumbUris.length > 0; i++) {
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

            if (!uriPair || uriPair === null) {
                continue;
            }
            
            // Add the new pair to the map, but don't duplicate zoom item uris.
            if (uriPair.thumbUri && uriPair.zoomUri) {
                if (Object.values(this.me.harvestedUriMap).indexOf(uriPair.zoomUri) == -1) {
                    this.me.harvestedUriMap[uriPair.thumbUri] = uriPair.zoomUri;
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
        this.me.outputIdMap[thumbUri] = id;
        this.me.output.addNewEntry(id, thumbUri);
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

        diggingErrors.forEach((diggingError) => {
            console.log('[Digger] Batch-stopping error: ' + diggingError);
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
        if (this.u.exists(thumbUri) && this.u.exists(zoomUri)) {
            if (!this.u.isBannedZoomUri(zoomUri)) {
                console.log(
                    '[Digger] Adding to map:\n' + 
                    '         thumbUri: ' + thumbUri + '\n' + 
                    '         zoomUri:  ' + zoomUri + ''
                );

                // Create the associations, but do not add duplicates.
                if (thumbUri in map) {
                    return;
                }
                else {
                    var newId = Object.keys(map).length;
                    map[thumbUri] = zoomUri;                        
                    this.me.outputIdMap[thumbUri] = newId;
                    this.me.output.addNewEntry(newId, thumbUri);
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
            console.log('[Digger] Cannot build gallery click-map without both node and location.');
            return {};
        }

        // Use defaults if not passed in a full spec. Note clickProps are rarely passed in.
        if (!spec.selector) { spec.selector = DEFAULT_SELECTOR; };
        if (!Array.isArray(spec.propPaths) || !spec.propPaths.length) { spec.propPaths = DEFAULT_PROP_PATHS; };
        if (!spec.clickProps) { spec.clickProps = DEAULT_CLICK_PROPS; };

        // Amass the possible thumbnails (the subjects of the search).
        var subjects = node.querySelectorAll(spec.selector);
        var clickMap = {};

        // Decide whether or not this subject is a real thumbnail image.
        console.log('[Digger] Found ' + subjects.length + ' possible thumbnails.');
        subjects.forEach((tag) => {
            // Use the first propPath in the array which works. They are in 
            // priority order.  
            var src = '';
            spec.propPaths.forEach((propPath) => {
                if (!!src) { return; }

                var value = this.me.logicker.extractUrl(tag, propPath, loc);
                if (!!value && !!value.href) {
                    src = value.href;
                }
            });
            if (!src) {
                console.log('[Digger] No src found for tag.'); 
                return; 
            }

            if (this.me.logicker.isKnownBadImg(src)) {
                console.log('[Digger] Skipping known bad src: ' + src);
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
                var url = this.me.logicker.extractUrl(iterator, foundClickProps[j], loc);
                if (!!url && !!url.href) { uris.push(url.href); };
            }
            if (uris.length === 0) { return; };

            // Figure out which of the URIs is the best.
            var bestUri = uris[0]; 
            for (var k = 1; k < uris.length; k++) {
                var bestUri = this.me.logicker.chooseBetterMatchingUri(src, bestUri, uris[k]);
            }
            
            console.log(
                '[Digger] New pair added to gallery click-map:\n ' +
                '         thumbSrc: ' + src + '\n' +
                '         zoomPage: ' + bestUri + ''
            );

            // Add this pair's full URLs to the map and the Output.
            var thumbUrl = new URL(src);
            var linkUrl = new URL(bestUri);
            this.addToMap(thumbUrl, linkUrl, clickMap);
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
        this.me.outputIdMap = {};
        var gallerySize = 0;

        if (this.me.digOpts.doScrape !== false) {
            galleryMap = this.buildGalleryMap(doc, loc);
            gallerySize = Object.keys(galleryMap).length;  
        }

        // This merges, and also manages the Output entries.
        if (!!this.me.startingGalleryMap && !!Object.keys(this.me.startingGalleryMap).length) {
            galleryMap = Object.assign({}, this.me.startingGalleryMap, galleryMap);
        }

        // Begin digging, or stop if instructed to.
        if (this.me.digOpts.doDig === false) {
            console.log('[Digger] Instructed to not dig. Responding with discovered URIs.')
            return Promise.resolve(galleryMap);
        }
        else {
            return this.digGalleryBatches(galleryMap);
        }  
    }


    /**
     * Update the UI that we dug a zoomUri. 
     */
    recordDigResult(thumbUri, zoomedImgUri, isFailure) {
        var id = this.me.outputIdMap[thumbUri];

        console.log(
            '[Digger] Zoomed image reported.\n' +
            '         thumbUri: ' + thumbUri + '\n' +
            '         zoomedImgUri: ' + zoomedImgUri + ''
        );

        if (isFailure) {
            this.me.output.setEntryAsFailed(id, zoomedImgUri || '[failed]');
        }
        else {
            this.me.output.setEntryAsDug(id, zoomedImgUri);
        } 
        
        this.me.output.toOut('Completed ' + (++this.me.completedXhrCount) + ' media fetches...');
        chrome.browserAction.setBadgeText({ text: '' + this.me.completedXhrCount + '' });
        chrome.browserAction.setBadgeBackgroundColor({ color: '#111111' });
    }


    /**
     * Syntactic sugar for completing XHR successfully with the proper "full-size" media item.
     */
    reportDigSuccess(thumbUri, zoomUri) {
        this.recordDigResult(thumbUri, zoomUri);
        return {
            thumbUri: thumbUri,
            zoomUri: zoomUri,
        };
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

        this.me.digOpts = config.digOpts;
        this.me.startingGalleryMap = config.galleryMap;
        this.me.harvestedUriMap = {};
        this.me.outputIdMap = {};

        if (this.me.digOpts.doScrape) {
            return this.discoverGallery(doc, loc);
        }
        else if (this.me.digOpts.doDig === false) {
            return this.digGalleryBatches(this.me.startingGalleryMap);
        }
        else {
            return this.discoverGallery(doc, loc)
        }
    };


    /**
     * A second way of digging, using Utils.loadUriDoc() to construct the whole document via an 
     * ifrathis.me. It is way more expensive and way slower, but allows full client-side rendering before 
     * we attempt to process the document.
     * This one *does* reject.
     */
    digDeeper(thumbUri, zoomPageUri, searchDepth) {
        if (searchDepth >= SEARCH_DEPTH.DIG_DEEPER) { searchDepth = SEARCH_DEPTH.DIG_DEEPER - 1; };

        // Validate URIs exist, and the zoomPageUri is of a fetchable protocol.
        if (!this.u.exists(thumbUri) || !this.u.exists(zoomPageUri) || !this.u.isFetchableUri(zoomPageUri)) {
            console.log(
                '[Digger] Cannot dig due missing/unfetchable URIs. [' + 
                (thumbUri || '-blank-') + ', ' + 
                (zoomPageUri || '-blank-') + ']'
            );

            return Promise.reject('Trying to digDeeper Bad URIs');
        }

        // Extract filenames for better output messages. 
        var thumbFilename = this.u.extractFilename(thumbUri);
        var zoomFilename = this.u.extractFilename(zoomPageUri);

        // Resolve if we can tell the zoom page URI points directly to media.
        if (this.u.isKnownMediaType(zoomPageUri)) {
            this.me.output.toOut('Found direct link to media: ' + zoomFilename);
            return Promise.resolve({
                thumbUri: thumbUri, 
                zoomUri: zoomPageUri
            });
        }
        
        // Construct the ID used by loadUriDoc() to identify the <iframe>
        var uriDocId = zoomFilenathis.me.substring('id' + zoomFilenathis.me.substring(0, zoomFilenathis.me.indexOf('.')));  
        console.log('[Digger] uriDocId: ' + uriDocId);
        this.me.output.toOut('Finding zoom-item for thumbnail named ' + thumbFilename + '');

        // Load the document and process it. Either resolve with the pair, or reject. digDeeper()
        // can safely reject, as it is the final attempt to look at the zoom page.
        var p = this.u.loadUriDoc(zoomPageUri, uriDocId)
        .then((doc) => {
            console.log('[Digger] Digger loaded doc: ' + zoomPageUri);
            this.me.output.toOut('Loaded document ' + zoomFilename);
            
            return this.processZoomPage(doc, new URL(thumbUri), new URL(zoomPageUri), searchDepth);
        })
        .then((pair) => {
            return Promise.resolve(pair);
        })
        .catch((e) => {
            console.log('[Digger] Load error: ' + e);                
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
        if (!this.u.exists(thumbUri) || !this.u.exists(zoomPageUri) || !this.u.isFetchableUri(zoomPageUri)) {
            console.log(
                '[Digger] Cannot dig due missing/unfetchable URIs. [' + 
                (thumbUri || '-blank-') + ', ' + 
                (zoomPageUri || '-blank-') + ']'
            );

            return Promise.resolve(this.reportDigFailure(thumbUri, zoomPageUri));
        }
        
        // Extract the filenames for better output.
        var thumbFilename = this.u.extractFilename(thumbUri);
        var zoomFilename = this.u.extractFilename(zoomPageUri);            

        this.me.output.toOut('Finding zoom-media for thumbnail named ' + thumbFilename + '');
        console.log('working on ' + zoomPageUri);

        // Do a HEAD request XHR to discover the content-type of the zoom-page. Either it is
        // media, and we resolve with it, it is an HTML doc and we process it, or skip it if
        // it's something unknown.
        //
        // Catch *all* reject()s here. Always resolve(). Otherwise, we'll break the promise chain.
        var p = this.u.sendXhr('HEAD', zoomPageUri)
        .then((xhr) => {
            var mimeType = new String(xhr.getResponseHeader('content-type'));

            // Report anything other than HTML documents as found media.
            if (mimeType.indexOf('html') !== -1) {
                this.me.output.toOut('Found image detail page ' + zoomFilename);
                
                return (
                    this.processZoomPage(false, new URL(thumbUri), new URL(zoomPageUri), searchDepth)
                    .then((pair) => {
                        return Promise.resolve(pair);
                    })
                );
            } 
            else if (this.u.isKnownMediaType(mimeType)) {
                this.me.output.toOut('Found media ' + zoomFilename);
                return Promise.resolve({
                    thumbUri: thumbUri,
                    zoomUri: zoomPageUri,
                });
            }
            else {
                return Promise.reject('Unknown Content-type ' + mimeType);
            }
        })
        .then((pair) => {
            return this.reportDigSuccess(pair.thumbUri, pair.zoomUri);
        })
        .catch((errorMessage) => {
            console.log('[Digger] digDeep error: ' + errorMessage);
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
        if (!searchDepth) { searchDepth = SEARCH_DEPTH.DIG_DEEPER; };

        var zoomFilename = this.u.extractFilename(zoomPageUrl.href);                    
        var errors = [];
        var startingPromise = Promise.resolve({});
        var doc = inDoc;

        // Get the doc if it was null, starting the promise chain. 
        if (!doc || doc === null) {
            startingPromise = 
                this.u.getXhrResponse('GET', zoomPageUrl.href, 'document')
                .catch((e) => {
                    console.log('[Digger] processZoomPage xhr error: ' + e)
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
                console.log('[Digger] Processing started with error');
                return Promise.resolve(null);
            }
            else {
                doc = d;
                this.me.output.toOut('Skimming ' + zoomFilename);                        
                return this.skimZoomPage(doc, thumbUrl, zoomPageUrl);
            }
        })
        // 2 - Look for the largest image
        .catch((previousError) => {
            errors.push(previousError);
            if (searchDepth < SEARCH_DEPTH.LARGEST_IMAGE) { return Promise.resolve(null); };
            if (this.me.options.imgs !== true) { return Promise.reject('Not looking for images'); };
            
            this.me.output.toOut('Looking for the largest Image on ' + zoomFilename);
            return this.me.logicker.getPairWithLargestImage(thumbUrl.href, doc);
        })
        // 3 - Use document inspection, using each options-defined type of scrape.
        .catch((previousError) => {
            errors.push(previousError);                        
            if (searchDepth < SEARCH_DEPTH.INSPECT) { return Promise.resolve(null); };

            this.me.output.toOut('Inspecting all media on ' + zoomFilename);
            return this.inspectZoomPage(doc, thumbUrl, zoomPageUrl);                    
        })
         // 4 - Use TensorFlow's Mobilenet pre-trained ML model.
        .catch((previousError) => {
            errors.push(previousError);
            if (searchDepth < SEARCH_DEPTH.TF_MATCH) { return Promise.resolve(null); }

            return this.me.logicker.tfClassificationMatch(thumbUrl.href, doc);
        })
        // 5- Iterate again, using Plan B. digDeeper() uses an iframe, so client-side rendering runs.
        .catch((previousError) => {
            errors.push(previousError);                        
            if (searchDepth < SEARCH_DEPTH.DIG_DEEPER) { return Promise.resolve(null); };

            this.me.output.toOut('Checking ' + zoomFilename + ' a second way');
            return this.digDeeper(thumbUrl.href, zoomPageUrl.href, (SEARCH_DEPTH.DIG_DEEPER - 1));
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

            // Log it all to the console. 
            var combinedMessage = errors.reduce(
                (previousMessage, errorMessage) => {
                    return previousMessage + '\n         ' + errorMessage;
                }, 
                '[Digger] No processing result for ' + zoomPageUrl.href
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
    skimZoomPage(doc, thumbUrl, zoomPageUrl) {
        // First look in the special rules for a strategy that's already 
        // been figured out by this.me. See if we can just get the Uri from there.
        var blessedZoomUri = this.me.logicker.findBlessedZoomUri(doc, thumbUrl.href);                    
        if (!!blessedZoomUri) {
            console.log('[Digger] Found blessed full-size uri: ' + blessedZoomUri);
            return Promise.resolve({
                thumbUri: thumbUrl.href, 
                zoomUri: blessedZoomUri,
            });
        }
        else if (this.me.options.imgs && doc.images.length === 1) {
            return Promise.resolve({
                thumbUri: thumbUrl.href,
                zoomUri: doc.images[0].src,
            });
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
        this.me.output.toOut('Searching through media on ' + this.u.extractFilename(zoomPageUrl.href));

        // For each enabled investigation option, try to find the zoom media item.
        Object.keys(this.me.options).forEach((optName) => {
            if (!!zoomUri) { return; };

            if (this.me.options[optName] === true) {
                zoomUri = this.findZoomUri(doc, thumbUrl, zoomPageUrl, optName);
            }
        });

        // Resolve if we found something that works. Otherwise, reject.
        if (!!zoomUri) {
            return Promise.resolve({
                thumbUri: thumbUrl.href,
                zoomUri: zoomUri
            });            
        }
        else {
            this.me.output.toOut('Inspection found nothing good on ' + this.u.extractFilename(zoomPageUrl.href));
            console.log('[Digger] Inspection found nothing good on ' + this.u.extractFilename(zoomPageUrl.href));
            return Promise.reject('Inspection found no zoom-item on ' + zoomPageUrl.href);
        }
    }


    /**
     * Try to find the pointed-to media item in the document corresponding to the thumb. 
     */
    findZoomUri(d, tUrl, zpUrl, optionName) {
        var findMediaUris = this.SCRAPING_TOOLS[optionName] || (function() { return []; });
        var urls = findMediaUris(d, { href: zpUrl.href });
        var zUri = false;

        this.me.output.toOut('Sifting through ' + optionName + ' content on detail page.');
        console.log('[Digger] Sifting through ' + optionName + ' content on ' + this.u.extractFilename(zpUrl.href));

        // If this is the only option enabled, and there's only one type of the media on the document, 
        // use it.
        if (this.isSoleOption(optionName) && urls.length === 1) {
            zUri = urls[0].href;
        }
        // Otherwise, use the Logicker's filename-matching on each object we find. Use the first match.
        else {
            urls.forEach((url) => {
                if (!!zUri) { return; };

                if (this.u.exists(url) && url.pathname) {
                    if (optionName === OPT.VIDEOS && urls.length === 1) {
                        zUri = url.href;
                    }                                    
                    else if (this.me.logicker.isPossiblyZoomedFile(tUrl, url)) {
                        zUri = url.href;
                    }
                }
            });
        }

        return zUri;
    }


    /*
     * Set the gallerygallerydig batch size from the options.
     */
    static setBatchSize(size) {
        console.log('[Digger] Attempt to set BATCH_SIZE to ' + size);

        if (!!size) {
            var numSize = parseInt(size+'', 10);
    
            if (!isNaN(numSize)) {
                console.log('[Digger] Sucessfully set BATCH_SIZE to ' + numSize + '');
                Digger.prototype.BATCH_SIZE = numSize;
            }
        }
    }


    /*
     * Set the gallerygallerydig number of channels from the options.
     */
    static setChannels(size) {
        console.log('[Digger] Attempt to set CHANNELS to ' + size);

        if (!!size) {
            var numSize = parseInt(size+'', 10);

            if (!isNaN(numSize)) {
                console.log('[Digger] Sucessfully set CHANNELS to ' + numSize + '');
                Digger.prototype.CHANNELS = numSize;
            }
        }
    }
}

// These are put on the Digger prototype so that the popup can easily set these values,
// and they are available to all diggers.
Digger.prototype.BATCH_SIZE = 3;
Digger.prototype.CHANNELS = 11;


window.digger = Digger;

export default Digger;