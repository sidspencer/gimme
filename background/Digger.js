'use strict'

/** 
 * Factory Function.
 * Worker bee for GimmeGimmieGimmie. Looks through various types of linked media, returns
 * the URLs to the popup.
 */
var Digger = (function Digger(Scraper, Output, Logicker, Utils, Options) {
    // instance object
    var me = {
        initialized: false,

        startingGalleryMap: {},
        options: Options,
        digOpts: { doScrape: true, doDig: true },

        inflightThumbUris: [],        
        harvestedUriMap: {},
        outputIdMap: {},
        
        completedXhrCount: 0,
        soleInspectionOption: null,
    };

    // aliases
    var u = Utils;

    // constants
    var DIG_SAVE = 'DIG_SAVE';
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
     * Initialization function. Must be called prior to digging. 
     */
    me.init = function init(starter) {
        me.digOpts = starter.digOpts;
        me.startingGalleryMap = starter.galleryMap;
        me.initialized = true;
    };


    /**
     * Is this the only inspection option? 
     */
    function isSoleOption(optName) {
        return (optName === me.soleInspectionOption);
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
    me.digGallery = function digGallery(doc, loc) {
        me.harvestedUriMap = {};
        me.inflightThumbUris = [];
        me.outputIdMap = {};

        // Follow the options. If we're told:
        //  no scrape & no dig -- just call the callback. 
        //  yes scrape -- do it all normally through the default digDeep() behavior.
        if ((me.digOpts.doScrape === false) && (me.digOpts.doDig === false)) {
            me.harvestedUriMap = {};
            return Promise.resolve(me.harvestedUriMap);
        }
        if (me.digOpts.doScrape) {
            return discoverGallery(doc, loc);
        }
        else if (me.digOpts.doDig) {
            Object.keys(me.startingGalleryMap).forEach(function setUpInflightStatus(thumbUri) {
                var id = me.inflightThumbUris.push(thumbUri);
                me.outputIdMap[thumbUri] = id;
                Output.addNewEntry(id, thumbUri);
            });
            
            var digDeepPromises = [];
            Object.keys(me.startingGalleryMap).forEach(function digOneUri(thumbSrc) {
                digDeepPromises.push(me.digDeep(thumbSrc, me.startingGalleryMap[thumbSrc]));
            });

            return (
                Promise.all(digDeepPromises)
                .then(function turnPairsIntoMap(pairs) {
                    var harvest = {};

                    pairs.forEach(function reap(pair) {
                        if (pair && pair.thumbUri && pair.zoomUri && (Object.values(harvest).indexOf(pair.zoomUri) === -1)) {
                            harvest[pair.thumbUri] = pair.zoomUri;
                        }
                    });
                    
                    return Promise.resolve(harvest);
                })
            );
        }
        else {
            return discoverGallery(doc, loc)
        }
    };


    /**
     * Take the passed-in map, and add all the src->uri mappings in from to
     * said passed-in map. Set up the other tracking and ui needed. 
     * UPDATES THE "to" AND "ids" MAPS IN-PLACE!
     */
    function mergeGalleryMaps(from, to, ids) {
        // Apply the optionally-set me.urisToDig
        Object.keys(from).forEach(function setNewLinkHrefs(thumbUri) {
            // Store the old value, if there was one, and override with our new one.
            var newPageUri = from[thumbUri];            
            var oldPageUri = to[thumbUri];
            var idx = me.inflightThumbUris.indexOf(thumbUri);
            var id = -1;

            if (!!oldPageUri) {
                id = ids[oldPageUri];
                Output.deleteEntry(id);
                delete ids[oldPageUri];
            }
            
            if (idx === -1) {
                id = me.inflightThumbUris.push(thumbUri);
                to[thumbUri] = newPageUri;
                ids[newPageUri] = id; 
            }
            else {
                me.inflightThumbUris.splice(idx, 1);

                id = me.inflightThumbUris.push(thumbUri);
                to[thumbUri] = newPageUri;
                ids[newPageUri] = id;
            }

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
                    map[thumbUri] = zoomUri;                        
                    var newId = me.inflightThumbUris.push(thumbUri);
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
        me.inflightThumbUris = [];
        me.outputIdMap = {};

        if (me.digOpts.doScrape !== false) {
            galleryMap = buildSimpleGalleryMap(doc, loc);
        }

        if (!!me.startingGalleryMap && !!Object.keys(me.startingGalleryMap).length) {
            mergeGalleryMaps(me.startingGalleryMap, galleryMap, me.outputIdMap);
        }

        // Perform the XHRs to find the zoom image on the assumed zoomPageUrls. 
        var thumbUriCount = Object.keys(galleryMap).length;  
        if (thumbUriCount > 0) {
            Output.toOut('Discovered ' + thumbUriCount + ' probable gallery links. Now digging deep...');

            if (me.digOpts.doDig === false) {
                console.log('[Digger] Instructed to not dig. Responding with discovered URIs.')
                return Promise.resolve(galleryMap);
            }

            // Do a keys traversal to get each pair and send out the xhr to try to find
            // the linked media from the gallery thumbs.
            var digDeepPromises = [];            
            Object.keys(galleryMap).forEach(function digDeepForSrcAndPageUrl(thumbUri) {
                if (u.exists(thumbUri)) {
                    var zoomPageUri = galleryMap[thumbUri];

                    if (u.exists(zoomPageUri)) {
                        digDeepPromises.push(me.digDeep(thumbUri, zoomPageUri));
                    }
                    else {
                        console.log('[Digger] No zoomPageUri found for thumbUri: ' + thumbUri);
                    }
                }
                else {
                    console.log('[Digger] Thumb URI was blank.');
                }
            });

            return (
                Promise.all(digDeepPromises)
                .then(function turnPairsIntoMap(pairs) {
                    var harvest = {};

                    pairs.forEach(function reap(pair) {
                        if (pair && pair.thumbUri && pair.zoomUri && (Object.values(harvest).indexOf(pair.zoomUri) === -1)) {
                            harvest[pair.thumbUri] = pair.zoomUri;
                        }
                    });
                    
                    return Promise.resolve(harvest);
                })
            );
        }
        else {
            Output.toOut('Discovery found nothing matching on the page. Try reloading?');
            console.log('[Digger] No href/img gallery things found. Try reloading?');
            
            return Promise.resolve({});
        }        
    }


    /**
     * Return whether or not we have dug all the entries in the gallery.
     */
    function allDiggingIsDone() {
        return (
            me.inflightThumbUris.length === 0
        ); 
    }


    /**
     * Wrapper for adding to the harvested/found "full-size" media uris, so we don't double-add.
     */
    function pushNewFullSizeImgUri(thumbUri, newUri) {
        var values = Object.values(me.harvestedUriMap);

        // Don't add nulls, don't double-add.
        if (!u.exists(newUri) || (values.indexOf(newUri) !== -1)) {
            return;
        }
        
        me.harvestedUriMap[thumbUri] = newUri;

        // Get the id of the uri, used to communicate with the UI,
        // And use it to update the UI.
        var id = me.outputIdMap[thumbUri];
        Output.setEntryAsDug(id, newUri);
        Output.toOut('Adding dug URLs to download list. Length: ' + (values.length + 1));
    }


    /**
     * On the end of the xhr, onerror or on onloadend, complete our tracking of the xhr "digging".
     */
    function completeXhr(thumbUri, zoomedImgUri) {
        console.log(
            '[Digger] Zoomed image reported.\n' +
            '         thumbUri: ' + thumbUri + '\n' +
            '         zoomedImgUri: ' + zoomedImgUri + ''
        );
        
        // If we can, now remove this thumbUri from the inflight array.
        if (!!thumbUri) {
            Output.toOut('Completed ' + (++me.completedXhrCount) + ' media fetches...');
            var fetchIndex = me.inflightThumbUris.indexOf(thumbUri);
            
            if (fetchIndex !== -1) {
                me.inflightThumbUris.splice(fetchIndex, 1);
            }
        }

        // If all the xhrs have succeeded, cancel the alarm, and call the
        // callback by ourselves.
        if (allDiggingIsDone()) {
            console.log('[Digger] All XHRs Complete.' );
            Digger.previouslyHarvestedUriMap = me.harvestedUriMap;
            return;
        }        
    }


    /**
     * Syntactic sugar for completing XHR successfully with the proper "full-size" media item.
     */
    function reportDigSuccess(thumbUri, zoomUri) {
        pushNewFullSizeImgUri(thumbUri, zoomUri);
        completeXhr(thumbUri, zoomUri);
        
        return Promise.resolve({
            thumbUri: thumbUri,
            zoomUri: zoomUri,
        });
    }


    /**
     * Syntactic sugar for completing the XHR without finding a suitable "full-size" media item. 
     */
    function reportDigFailure(thumbUri, zoomUri) {
        completeXhr(thumbUri, (zoomUri || '[not found]'));
        return Promise.resolve(null);
    }


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
            
            var lastSlashIdx = thumbUri.lastIndexOf('/');
            var thumbFilename = thumbUri.substring((lastSlashIdx === -1) ? 0 : (lastSlashIdx + 1));

            Output.toOut('Inspecting thumbnail named ' + thumbFilename + ' ...');
            console.log('[Digger] Queueing XHR for thumbnail ' + thumbFilename);

            // Note, we always resolve.
            u.sendXhr('HEAD', zoomPageUri)
            .then(function processCompletedXhr(xhr) {
                // Report anything other than HTML documents as found media.
                if (xhr.getResponseHeader('Content-Type').indexOf('text/html') !== -1) {
                    processZoomPage(new URL(thumbUri), new URL(zoomPageUri))
                    .then(function stuff(pair) {
                        resolve(pair);
                    });
                } 
                else {                    
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