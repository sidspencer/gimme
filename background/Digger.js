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

        response: (function() {}),
        startingGalleryMap: {},
        options: Options,
        digOpts: { doScrape: true, doDig: true },

        inflightThumbUris: [],        
        harvestedUriMap: {},
        outputIdMap: {},
        
        completedXhrCount: 0,
        responseWasCalled: false,
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
        me.response = starter.response;
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
            me.response(me.harvestedUriMap);
        }
        if (me.digOpts.doScrape) {
            discoverGallery(doc, loc);
        }
        else if (me.digOpts.doDig) {
            Object.keys(me.startingGalleryMap).forEach(function setUpInflightStatus(thumbUri) {
                var id = me.inflightThumbUris.push(thumbUri);
                me.outputIdMap[thumbUri] = id;
                Output.addNewEntry(id, thumbUri);
            });
            
            Object.keys(me.startingGalleryMap).forEach(function digOneUri(thumbSrc) {
                setTimeout(function asyncDigDeep() {
                    me.digDeep(thumbSrc, me.startingGalleryMap[thumbSrc]);
                }, 1);
            });
        }
        else {
            discoverGallery(doc, loc)
        }
    };


    /**
     * Perform a scrape and dig of only the me.startingGalleryMap thumb src -> zoom uri map..
     */
    me.digStarterMap = function digStarterMap(doc, loc) {
        me.harvestedUriMap = {};
        me.inflightThumbUris = [];
        me.outputIdMap = {};        

        if (!me.hasStarterMap()) {
            Output.toOut('No starter map values found. Must scrape the page.')
        }
            
        discoverGallery(doc, loc);
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
                console.log('[Digger] Adding to map: [' + thumbUri + ' -> ' + zoomUri + ']');

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
        // If the LocationGrabber got us stuff, there will already be some entries. Merge them in.
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
                me.response(Object.values(galleryMap));
                return;
            }
            else {
                resetAlarm();
            }

            // Do a keys traversal to get each pair and send out the xhr to try to find
            // the linked media from the gallery thumbs.
            Object.keys(galleryMap).forEach(function digDeepForSrcAndPageUrl(thumbUri) {
                if (u.exists(thumbUri)) {
                    var zoomPageUri = galleryMap[thumbUri];

                    if (u.exists(zoomPageUri)) {
                        setTimeout(function asyncDigDeep() {
                            me.digDeep(thumbUri, zoomPageUri);
                        }, 1);
                    }
                    else {
                        console.log('[Digger] No zoomPageUri found for thumbUri: ' + thumbUri);
                    }
                }
                else {
                    console.log('[Digger] Thumb URI was blank.');
                }
            });
        }
        else {
            Output.toOut('Discovery found nothing matching on the page. Try reloading?');
            console.log('[Digger] No href/img gallery things found. Try reloading?');
            
            me.response([]);
            return;
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
            '[Digger] Zoomed image reported. thumbUri: "' + thumbUri + '"\n  zoomedImgUri: "' + zoomedImgUri +'"'
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
        if (allDiggingIsDone() && !me.responseWasCalled) {
            me.responseWasCalled = true;            
            console.log('[Digger] All XHRs Complete. Calling me.response().' );
            chrome.alarms.clear(DIG_SAVE);

            Digger.previouslyHarvestedUriMap = me.harvestedUriMap;
            me.response(me.harvestedUriMap);
            return;
        }
        
        // Reset the alarm. Give ourselves 1 more minute before timeout.
        resetAlarm();
    }


    /**
     * Syntactic sugar for completing XHR successfully with the proper "full-size" media item.
     */
    function reportDigSuccess(thumbUri, zoomUri) {
        pushNewFullSizeImgUri(thumbUri, zoomUri);
        completeXhr(thumbUri, zoomUri);
        return true;
    }


    /**
     * Syntactic sugar for completing the XHR without finding a suitable "full-size" media item. 
     */
    function reportDigFailure(thumbUri, zoomUri) {
        completeXhr(thumbUri, (zoomUri || '[not found]'));
        return false;
    }


    /**
     * Use HEAD requests to resolve what the gallery links point to. If they point to media files, we're
     * done. If they point to documents, then call another function to further investigate those documents.  
     */
    me.digDeep = function digDeep(thumbUri, zoomPageUri) {
        // Validate URIs exist, and the zoomPageUri is of a fetchable protocol.
        if (!u.exists(thumbUri) || !u.exists(zoomPageUri) || !u.isFetchableUri(zoomPageUri)) {
            console.log(
                '[Digger] Cannot dig due missing/unfetchable URIs. [' + 
                (thumbUri || '-blank-') + ', ' + 
                (zoomPageUri || '-blank-') + ']'
            );

            return reportDigFailure(thumbUri, zoomPageUri);
        }
        
        // New XHR HEAD request
        var xhr = new XMLHttpRequest();

        // On completion, decide whether it's the media we're looking for or another document to 
        // investigate
        xhr.onreadystatechange = function onXhrReadyStateChange() {            
            if (this.readyState == XMLHttpRequest.HEADERS_RECEIVED && (this.status != 200)) {
                console.log('[Digger] Error Status ' + this.status + ' fetching:\n  ' + zoomPageUri);
                return reportDigFailure(thumbUri, zoomPageUri);
            } 
            else if (this.readyState == XMLHttpRequest.HEADERS_RECEIVED) 
            {
                // Report anything other than HTML documents as found media.
                var contentType = this.getResponseHeader('Content-Type');
                if (contentType && contentType.indexOf('text/html') !== -1) {
                    return processZoomPage(new URL(thumbUri), new URL(zoomPageUri));
                } 
                else {                    
                    return reportDigSuccess(thumbUri, zoomPageUri);
                }
            }
        };
        
        // On error, log the exception status and call complete on the xhr.
        xhr.onerror = function onXhrError() {
            console.log('[Digger] Exception Status ' + this.status + ' for: ' + zoomPageUri);
            return reportDigFailure(thumbUri, zoomPageUri);
        };

        xhr.open('HEAD', zoomPageUri, true);
        xhr.send();
    };


    /**
     * Excute the GET to fetch a zoom-page document, and inspect it to find the full-sized 
     * media pointed to by the gallery thumb image.
     */
    function processZoomPage(thumbUrl, zoomPageUrl) {
        // Do a GET of type 'document' 
        var xh = new XMLHttpRequest();

        // Inspect the document for the expected media item.
        xh.onreadystatechange = function xhRsc() {
            if (this.readyState == XMLHttpRequest.DONE) 
            {
                if (this.status != 200 || !this.response || !this.responseXML) {  
                    console.log('[Digger] bad status or no response for GET of: ' + zoomPageUrl.href);
                    return reportDigFailure(thumbUrl.href, zoomPageUrl.href);
                }

                var doc = this.responseXML;

                // First look in the special rules for a strategy that's already 
                // been figured out by me. See if we can just get the Uri from there.
                var blessedZoomUri = Logicker.findBlessedZoomUri(doc, thumbUrl.href);                    
                if (!!blessedZoomUri) {
                    console.log('[Digger] Found blessed full-size uri: ' + blessedZoomUri);
                    return reportDigSuccess(thumbUrl.href, blessedZoomUri);
                }

                // Degenerate case -- no investigation options -- just complete with the zoom page URI itself.
                if (!u.exists(me.options)) {
                    console.log('[Digger] No options, completing fetch with zoomPageUri itself: ' + zoomPageUrl.href);
                    return reportDigSuccess(thumbUrl.href, zoomPageUrl.href);
                }

                // As the Logicker requires async operation to find the largest <img> on a page,
                // use a callback for the general inspection after using the Logicker.
                if (me.options.imgs === true) {
                    Logicker.findUrlOfLargestImage(doc, function onFound(urlOfLargestImage) {                            
                        if (!!urlOfLargestImage) {
                            return reportDigSuccess(thumbUrl.href, urlOfLargestImage.href);
                        }

                        // Do a page inspection if the Logicker failed.
                        inspectZoomPage(doc, thumbUrl, zoomPageUrl);
                    });
                }
                // Just in case we're not looking at images, also call the investigative code.
                else {
                    inspectZoomPage(doc, thumbUrl, zoomPageUrl);
                }
            }
        };
    
        // If there is an error, log and report the failure.
        xh.onerror = function xhError(error) {
            console.log('[Digger] GET zoom-page error: ' + JSON.stringify(error));
            return reportDigFailure(thumbUrl.href);
        };

        xh.open('GET', zoomPageUrl.href, true);
        xh.responseType = 'document';
        xh.send();
    }

    
    /**
     * inspect the zoom page imgs, cssBgs, videos, audios, js, Qs vals to find 
     * whatever zoom media item we can for the gallery thumb.
     */
    function inspectZoomPage(doc, thumbUrl, zoomPageUrl) {
        var zoomUri = null;

        // For each enabled investigation option, try to find the zoom media item.
        Object.keys(me.options).forEach(function checkUris(optName) {
            if (!zoomUri && me.options[optName] === true) {
                if (zoomUri = findZoomUri(doc, thumbUrl, zoomPageUrl, optName)) {
                    return reportDigSuccess(thumbUrl.href, zoomUri);
                }
            }
        });

        // If we found nothing, report that.
        return reportDigFailure(thumbUrl.href);
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


    /**
     * Create the alarm for calling me.response() for us if the XHRs hang or something goes
     * wrong after SIXTY SECONDS.
     */
    function resetAlarm() {
        chrome.alarms.clear(DIG_SAVE);

        chrome.alarms.create(DIG_SAVE, {
            periodInMinutes: 1.0    
        });
    }


    /**
     * Alarm Listener for DIG_SAVE timeout event. 
     */
    chrome.alarms.onAlarm.addListener(function(alarm){
        if (alarm.name === DIG_SAVE) {
            if (me.inflightThumbUris.length && !me.responseWasCalled) {
                me.responseWasCalled = true;
                
                console.log(
                    '[Digger] DIG_SAVE event tiggering response. Unresolved thumb URI count: ' 
                    + me.inflightThumbUris.length
                );
                me.inflightThumbUris.forEach(function listAsRemaining(thumbUri) {
                    console.log('    - ' + thumbUri);
                });

                chrome.alarms.clear(DIG_SAVE);  
                Digger.previouslyHarvestedUriMap = me.harvestedUriMap;                
                me.response(me.harvestedUriMap);
            }            
        }
    });


    // Return the Digger instance.
    return me;
});