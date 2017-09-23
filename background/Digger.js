'use strict'

/** 
 * Factory Function.
 * Worker bee for GimmeGimmieGimmie. Looks through various types of linked media, returns
 * the URLs to the popup.
 */
var Digger = (function Digger(Scraper, Output, Logicker, Utils, Options) {
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
    var DIG_SAVE = 'DIG_SAVE';
    var BATCH_SIZE = 3;
    var CHANNELS = 11;
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
        DIG_DEEPER: 4,
    }
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
        Digger.previouslyHarvestedUriMap = me.harvestedUriMap;
        console.log('[Digger] ---Returning dig harvest -> ' + Object.keys(me.harvestedUriMap).length + '------');
        return Promise.resolve(me.harvestedUriMap);
    }


    /**
     * Execute a promise chain of digDeep() batches, firing BATCH_SIZE
     * number of digDeep() XHR-and-inspect processes at once. Resolve
     * with the full me.harvestedUriMap.
     */
    function digGalleryBatches_old(galleryMap) {                
        // Make CHANNELS number of promises, each resolving BATCH_SIZE me.digDeep()
        // calls via digNextBatch(). digNextBatch deletes entries from the galleryMap
        // as it goes.
        var promises = [];      
        for (var i = 0; i < CHANNELS && Object.keys(galleryMap).length > 0; i++) {
            promises.push(digNextBatch(galleryMap));
        }
        
        console.log('[Digger] Digging set of ' + promises.length + 'gallery batches.');        

        // Note, all these promises must resolve, or it'll kill the whole batch.
        var p = Promise.all(promises);
        
        // Either recurse no matter what, or resolve with the entire harvest of zoom item uris.
        if (Object.keys(galleryMap).length > 0) {
            var resolveNextIteration = function rni() { 
                return digGalleryBatches_old(galleryMap); 
            };

            return p.then(resolveNextIteration).catch(resolveNextIteration);
        }
        else {
            return p.then(resolveDigHarvest).catch(resolveDigHarvest);  
        }   
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
        var thumbsPerChannel = Math.floor(thumbUris.length / (CHANNELS - 1)) || 1;

        // Make the submaps, build the promise chains.
        for (var i = 0; i < CHANNELS; i++) {
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
        var startingOutputId = (++me.batchCount) * BATCH_SIZE;

        // Set up the output entry, and enter the uriPair's digDeep() execution
        // into the promise batch's array. Skip nulls. 
        var allThumbUris = Object.keys(galleryMap);    

        for (var i = 0; i < BATCH_SIZE && allThumbUris.length > 0; i++) {
            // Pop a thumb/link pair from the map.
            var thumbUri = allThumbUris[i];
            var zoomPageUri = galleryMap[thumbUri];
            delete galleryMap[thumbUri];

            // sanity check, then set up the dig.
            if (!!thumbUri && !!thumbUri.substring && !!zoomPageUri && !!zoomPageUri.substring) {
                setUpOutput(thumbUri, startingOutputId + i);
                diggingBatch.push(me.digDeep(thumbUri, zoomPageUri));     
            } 
            else {
                console.log(
                    '[Digger] Skipping dig for bad URI pair.\n ' + 
                    '         thumbUri:    ' + thumbUri + '\n' +
                    '         zoomPageUri: ' + zoomPageUri
                );                
            }           
        }

        console.log('[Digger] Queued digging batch #' + me.batchCount +' of size ' + diggingBatch.length);

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
                else {
                    console.log('[Digger] Duplicate of zoomUri ' + uriPair.zoomUri);
                }
            }
        }

        console.log('[Digger] Harvested ' + uriPairs.length + ' new zoom item uris');
        
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

        // Apply the optionally-set me.urisToDig
        fromKeys.forEach(function setNewLinkHrefs(thumbUri) {
            // Store the old value, if there was one, and override with our new one.
            var newPageUri = from[thumbUri];            
            var oldPageUri = to[thumbUri];
            var id = nextId;

            if (!!oldPageUri) {
                id = ids[oldPageUri];
                Output.deleteEntry(id);
                delete ids[oldPageUri];
            }
            else {
                nextId++;
            }
            
            to[thumbUri] = newPageUri;
            ids[newPageUri] = id;
            Output.addNewEntry(id, thumbUri);            
        });        
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
            if (!u.isBannedUri(zoomUri)) {
                console.log(
                    '[Digger] Adding to map:\n' + 
                    '         thumbUri: ' + thumbUri + '\n' + 
                    '         zoomUri:  ' + zoomUri + ''
                );

                // Create the associations, but do not add duplicates.
                if (thumbUri in map) {
                    console.log(
                        '[Digger] Found two zoomUris for thumb: ' + thumbUri + 
                        '\n       keeping original: ' + map[thumbUri] + 
                        '\n       discarding dupe:  ' + zoomUri
                    );
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
     * Find all the gallery-item looking <a>...<img/>...</a> structures, mapping the src
     * of the thumbnail image to the href of the supposed zoom page.
     * 
     * ALSO URL-IFIES THE SRCs. FROM THIS POINT ON THEY ARE REAL URIs IN THE MAPS/ARRAYS.
     */
    function buildSimpleGalleryMap(doc, loc) {
        var map = {};
        var links = doc.querySelectorAll('a[href]');

        Output.toOut('Looking at ' + links.length + ' possible gallery links...');
        console.log('[Digger] Found ' + links.length + ' possible gallery links.');
        
        // For all the links, find the <img> tags contained in them. Also, find
        // any elements with a background-image simulating an <img> tag.
        if (links.length > 0) {
            for (var i=0; i < links.length; i++) {
                var linky = links[i];
                var linkHref = u.exists(linky.href) ? linky.href : linky.attributes.href.value;

                if (linkHref.indexOf('javascript:') === 0) {
                    continue;
                }

                var linkUrl = new URL(linkHref, u.getBaseUri(loc));
                
                // Populate the gallery map and tracking objects.
                var containedImgUrls = Scraper.getAllImgUrls(linky, loc);
                containedImgUrls.forEach(function addImgLinksToGallery(imgUrl) {
                    addToMap(imgUrl, linkUrl, map);
                });

                var containedBgUrls = Scraper.getAllCssBackgroundUrls(linky, loc);
                containedBgUrls.forEach(function addCssBgLinksToGallery(bgUrl) {
                    addToMap(bgUrl, linkUrl, map);
                });                
            }
        }

        return map;
    }


    /**
     * Find all the "full-sized"/"zoomed" media on zoom pages, as indicated by a 
     * galleryMap (thumbUri -> zoomPageUri).
     */
    function discoverGallery(doc, loc) {
        // Make a map of all the <img> srcs contained in <a> tags. Sort it as thumbUri -> linkUri.
        // If the ContentPeeper got us stuff, there will already be some entries. Merge them in.
        var galleryMap = {};
        me.outputIdMap = {};

        if (me.digOpts.doScrape !== false) {
            galleryMap = buildSimpleGalleryMap(doc, loc);
        }

        if (!!me.startingGalleryMap && !!Object.keys(me.startingGalleryMap).length) {
            mergeGalleryMaps(me.startingGalleryMap, galleryMap, me.outputIdMap);
        }

        if (me.digOpts.doDig === false) {
            console.log('[Digger] Instructed to not dig. Responding with discovered URIs.')
            return Promise.resolve(galleryMap);
        }
        // Perform the full XHR-and-inspection for each entry in the gallery.
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

        // Follow the options. If we're told:
        //  no scrape & no dig -- just call the callback. 
        //  yes scrape -- do it all normally through the default digDeep() behavior.
        if ((me.digOpts.doScrape === false) && (me.digOpts.doDig === false)) {
            Digger.previouslyHarvestedUriMap = me.harvestedUriMap;            
            return Promise.resolve(me.harvestedUriMap);
        }
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

            var thumbFilename = u.extractFilename(thumbUri);
            var zoomFilename = u.extractFilename(zoomPageUri);

            if (u.isKnownMediaType(zoomPageUri)) {
                Output.toOut('Found direct link to media: ' + zoomFilename);
                return Promise.resolve({
                    thumbUri: thumbUri, 
                    zoomUri: zoomPageUri
                });
            }
            
            var uriDocId = zoomFilename.substring('id' + zoomFilename.substring(0, zoomFilename.indexOf('.'))); 
            
            console.log('[Digger] uriDocId: ' + uriDocId);
            Output.toOut('Finding zoom-item for thumbnail named ' + thumbFilename + '');

            var p = u.loadUriDoc(zoomPageUri, uriDocId)
            .then(function lookAtLoadedDoc(doc) {
                console.log('[Digger] Digger loaded doc: ' + zoomPageUri);
                Output.toOut('Loaded document ' + zoomFilename);
                
                return processZoomPage(doc, new URL(thumbUri), new URL(zoomPageUri), searchDepth)
                .then(function resolveFinalPair(pair) {
                    return Promise.resolve(pair);
                });
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
        
        var thumbFilename = u.extractFilename(thumbUri);
        var zoomFilename = u.extractFilename(zoomPageUri);            

        Output.toOut('Finding zoom-media for thumbnail named ' + thumbFilename + '');
        console.log('working on ' + zoomPageUri);

        // Note, we always resolve.
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
                errors.push(e);
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
            
            console.log('largest image');
            Output.toOut('Looking for the largest Image on ' + zoomFilename);
            return Logicker.getPairWithLargestImage(thumbUrl.href, doc);
        })
        // 3 - Use document inspection, using each options-defined type of scrape.
        .catch(function maybeInspectDocument(previousError) {
            errors.push(previousError);                        
            if (searchDepth < SEARCH_DEPTH.INSPECT) { return Promise.resolve(null); };

            console.log('inspectZoomPage');
            Output.toOut('Inspecting all media on ' + zoomFilename);
            return inspectZoomPage(doc, thumbUrl, zoomPageUrl);                    
        })
        // 4 - Iterate again, using Plan B. digDeeper() uses an iframe, so client-side rendering runs.
        .catch(function maybeDigDeeper(previousError) {
            errors.push(previousError);                        
            if (searchDepth < SEARCH_DEPTH.DIG_DEEPER) { return Promise.resolve(null); };

            console.log('digDeeper');
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
        var zoomFilename = u.extractFilename(zoomPageUrl.href);

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
        else {
            // TODO: Create more skim-worthy search strategies.        
            return Promise.reject('Skimming found nothing');
        }
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
            if (!zoomUri && me.options[optName] === true) {
                zoomUri = findZoomUri(doc, thumbUrl, zoomPageUrl, optName);
            }
        });

        // Resolve if we found something that works. Otherwise, reject.
        if (zoomUri) {
            return Promise.resolve({
                thumbUri: thumbUrl.href,
                zoomUri: zoomUri
            });            
        }
        else {
            Output.toOut('Inspection found nothing good on ' + u.extractFilename(zoomPageUrl.href));
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

        // If this is the only option enabled, and there's only one type of the media on the document, 
        // use it.
        if (isSoleOption(optionName) && urls.length === 1) {
            zUri = urls[0].href;
        }
        // Otherwise, use the Logicker's filename-matching on each object we find. Use the first match.
        else {
            urls.forEach(function checkForZoomUrl(url) {
                if (!zUri && u.exists(url) && url.pathname) {                                    
                    if (Logicker.isPossiblyZoomedFile(tUrl, url)) {
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