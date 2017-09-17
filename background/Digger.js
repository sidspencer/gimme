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
        digOpts: { doScrape: true, doDig: true },

        harvestedUriMap: {},
        outputIdMap: {},
        
        completedXhrCount: 0,
        batchCount: 0,
        soleInspectionOption: null,
    };

    // aliases
    var u = Utils;

    // constants
    var DIG_SAVE = 'DIG_SAVE';
    var BATCH_SIZE = 4;
    var CHANNELS = 30;
    var OPT = {
        IMGS: 'imgs',
        CSS_BGS: 'cssBgs',
        VIDEOS: 'videos',
        JS: 'js',
        AUDIOS: 'audios',
        QS: 'qs',
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
     * Execute a promise chain of digDeep() batches, firing BATCH_SIZE
     * number of digDeep() XHR-and-inspect processes at once. Resolve
     * with the full me.harvestedUriMap.
     */
    function digGalleryBatches(galleryMap) {
        var thumbUris = Object.keys(galleryMap);
        
        var promiseChains = [];
        for (var j = 0; j < CHANNELS; j++) {
            promiseChains.push(Promise.resolve({}));
        }     

        console.log('[Digger] Found ' + thumbUris.length + ' Gallery entries. Digging in batches of ' + BATCH_SIZE);
        Output.toOut('Beginning dig of ' + thumbUris.length + ' gallery entries.');

        // Add a new promise link to the chain; another batch of executions
        // that are accumulated, and have independent error-catching
        while (thumbUris.length > 0) {
            for (var i = 0; i < promiseChains.length && thumbUris.length > 0; i++) {
                me.batchCount++;

                console.log('[Digger] Setting up batch #' + me.batchCount);
                Output.toOut('Digging batch #' + me.batchCount);
                var batchThumbUris = thumbUris.splice(0, BATCH_SIZE);

                var promiseLinkFn = (function(map, uris, baseId) {
                    return function (pairs) {
                        return digNextBatch(map, uris, baseId);                    
                    };
                })(galleryMap, batchThumbUris, me.batchCount * BATCH_SIZE);
                    
                promiseChains[i] = promiseChains[i].then(promiseLinkFn);
            }
        }

        // Resolve with the final digging harvest.
        return Promise.all(promiseChains).then(function() {
            console.log('[Digger] ---Returning full harvest---');
            Digger.previouslyHarvestedUriMap = me.harvestedUriMap;

            return Promise.resolve(me.harvestedUriMap);
        });
    }


    /**
     * Build and execute the next batch of digDeep() promises. 
     */
    function digNextBatch(galleryMap, thumbUris, baseId) {
        var diggingBatch = [];

        // Set up the output entry, and enter the uriPair's digDeep() execution
        // into the promise batch's array. Skip nulls. 
        for (var i = 0; i < thumbUris.length; i++) {
            var thumbUri = thumbUris[i];
            var zoomPageUri = galleryMap[thumbUri];

            // sanity check, then set up the dig.
            if (!!thumbUri && !!thumbUri.substring && !!zoomPageUri && !!zoomPageUri.substring) {
                setUpOutput(thumbUri, baseId + i);
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

        // Execute all the Promises together. They must all resolve, or
        // it'll kill the whole batch.
        return Promise.all(diggingBatch).then(harvestBatch).catch(logDiggingErrorsAndContinue);
    }


    /**
     * Take the results from the digDeep() promises and integrate them into the 
     * harvestedUriMap. Skip any nulls or duplicate zoomUris. Resolve with a dummy value.
     * What's important is that we resolve.
     */
    function harvestBatch(uriPairs) {
        console.log('[Digger] Harvesting ' + uriPairs.length + ' URI pairs.');

        for (var i = 0; i < uriPairs.length; i++) {
            var uriPair = uriPairs[i];

            if (!uriPair) {
                continue;
            }
            
            if (uriPair.thumbUri && uriPair.zoomUri) {
                if (Object.values(me.harvestedUriMap).indexOf(uriPair.zoomUri) == -1) {
                    me.harvestedUriMap[uriPair.thumbUri] = uriPair.zoomUri;
                }
                else {
                    console.log('[Digger] Duplicate of zoomUri ' + uriPair.zoomUri);
                }
            }
            else {
                console.log('[Digger] Bad uriPair.');
            }
        }

        // Resolve. The value is unimportant in this code rev, however.
        return Promise.resolve(me.harvestedUriMap);
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
        var diggingErrors = (errorMessages && errorMessages.length) ?
            [].concat(errorMessages) :
            [errorMessages];

        diggingErrors.forEach(function logDiggingError(diggingError) {
            console.log('*** ' + diggingError + ' ***');
            Output.toOut('Lost a batch.');
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
                        '\n  keeping original: ' + map[thumbUri] + 
                        '\n  discarding dupe:  ' + zoomUri
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
        
        // For all the links, find the <img> tags contained in them. 
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
            //me.harvestedUriMap[thumbUri] = null;                    
        }
        else {
            Output.setEntryAsDug(id, zoomedImgUri);
            //me.harvestedUriMap[thumbUri] = zoomedImgUri;                    
        } 
        
        Output.toOut('Completed ' + (++me.completedXhrCount) + ' media fetches...');        
    }


    /**
     * Syntactic sugar for completing XHR successfully with the proper "full-size" media item.
     */
    function reportDigSuccess(thumbUri, zoomUri) {
        recordDigResult(thumbUri, zoomUri);
        return Promise.resolve({
            thumbUri: thumbUri,
            zoomUri: zoomUri,
        });
    }


    /**
     * Syntactic sugar for completing the XHR without finding a suitable "full-size" media item. 
     */
    function reportDigFailure(thumbUri, zoomUri) {
        recordDigResult(thumbUri, zoomUri, true);
        return Promise.resolve(null);
    }


    /**
     * convenience function to flag our having been passed-in a starter galleryMap.
     */
    me.hasStarterMap = function hasStarterMap() {
        return !!Object.keys(me.startingGalleryMap).length;
    };


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
     * Use HEAD requests to resolve what the gallery links point to. If they point to media files, we're
     * done. If they point to documents, then call another function to further investigate those documents.  
     */
    me.digDeep = function digDeep(thumbUri, zoomPageUri) {
        return new Promise(function buildDigDeep(resolve, reject) {
            // Validate URIs exist, and the zoomPageUri is of a fetchable protocol.
            if (!u.exists(thumbUri) || !u.exists(zoomPageUri) || !u.isFetchableUri(zoomPageUri)) {
                console.log(
                    '[Digger] Cannot dig due missing/unfetchable URIs. [' + 
                    (thumbUri || '-blank-') + ', ' + 
                    (zoomPageUri || '-blank-') + ']'
                );

                reportDigFailure(thumbUri, zoomPageUri);
                resolve(null);
            }
            
            var thumbFilename = u.extractFilename(thumbUri);
            var zoomFilename = u.extractFilename(zoomPageUri);            

            Output.toOut('Finding zoom for thumbnail named ' + thumbFilename + ' ...');
            console.log('[Digger] Queueing XHR for thumbnail ' + thumbFilename);

            // Note, we always resolve.
            u.sendXhr('HEAD', zoomPageUri)
            .then(function processCompletedXhr(xhr) {
                // Report anything other than HTML documents as found media.
                if (xhr.getResponseHeader('Content-Type').indexOf('text/html') !== -1) {
                    Output.toOut('Found image detail page ' + zoomFilename);
                    
                    processZoomPage(new URL(thumbUri), new URL(zoomPageUri))
                    .then(function stuff(pair) {
                        resolve(pair);
                    });
                } 
                else {
                    Output.toOut('Found media ' + zoomFilename);
                    
                    reportDigSuccess(thumbUri, zoomPageUri);
                    resolve({
                        thumbUri: thumbUri,
                        zoomUri: zoomPageUri, 
                        });
                }
            })
            .catch(function processXhrFailure(errorMessage) {
                console.log('[Digger] digDeep error: ' + errorMessage);
                reportDigFailure(thumbUri, zoomPageUri);
                resolve(null);
            })
        });
    };


    /**
     * Excute the GET to fetch a zoom-page document, and inspect it to find the full-sized 
     * media pointed to by the gallery thumb image.
     */
    function processZoomPage(thumbUrl, zoomPageUrl) {
        return (
            u.getXhrResponse('GET', zoomPageUrl.href, 'document')
            .then(function lookThroughDocument(doc) {
                var p = null;

                Output.toOut('Examining detail page ' + u.extractFilename(zoomPageUrl.href));            

                // First look in the special rules for a strategy that's already 
                // been figured out by me. See if we can just get the Uri from there.
                var blessedZoomUri = Logicker.findBlessedZoomUri(doc, thumbUrl.href);                    
                if (!!blessedZoomUri) {
                    console.log('[Digger] Found blessed full-size uri: ' + blessedZoomUri);
                    p = Promise.resolve({
                        thumbUri: thumbUrl.href, 
                        zoomUri: blessedZoomUri,
                    });
                }
                // Degenerate case -- no investigation options -- just complete with the zoom page URI itself.
                else if (!u.exists(me.options)) {
                    console.log('[Digger] No options, completing fetch with zoomPageUri itself: ' + zoomPageUrl.href);
                    p = Promise.resolve({
                        thumbUri: thumbUrl.href,
                        zoomUri: zoomPageUrl.href
                    });
                }
                // As the Logicker requires async operation to find the largest <img> on a page,
                // use a callback for the general inspection after using the Logicker.
                else if (me.options.imgs === true) {
                    Output.toOut('Comparing image sizes... Looking for largest..');

                    p = (
                        Logicker.getPairWithLargestImage(thumbUrl.href, doc)
                        .then(function stuff(pair) {
                            return Promise.resolve(pair);
                        })
                        .catch(function fallbackToInspection() {
                            return inspectZoomPage(doc, thumbUrl, zoomPageUrl);
                        })
                    );
                }
                // Final catch-all
                else {
                    p = inspectZoomPage(doc, thumbUrl, zoomPageUrl);
                }

                return p;
            })
            .then(function reportSuccess(pair) {
                return reportDigSuccess(pair.thumbUri, pair.zoomUri);
            })
            .catch(function onError(errorMessage) {
                console.log(
                    '[Digger] Process zoom-page failed for reason:\n' + 
                    '  -- ' + JSON.stringify(errorMessage)
                );
                return reportDigFailure(thumbUrl.href);
            })
        );
    }

    
    /**
     * inspect the zoom page imgs, cssBgs, videos, audios, js, Qs vals to find 
     * whatever zoom media item we can for the gallery thumb.
     */
    function inspectZoomPage(doc, thumbUrl, zoomPageUrl) {
        var zoomUri = null;
        var p = null;

        Output.toOut('Searching through content...');

        // For each enabled investigation option, try to find the zoom media item.
        Object.keys(me.options).forEach(function checkUris(optName) {
            if (!zoomUri && me.options[optName] === true) {
                zoomUri = findZoomUri(doc, thumbUrl, zoomPageUrl, optName);
            }
        });

        if (zoomUri) {
            p = Promise.resolve({
                thumbUri: thumbUrl.href,
                zoomUri: zoomUri
            });            
        }
        else {
            console.log('[Digger] Inspection found no zoom URI.');
            p = Promise.resolve(null)
        }

        return p;
    }


    /**
     * Try to find the pointed-to media item in the document corresponding to the thumb. 
     */
    function findZoomUri(d, tUrl, zpUrl, optionName) {
        var findMediaUris = SCRAPING_TOOLS[optionName] || (function() { return []; });
        var urls = findMediaUris(d, { href: zpUrl.href });
        var zUri = null;

        Output.toOut('Sifting through ' + optionName + ' content...');

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