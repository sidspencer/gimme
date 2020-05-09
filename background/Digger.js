import { default as Scraper } from './Scraper.js';
import { default as Output } from './Output.js';
import { default as Logicker } from './Logicker.js';
import { default as Utils } from './Utils.js';

/** 
 * Factory Function.
 * Worker bee for GimmeGimmieGimmie. Looks through various types of linked media, returns
 * the URLs to the popup.
 */
const Digger = (function Digger(Scraper, Output, Logicker, Utils, Options) {
    // instance object
    var me = {
        startingGalleryMap: {},
        options: Options,
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
    var u = Utils;

    // constants
    var OPT = {
        IMGS: 'imgs',
        CSS_BGS: 'cssBgs',
        VIDEOS: 'videos',
        JS: 'js',
        AUDIOS: 'audios',
        QS: 'qs',
    };  
    var SEARCH_DEPTH = {
        SKIM: 1,
        LARGEST_IMAGE: 2,
        INSPECT: 3,
        TF_MATCH: 4,
        DIG_DEEPER: 5,
    };
    var SCRAPING_TOOLS = {};
    SCRAPING_TOOLS[OPT.IMGS] = Scraper.getAllImgUrls;
    SCRAPING_TOOLS[OPT.CSS_BGS] = Scraper.getAllCssBackgroundUrls;
    SCRAPING_TOOLS[OPT.VIDEOS] = Scraper.getAllVideoUrls;
    SCRAPING_TOOLS[OPT.AUDIOS] = Scraper.getAllAudioUrls;
    SCRAPING_TOOLS[OPT.JS] = Scraper.getAllJsUrls;
    SCRAPING_TOOLS[OPT.QS] = Scraper.getAllQsUrls;  

    // Set the default inspection options if none were passed in.
    if (!me.options) {
        for (var o in OPT) {
            me.options[o] = true;
        }
    }
    else {
        // Check if we only have 1 option enabled.
        me.soleInspectionOption = Object.keys(me.options).reduce(function getSoleOpt(soleOpt, optName) {
            return soleOpt + (me.options[optName] ? optName : '');
        }, '');
    }


    /**
     * Is this the only inspection option? 
     */
    function isSoleOption(optName) {
        return (optName === me.soleInspectionOption);
    }


    /**
     * Promise to resolve everything that has been dug.
     */
    function resolveDigHarvest() {
        return (new Promise(function(resolve, reject) {
            chrome.storage.local.set({
                    prevUriMap: me.harvestedUriMap,
                },
                function storageSet() {                    
                    console.log('[Digger] Set prevUriMap in storage');
                    console.log('[Digger] ---Returning dig harvest -> ' + Object.keys(me.harvestedUriMap).length + '------');
                    resolve(me.harvestedUriMap);
                }
            );
        }));
    }


    me.redrawOutputFileOpts = function redrawOutputFileOpts(uriMap) {
        Output.clearFilesDug();
        var dir = u.getSaltedDirectoryName();

        var idx = 0;
        for (var thumbUri in uriMap) { 
            var uri = uriMap[thumbUri];
            var queryPos = uri.lastIndexOf('?');

            if (queryPos === -1) {
                queryPos = uri.length;
            }

            me.outputIdMap[thumbUri] = idx;
                        
            Output.addFileOption({ 
                id: (idx++), 
                uri: uri, 
                thumbUri: thumbUri,
                filePath: dir + '/' + uri.substring(uri.lastIndexOf('/'), queryPos),
                onSelect: u.downloadFile, 
            });
        }

        chrome.browserAction.setBadgeText({ text: '' + idx + '' });
        chrome.browserAction.setBadgeBackgroundColor({ color: [247, 81, 158, 255] });
    }


    /**
     * Recursive wrapper around digNextBatch()
     */
    function digNextBatchLink(galleryMap) {
        if (Object.keys(galleryMap).length > 0) {
            return digNextBatch(galleryMap).then(function() {
                return digNextBatchLink(galleryMap);
            });
        }
        else {
            return Promise.resolve({});
        } 
    }


    /**
     * Alternate way to dig the gallery batches, more strictly in channeled chains.
     */
    function digGalleryBatches(galleryMap, thumbUris) {
        // Each channel is a promise chain that takes its own subset of the map
        // entries in galleryMap. The entries are equally distributed, with one 
        // map getting the remainder. 
        var promises = [];
        var subMaps = [];
        var thumbUris = Object.keys(galleryMap);
        var thumbsPerChannel = Math.floor(thumbUris.length / (Digger.prototype.CHANNELS - 1)) || 1;

        console.log('[Digger] Digging ' + thumbUris.length + ' scraped thumbnails.');
        Output.toOut('Now digging ' + thumbUris.length + ' thumbnails found in gallery.');
        
        // Make the submaps, build the promise chains.
        while (thumbUris.length > 0) {
            var subMap = {};

            for (var j = 0; j < thumbsPerChannel && thumbUris.length > 0; j++) {
                var thumbUri = thumbUris.pop();
                subMap[thumbUri] = '' + galleryMap[thumbUri];
                delete galleryMap[thumbUri];
            }

            promises.push(digNextBatchLink(subMap));
        }
        
        // Note, all these promises must resolve, or it'll kill the whole batch.        
        return Promise.all(promises).then(resolveDigHarvest).catch(resolveDigHarvest);  
    }  


    /**
     * Build and execute the next batch of digDeep() promises. 
     */
    function digNextBatch(galleryMap) {
        var diggingBatch = [];
        var startingOutputId = (++me.batchCount) * Digger.prototype.BATCH_SIZE;

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
                setUpOutput(thumbUri, startingOutputId + i);
                diggingBatch.push(me.digDeep(thumbUri, zoomPageUri));     
            }     
        }

        // Execute all the Promises together. They must all resolve, or
        // it'll kill the whole batch.
        return (
            Promise.all(diggingBatch)
            .then(harvestBatch)
            .catch(logDiggingErrorsAndContinue)
        );
    }


    /**
     * Take the results from the digDeep() promises and integrate them into the 
     * harvestedUriMap. Skip any nulls or duplicate zoomUris. Resolve with a dummy value.
     * What's important is that we resolve.
     */
    function harvestBatch(uriPairs) {
        for (var i = 0; i < uriPairs.length; i++) {
            var uriPair = uriPairs[i];

            if (!uriPair || uriPair === null) {
                continue;
            }
            
            // Add the new pair to the map, but don't duplicate zoom item uris.
            if (uriPair.thumbUri && uriPair.zoomUri) {
                if (Object.values(me.harvestedUriMap).indexOf(uriPair.zoomUri) == -1) {
                    me.harvestedUriMap[uriPair.thumbUri] = uriPair.zoomUri;
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
    function setUpOutput(thumbUri, id) {
        me.outputIdMap[thumbUri] = id;
        Output.addNewEntry(id, thumbUri);
    }


    /**
     * Log any errors that killed the batch. This is relatively catastrophic,
     * as it means BATCH_SIZE number of digs were killed. 
     */
    function logDiggingErrorsAndContinue(errorMessages) {
        var diggingErrors = 
            (errorMessages && errorMessages.length) ?
            [].concat(errorMessages) :
            [errorMessages];

        diggingErrors.forEach(function logDiggingError(diggingError) {
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
    function mergeGalleryMaps(from, to, ids) {
        var fromKeys = Object.keys(from);
        var nextId = fromKeys.length + Object.keys(to).length;

        to = Object.assign(to, from);
    }


    /**
     * Add a thumb -> zoom to a map, skipping duplicate entries for a given
     * thumb.
     */
    function addToMap(thumbUrl, linkUrl, map) {
        var thumbUri = thumbUrl.href;
        var zoomUri = linkUrl.href;

        // Create entries in the gallery map, the XHR tracking array, and the UI.
        if (u.exists(thumbUri) && u.exists(zoomUri)) {
            if (!u.isBannedZoomUri(zoomUri)) {
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
                    me.outputIdMap[thumbUri] = newId;
                    Output.addNewEntry(newId, thumbUri);
                }
            }
        }
    }



    /**
     * Find the uri that might be gone to if the element was clicked, whether it is the
     * target, or some ancestor is the target. 
     * spec is like: { selector: 'img', keyPropPath: 'parentElement.src', altKeyPropPath: 'currentSrc' }
     */
    // These CLICK_PROPS are in priority order of which to pay attention to.
    var DEAULT_CLICK_PROPS = [ 'onclick', 'href' ];
    var DEFAULT_PROP_PATHS = [ 'src', 'href', 'currentSrc' ];
    var DEFAULT_SELECTOR = ':scope *';
    function getClickUriMap(node, loc, spec) {
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
        subjects.forEach(function(tag) {
            // Use the first propPath in the array which works. They are in 
            // priority order.  
            var src = '';
            spec.propPaths.forEach(function lookForSrc(propPath) {
                if (!!src) { return; }

                var value = Logicker.extractUrl(tag, propPath, loc);
                if (!!value && !!value.href) {
                    src = value.href;
                }
            });
            if (!src) {
                console.log('[Digger] No src found for tag.'); 
                return; 
            }

            if (Logicker.isKnownBadImg(src)) {
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
                var url = Logicker.extractUrl(iterator, foundClickProps[j], loc);
                if (!!url && !!url.href) { uris.push(url.href); };
            }
            if (uris.length === 0) { return; };

            // Figure out which of the URIs is the best.
            var bestUri = uris[0]; 
            for (var k = 1; k < uris.length; k++) {
                var bestUri = Logicker.chooseBetterMatchingUri(src, bestUri, uris[k]);
            }
            
            console.log(
                '[Digger] New pair added to gallery click-map:\n ' +
                '         thumbSrc: ' + src + '\n' +
                '         zoomPage: ' + bestUri + ''
            );

            // Add this pair's full URLs to the map and the Output.
            var thumbUrl = new URL(src);
            var linkUrl = new URL(bestUri);
            addToMap(thumbUrl, linkUrl, clickMap);
        });

        return clickMap;
    }


    /**
     * Build a gallery map based upon multiple calls to getClickUriMap(), which 
     * Finds what navigation action will happen if clicking on the image's area.
     */
    function buildGalleryMap(doc, loc) {
        // Start with <img> tags.
        var imgMap = getClickUriMap(
            doc,
            loc,
            { 
                selector: 'img', 
                propPaths: ['src', 'currentSrc', 'srcset', 'dataset.src'], 
            }
        );

        // Also try <div>s and <span>s with css background-images.
        var cssBgMap = getClickUriMap(
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
    function discoverGallery(doc, loc) {
        // Make a map of all the <img> srcs contained in <a> tags. Sort it as thumbUri -> linkUri.
        // If the Digger got us stuff, there will already be some entries. Merge them in.
        var galleryMap = {};
        me.outputIdMap = {};
        var gallerySize = 0;

        if (me.digOpts.doScrape !== false) {
            galleryMap = buildGalleryMap(doc, loc);
            gallerySize = Object.keys(galleryMap).length;  
        }

        // This merges, and also manages the Output entries.
        if (!!me.startingGalleryMap && !!Object.keys(me.startingGalleryMap).length) {
            galleryMap = Object.assign({}, me.startingGalleryMap, galleryMap);
        }

        // Begin digging, or stop if instructed to.
        if (me.digOpts.doDig === false) {
            console.log('[Digger] Instructed to not dig. Responding with discovered URIs.')
            return Promise.resolve(galleryMap);
        }
        else {
            return digGalleryBatches(galleryMap);
        }  
    }


    /**
     * Update the UI that we dug a zoomUri. 
     */
    function recordDigResult(thumbUri, zoomedImgUri, isFailure) {
        var id = me.outputIdMap[thumbUri];

        console.log(
            '[Digger] Zoomed image reported.\n' +
            '         thumbUri: ' + thumbUri + '\n' +
            '         zoomedImgUri: ' + zoomedImgUri + ''
        );

        if (isFailure) {
            Output.setEntryAsFailed(id, zoomedImgUri || '[failed]');
        }
        else {
            Output.setEntryAsDug(id, zoomedImgUri);
        } 
        
        Output.toOut('Completed ' + (++me.completedXhrCount) + ' media fetches...');
        chrome.browserAction.setBadgeText({ text: '' + me.completedXhrCount + '' });
        chrome.browserAction.setBadgeBackgroundColor({ color: '#111111' });
    }


    /**
     * Syntactic sugar for completing XHR successfully with the proper "full-size" media item.
     */
    function reportDigSuccess(thumbUri, zoomUri) {
        recordDigResult(thumbUri, zoomUri);
        return {
            thumbUri: thumbUri,
            zoomUri: zoomUri,
        };
    }


    /**
     * Syntactic sugar for completing the XHR without finding a suitable "full-size" media item. 
     */
    function reportDigFailure(thumbUri, zoomUri) {
        recordDigResult(thumbUri, zoomUri, true);
        return null;
    }


    /**
     * Find all the clicked-through (hopefully) large versions of images on pic detail page.
     * Do it by finding all the 'a img' selecteds, and then grabbing the document specified by
     * the <a> -- this is queried for any <img> with a similar filename to the supposed "thumbnail".
     */
    me.digGallery = function digGallery(config) {
        var doc = config.doc;
        var loc = config.loc;

        me.digOpts = config.digOpts;
        me.startingGalleryMap = config.galleryMap;
        me.harvestedUriMap = {};
        me.outputIdMap = {};

        if (me.digOpts.doScrape) {
            return discoverGallery(doc, loc);
        }
        else if (me.digOpts.doDig === false) {
            return digGalleryBatches(me.startingGalleryMap);
        }
        else {
            return discoverGallery(doc, loc)
        }
    };


    /**
     * A second way of digging, using Utils.loadUriDoc() to construct the whole document via an 
     * iframe. It is way more expensive and way slower, but allows full client-side rendering before 
     * we attempt to process the document.
     * This one *does* reject.
     */
    me.digDeeper = function digDeeper(thumbUri, zoomPageUri, searchDepth) {
        if (searchDepth >= SEARCH_DEPTH.DIG_DEEPER) { searchDepth = SEARCH_DEPTH.DIG_DEEPER - 1; };

        // Validate URIs exist, and the zoomPageUri is of a fetchable protocol.
        if (!u.exists(thumbUri) || !u.exists(zoomPageUri) || !u.isFetchableUri(zoomPageUri)) {
            console.log(
                '[Digger] Cannot dig due missing/unfetchable URIs. [' + 
                (thumbUri || '-blank-') + ', ' + 
                (zoomPageUri || '-blank-') + ']'
            );

            return Promise.reject('Trying to digDeeper Bad URIs');
        }

        // Extract filenames for better output messages. 
        var thumbFilename = u.extractFilename(thumbUri);
        var zoomFilename = u.extractFilename(zoomPageUri);

        // Resolve if we can tell the zoom page URI points directly to media.
        if (u.isKnownMediaType(zoomPageUri)) {
            Output.toOut('Found direct link to media: ' + zoomFilename);
            return Promise.resolve({
                thumbUri: thumbUri, 
                zoomUri: zoomPageUri
            });
        }
        
        // Construct the ID used by loadUriDoc() to identify the <iframe>
        var uriDocId = zoomFilename.substring('id' + zoomFilename.substring(0, zoomFilename.indexOf('.')));  
        console.log('[Digger] uriDocId: ' + uriDocId);
        Output.toOut('Finding zoom-item for thumbnail named ' + thumbFilename + '');

        // Load the document and process it. Either resolve with the pair, or reject. digDeeper()
        // can safely reject, as it is the final attempt to look at the zoom page.
        var p = u.loadUriDoc(zoomPageUri, uriDocId)
        .then(function lookAtLoadedDoc(doc) {
            console.log('[Digger] Digger loaded doc: ' + zoomPageUri);
            Output.toOut('Loaded document ' + zoomFilename);
            
            return processZoomPage(doc, new URL(thumbUri), new URL(zoomPageUri), searchDepth);
        })
        .then(function resolveFinalPair(pair) {
            return Promise.resolve(pair);
        })
        .catch(function handleLoadFailure(e) {
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
    me.digDeep = function digDeep(thumbUri, zoomPageUri, searchDepth) {
        // Validate URIs exist, and the zoomPageUri is of a fetchable protocol.
        if (!u.exists(thumbUri) || !u.exists(zoomPageUri) || !u.isFetchableUri(zoomPageUri)) {
            console.log(
                '[Digger] Cannot dig due missing/unfetchable URIs. [' + 
                (thumbUri || '-blank-') + ', ' + 
                (zoomPageUri || '-blank-') + ']'
            );

            return Promise.resolve(reportDigFailure(thumbUri, zoomPageUri));
        }
        
        // Extract the filenames for better output.
        var thumbFilename = u.extractFilename(thumbUri);
        var zoomFilename = u.extractFilename(zoomPageUri);            

        Output.toOut('Finding zoom-media for thumbnail named ' + thumbFilename + '');
        console.log('working on ' + zoomPageUri);

        // Do a HEAD request XHR to discover the content-type of the zoom-page. Either it is
        // media, and we resolve with it, it is an HTML doc and we process it, or skip it if
        // it's something unknown.
        //
        // Catch *all* reject()s here. Always resolve(). Otherwise, we'll break the promise chain.
        var p = u.sendXhr('HEAD', zoomPageUri)
        .then(function processCompletedXhr(xhr) {
            var mimeType = new String(xhr.getResponseHeader('content-type'));

            // Report anything other than HTML documents as found media.
            if (mimeType.indexOf('html') !== -1) {
                Output.toOut('Found image detail page ' + zoomFilename);
                
                return (
                    processZoomPage(false, new URL(thumbUri), new URL(zoomPageUri), searchDepth)
                    .then(function stuff(pair) {
                        return Promise.resolve(pair);
                    })
                );
            } 
            else if (u.isKnownMediaType(mimeType)) {
                Output.toOut('Found media ' + zoomFilename);
                return Promise.resolve({
                    thumbUri: thumbUri,
                    zoomUri: zoomPageUri,
                });
            }
            else {
                return Promise.reject('Unknown Content-type ' + mimeType);
            }
        })
        .then(function recordDigSuccess(pair) {
            return reportDigSuccess(pair.thumbUri, pair.zoomUri);
        })
        .catch(function completeDigWithFailure(errorMessage) {
            console.log('[Digger] digDeep error: ' + errorMessage);
            return Promise.resolve(reportDigFailure(thumbUri, zoomPageUri));
        });

        return p;
    };


    /**
     * XHR 'GET' the zoom page if we weren't passed it, then apply search methods
     * from least-intensive -> most intensive til we find something. Variable depth
     * search, defaults to trying every strategy in the app.
     */
    function processZoomPage(inDoc, thumbUrl, zoomPageUrl, searchDepth) {
        if (!searchDepth) { searchDepth = SEARCH_DEPTH.DIG_DEEPER; };

        var zoomFilename = u.extractFilename(zoomPageUrl.href);                    
        var errors = [];
        var startingPromise = Promise.resolve({});
        var doc = inDoc;

        // Get the doc if it was null, starting the promise chain. 
        if (!doc || doc === null) {
            startingPromise = 
                u.getXhrResponse('GET', zoomPageUrl.href, 'document')
                .catch(function(e) {
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
        var p = startingPromise.then(function doSkimming(d) {
            if (!d || !d.querySelectorAll) {
                console.log('[Digger] Processing started with error');
                return Promise.resolve(null);
            }
            else {
                doc = d;
                Output.toOut('Skimming ' + zoomFilename);                        
                return skimZoomPage(doc, thumbUrl, zoomPageUrl);
            }
        })
        // 2 - Look for the largest image
        .catch(function maybeLookForLargestImage(previousError) {
            errors.push(previousError);
            if (searchDepth < SEARCH_DEPTH.LARGEST_IMAGE) { return Promise.resolve(null); };
            if (me.options.imgs !== true) { return Promise.reject('Not looking for images'); };
            
            Output.toOut('Looking for the largest Image on ' + zoomFilename);
            return Logicker.getPairWithLargestImage(thumbUrl.href, doc);
        })
        // 3 - Use document inspection, using each options-defined type of scrape.
        .catch(function maybeInspectDocument(previousError) {
            errors.push(previousError);                        
            if (searchDepth < SEARCH_DEPTH.INSPECT) { return Promise.resolve(null); };

            Output.toOut('Inspecting all media on ' + zoomFilename);
            return inspectZoomPage(doc, thumbUrl, zoomPageUrl);                    
        })
         // 4 - Use TensorFlow's Mobilenet pre-trained ML model.
        .catch(function maybeUseTfClassification(previousError) {
            errors.push(previousError);
            if (searchDepth < SEARCH_DEPTH.TF_MATCH) { return Promise.resolve(null); }

            return Logicker.tfClassificationMatch(thumbUrl.href, doc);
        })
        // 5- Iterate again, using Plan B. digDeeper() uses an iframe, so client-side rendering runs.
        .catch(function maybeDigDeeper(previousError) {
            errors.push(previousError);                        
            if (searchDepth < SEARCH_DEPTH.DIG_DEEPER) { return Promise.resolve(null); };

            Output.toOut('Checking ' + zoomFilename + ' a second way');
            return me.digDeeper(thumbUrl.href, zoomPageUrl.href, (SEARCH_DEPTH.DIG_DEEPER - 1));
        })
        // Pair Found - Resolve with that pair.
        .then(function resolveSuccessfully(pair) {
            if (!pair || pair === null) {
                return Promise.reject('Invalid pair');
            }
            else {
                return Promise.resolve(pair);
            }
        })
        // No Pair - Log errors[], resolve with null.
        .catch(function rejectWithFailure(previousError) {
            errors.push(previousError);

            // Log it all to the console. 
            var combinedMessage = errors.reduce(
                function allToString(previousMessage, errorMessage) {
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
    function skimZoomPage(doc, thumbUrl, zoomPageUrl) {
        // First look in the special rules for a strategy that's already 
        // been figured out by me. See if we can just get the Uri from there.
        var blessedZoomUri = Logicker.findBlessedZoomUri(doc, thumbUrl.href);                    
        if (!!blessedZoomUri) {
            console.log('[Digger] Found blessed full-size uri: ' + blessedZoomUri);
            return Promise.resolve({
                thumbUri: thumbUrl.href, 
                zoomUri: blessedZoomUri,
            });
        }
        else if (me.options.imgs && doc.images.length === 1) {
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
    function inspectZoomPage(doc, thumbUrl, zoomPageUrl) {
        var zoomUri = false;        
        Output.toOut('Searching through media on ' + u.extractFilename(zoomPageUrl.href));

        // For each enabled investigation option, try to find the zoom media item.
        Object.keys(me.options).forEach(function checkUris(optName) {
            if (!!zoomUri) { return; };

            if (me.options[optName] === true) {
                zoomUri = findZoomUri(doc, thumbUrl, zoomPageUrl, optName);
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
            Output.toOut('Inspection found nothing good on ' + u.extractFilename(zoomPageUrl.href));
            console.log('[Digger] Inspection found nothing good on ' + u.extractFilename(zoomPageUrl.href));
            return Promise.reject('Inspection found no zoom-item on ' + zoomPageUrl.href);
        }
    }


    /**
     * Try to find the pointed-to media item in the document corresponding to the thumb. 
     */
    function findZoomUri(d, tUrl, zpUrl, optionName) {
        var findMediaUris = SCRAPING_TOOLS[optionName] || (function() { return []; });
        var urls = findMediaUris(d, { href: zpUrl.href });
        var zUri = false;

        Output.toOut('Sifting through ' + optionName + ' content on detail page.');
        console.log('[Digger] Sifting through ' + optionName + ' content on ' + u.extractFilename(zpUrl.href));

        // If this is the only option enabled, and there's only one type of the media on the document, 
        // use it.
        if (isSoleOption(optionName) && urls.length === 1) {
            zUri = urls[0].href;
        }
        // Otherwise, use the Logicker's filename-matching on each object we find. Use the first match.
        else {
            urls.forEach(function checkForZoomUrl(url) {
                if (!!zUri) { return; };

                if (u.exists(url) && url.pathname) {
                    if (optionName === OPT.VIDEOS && urls.length === 1) {
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


    // Return the Digger instance.
    return me;
});

// These are put on the Digger prototype so that the popup can easily set these values,
// and they are available to all diggers.
Digger.prototype.BATCH_SIZE = 3;
Digger.prototype.CHANNELS = 11;


/*
 * Set the gallerygallerydig batch size from the options.
 */
Digger.setBatchSize = function setBatchSize(size) {
    console.log('[Digger] Attempt to set BATCH_SIZE to ' + size);

    if (!!size) {
        var numSize = parseInt(size+'', 10);

        if (!isNaN(numSize)) {
            console.log('[Digger] Sucessfully set BATCH_SIZE to ' + numSize + '');
            Digger.prototype.BATCH_SIZE = numSize;
        }
    }
};


/*
 * Set the gallerygallerydig number of channels from the options.
 */
Digger.setChannels = function setChannels(size) {
    console.log('[Digger] Attempt to set CHANNELS to ' + size);

    if (!!size) {
        var numSize = parseInt(size+'', 10);

        if (!isNaN(numSize)) {
            console.log('[Digger] Sucessfully set CHANNELS to ' + numSize + '');
            Digger.prototype.CHANNELS = numSize;
        }
    }
};

window.digger = Digger;

export default Digger;