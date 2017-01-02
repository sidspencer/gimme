'use strict'

/** 
 * Factory Function.
 * Worker bee for GimmeGimmieGimmie. Looks through various types of linked media, returns
 * the URLs to the popup.
 */
var Digger = (function Digger(Output, Logicker, Utils, Options) {
    // The instance object.
    var me = {
        webPath: '',
        response: (function() {}),
        localDoc: {},
        locator: {},
        dugUpUris: [],
        uriIds: [],
        inflightThumbUris: [],
        urisToDig: {},
        options: Options,
        digOpts: {},
    };

    // Alias Utils.
    var u = Utils;

    // Set the default option set if none were passed in.
    if (!me.options) {
        me.options = {
            imgs: true,
            cssBgs: true,
            videos: true,
            js: true,
            audios: true,
            qs: true,
        }
    }




    /**
     * Build up and return an array of Regexes that will match the
     * Mime Types that are valid for our kind of dig, based on the opts.
     */
    function getAllowedMimeTypeRxs() {
        var allowed = [];

        if (me.options.imgs === true || me.options.cssBgs === true) {
            allowed.push(/^image\//);
        }
        if (me.options.videos === true) {
            allowed.push(/^video\//);
            allowed.push(/^application\/octet-stream\/$/);
        }
        if (me.options.js === true) {
            allowed.push(/^text\/javascript$/);
        }
        if (me.options.audio === true) {
            allowed.push(/^audio\//);
        }

        return allowed;
    }


    /**
     * Check the src/uri/href/filename for known audio extensions.
     */
    function isAllowedAudioFile(name) {
        var allowedRx = /^.+?\.(mp3|m4a|aac|wav|ogg|aiff|aif|flac)(\?)?.+?$/i;
        return allowedRx.test(name);
    }


    /**
     * Check the src/uri/href/filename for known video extensions.
     */
    function isAllowedVideoFile(name) {
        var allowedRx = /^.+?\.(mp4|flv|f4v|m4v|mpg|mpeg|wmv|mov|avi|divx|webm)(\?)?.+?$/i;
        return allowedRx.test(name);
    }


    /**
     * Check the src/uri/href/filename for known image extensions.
     */
    function isAllowedImageFile(name) {
        var allowedRx = /^.+?\.(jpg|jpeg|gif|png|tiff|tif|pdf)(\?)?.+?$/i;
        return allowedRx.test(name);
    }


    /**
     * Override the srcToPageUris map.
     */
    me.overrideUrisToDig = function overrideUrisToDig(uriArr, srcArr) {
        if (u.isEmpty(uriArr) || u.isEmpty(srcArr)) {
            return;
        }

        me.urisToDig = {};
        for (var i=0; i < uriArr.length && i < srcArr.length; i++) {
            me.urisToDig[srcArr[i]] = uriArr[i];
        }
    };

    
    /**
     * convenience function to flag our having override uris or not.
     */
    me.hasOverrideUris = function hasOverrideUris() {
        return (!u.isEmpty(me.urisToDig));
    };


    /**
     * Set options about scraping, digging, will grow in time. 
     */
    me.setDigOpts = function setDigOpts(opts) {
        me.digOpts = opts;
    };

    /**
     * Collect all the values of "propName" of all the tags of a given kind on
     * the page.
     */
    var getElementUrls = function getElementUrls(inOpts) {
        var ptns = {
            doc: me.localDoc,
            selector: '*',
            propName: 'currentSrc',
            subPropName: undefined,
            subSubPropName: undefined,
            altPropName: 'href',
            altSubPropName: undefined,
            altSubSubPropName: undefined,
        };

        // Only use the defaults if we were not passed in a valid options object.
        if (u.exists(inOpts) && u.exists(inOpts.doc) && u.exists(inOpts.selector) && u.exists(inOpts.propName)) {
            ptns = inOpts;
        }

        // Grab whatever the selector told us to on the document we were told to.
        var tagUrls = [];
        var tags = ptns.doc.querySelectorAll(ptns.selector);

        // get the "propname" from the tags. 
        // optionally go deeper with subPropName and subSubPropName.
        if (tags && tags.length) {
            for (var i = 0; i < tags.length; i++){
                var src = '';
                var prop = '';
                var subProp = '';
                var subSubProp = '';

                // Try to find the prop. Traverse as far as we have subprops for.
                if (u.exists(ptns.propName)) {
                    prop = tags[i][ptns.propName];

                    if (u.exists(ptns.subPropName) && u.exists(prop)) {
                        subProp = prop[ptns.subPropName];

                        if (u.exists(ptns.subSubPropName) && u.exists(subProp)) {
                            subSubProp = subProp[ptns.subSubPropName];
                            
                            if (u.exists(subSubProp)) {
                                src = subSubProp;
                            }
                            else {
                                src = subProp;
                            }
                        }
                        else if (u.exists(subProp)) {
                            src = subProp;
                        }
                    }
                    else if (u.exists(prop)) {
                        src = prop;
                    }
                }
                else {
                    src = '';
                }
            
                // if the prop* field names don't work, try the alt* ones.
                if (!u.exists(src)) {
                    if (u.exists(ptns.altPropName)) {
                        prop = tags[i][ptns.altPropName];

                        if (u.exists(ptns.altSubPropName) && u.exists(prop)) {
                            subProp = prop[ptns.altSubPropName];

                            if (u.exists(ptns.altSubSubPropName) && u.exists(subProp)) {
                                subSubProp = subProp[ptns.altSubSubPropName];
                                
                                if (u.exists(subSubProp)) {
                                    src = subSubProp;
                                }
                                else {
                                    src = subProp;
                                }
                            }
                            else if (u.exists(subProp)) {
                                src = subProp;
                            }
                        }
                        else if (u.exists(prop)) {
                            src = prop;
                        }
                    }
                    else {
                        src = '';
                    }
                }                
                
                // Process the src that we got.
                var cleansedUrl = srcToUrl(src, ptns.doc.location);

                if (u.exists(cleansedUrl)) {
                    tagUrls.push(cleansedUrl);
                }
            };
        }

        return tagUrls;
    };


    /**
     * Amass all the background-images. This is for places like Flickr.
     */
    var getAllBackgroundUris = function getAllBackgroundUris(d) {
        d = (d ? d : me.localDoc);

        var uriList = [];
        var nodes = d.querySelectorAll('*');

        // Look for all background-images.
        for (var i=0; i < nodes.length; i++) {
            var node = nodes[i];

            // Extract the style.backgroundImage, and take the 'url("' and '")' off of it.
            if (u.exists(node) && u.exists(node.style) && u.exists(node.style.backgroundImage)) {
                var bgUrl = node.style.backgroundImage;
                var extractedBgUrl = bgUrl.replace(/^url\(/, '').replace(/\)$/, '').replace("'", '').replace('"', '');                

                if (u.exists(extractedBgUrl)) {
                    bgUrl = extractedBgUrl;
                }

                var cleansedUri = srcToUri(bgUrl, d.location);

                // Add to the list if an OK url.
                if (u.exists(cleansedUri)) {
                    uriList.push(cleansedUri);
                }
            }
        }

        return uriList;
    };


    /**
     * Amass the video urls. Oh dear....
     */
    function getAllVideoUrls(d) {
        d = (d ? d : me.localDoc);

        var urlList = [];

        // Query for video-src-holding elements. Currently no <object> or <embed> support.
        var videos = d.querySelectorAll('video, a[href], source');
        if (Array.isArray(videos)) {
            videos.forEach(function getVideoCurrentSrc(vid) {
                if (vid) {
                    // First try for currentSrc. It's on the media elements.
                    if (vid.currentSrc) {
                        vidSrc = vid.currentSrc;
                    }
                    // Next try attributes.src. It may be there instead.
                    else if (vid.attributes.src) {
                        vidSrc = vid.attributes.src.textContent;
                    }
                    // If we're a link or something, we'll have an href instead.
                    else if (vid.href) {
                        vidSrc = vid.href;
                    }
                    // If for some reason, that prop doesn't exist, get it from the attributes.
                    else if (vid.attributes.href) {
                        vidSrc = vid.attributes.href.textContent;
                    }

                    // Only grab video srcs. turn the src into a uri, push it if it worked.
                    if (vidSrc && vidSrc.match(/\.(mpg|mp4|mov|avi|wmv|flv)\.[\?](.+?)$/)) {
                        //var uri = me.getUriForHref(vidSrc, d.location);
                        var cleansedUrl = srcToUrl(vidSrc, d.location);

                        if (u.exists(cleansedUrl)) {
                            urlList.push(cleansedUrl);
                        }
                    }
                }
            });
        }

        return urlList;
    };


    /**
     * Scrape the javascript for more links to media.
     */
    var defaultAllJsSelector = '*[onclick][onmouseover][onmouseout][onmouseenter][href^="javascript:"],script';
    function scrapeAllJsUrls(d, selector) {
        d = (u.exists(d) ? d : me.localDoc);
        selector = (u.exists(selector) ? selector : defaultAllJsSelector);

        var urlList = [];

        // Look in all the on* attributes, and inside script tags by default. Can be overriden
        // by the user.
        var clickableTags = d.querySelectorAll(selector);
        clickableTags.forEach(function digClickableTags(t) {
            if (!t || !t.name) {
                return;
            }

            var js = '';
            var atts = t.attributes;
            var jsAtts = [
                'onclick',
                'onmouseover',
                'onmouseout',
                'onmouseenter',
            ];

            // If it's a script tag, concat the contents of it.
            if (t.name = 'script' && u.exists(t.textContent)) {
                js = js.concat(t.textContent);
            }
            // If it's a javascript: href, concat the value of the attribute.
            else if (u.exists(t.href) && /^javascript\:/.test(t.href)) {
                js = js.concat(t.href);
            }
            // Or use the attribute href value.
            else if (u.exists(atts) && u.exists(atts.href) && /^javascript\:/.test(atts.href) && u.exists(atts.href.textContent)) {
                js = js.concat(atts.href.textContent)
            }
            
            // Go through the other on* attributes.
            if (u.exists(atts)) {
                jsAtts.forEach(function mungeJsAttribute(attName) {
                    if (u.exists(atts[attName]) && u.exists(atts[attName].textContent)) {
                        var content = atts[attName].textContent;
                        
                        if (u.exists(content)) {
                            js = js.concat(content);
                        }
                    }
                });
            }
           
            // Grab all the srcs/urls we can find in the big concatenated javascript string.
            if (js) {
                // Find all the matches that we can for things looking like media files.
                var possibleMatches = js.match(/(\'|\").+?\.(jpg|png|gif|mp4|flv|wmv|webm|mov)\.[\?].+?(\'|\")/g);

                possibleMatches.forEach(function extractUriFromMatch(match) {
                    if (u.exists(match) && (typeof match === 'string')) {
                        var splitChar = ((match.indexOf("'") === -1) ? "'" : '"');
                        var splits = match.split(splitChar);

                        // If the match looked right, pull out the possible href, try to turn it into a uri.
                        // If we can, push it.
                        if (Array.isArray(splits) && splits.length > 1) {
                            var possibleHref = splits[1];
                            var allowedHref = '';

                            if (!allowedHref && (me.options.imgs === true)) {
                                if (isAllowedImageFile(possibleHref)) {
                                    allowedHref = possibleHref;
                                }
                            }
                            if (!allowedHref && (me.options.audios === true)) {
                                if (isAllowedAudioFile(possibleHref)) {
                                    allowedHref = possibleHref;
                                }
                            }
                            if (!allowedHref && (me.options.videos === true)) {
                                if ( isAllowedVideoFile(possibleHref)) {
                                    allowedHref = possibleHref;
                                }
                            }

                            var possibleUrl = srcToUrl(allowedHref, d.location);
                            if (u.exists(possibleUrl)) {
                                urlList.push(possibleUrl);
                            }
                        }
                    }
                });
            }
        });

        return urlList;
    }


    function scrapeAllJsUris(d, selector) {
        return (
            scrapeAllJsUrls(d, selector).map(function returnUrisFromUrls(url) {
                return url.href;
            })
        );
    }


    /**
     * Scrape the current document for all the <img> uris.
     */
    function scrapeAllImgUris() {
        var imgUrls = getElementUrls({
            selector: 'img',
            propName: 'currentSrc',
            altPropName: 'attributes',
            altSubPropName: 'src',
            altSubSubPropName: 'textContent',
        });

        var imgUris = [];

        // Make URL objects for all the audio srcs, to get the pathing right.
        // pop out all the uris that have an unknown file extension.
        for (var i=0; i < imgUrls.length; i++) {
            var uri = imgUrls[i].href;
            
            if (isAllowedImageFile(uri)) {
                imgUris.push(uri);
            }
        }

        return imgUris;
    }


    /**
     * Scrape the current document for anything with a css background-image.
     * extract the uri from the "url('uri')" before returning.
     */
    function scrapeAllCssBgUris() {
        var cssBgUrls = getElementUrls({
            selector: '*',
            propName: 'style',
            subPropName: 'backgroundImage',
        });
        var cssBgUris = [];

        cssBgUrls.forEach(function extractUri(uri, idx, uris) {
            cssBgUris.push(
                uri.replace(/^url\(('|")?/, '').replace(/('|")?\)$/, '')
            );
        });

        return cssBgUris;
    }


    /**
     * Scrape the current document for any type of video. <video>, <object>, <embed>.
     * Try to grab flvs as ya can.
     */
    function scrapeAllVideoUris() {
        var videoUrls = getElementUrls({
            selector: 'video[src],object[data],source[src],embed[src]',
            propName: 'src',
            altPropName: 'data',
        });
        var videoUris = [];

        // Create URL objects for the uris, to make sure they get pathed right.
        // pop out the uris which do not have known video extensions.
        for (var i=0; i < videoUrls.length; i++) {
            var uri = videoUrls[i].href;

            if (isAllowedVideoFile(uri)) {
                videoUris.push(uri);
            }
        }

        return videoUris;
    }


    /**
     * Do we think we know what type this file is? And do we want it?
     */
    me.isKnownFileType = function isKnownFileType(name) {
        return (
            !isBannedUri(name) &&
            (isAllowedImageFile(name) || isAllowedVideoFile(name) || isAllowedAudioFile(name))  
        );
    };


    /**
     * Scrape out any file paths and names seen in the querystring.
     */
    function scrapeAllQsUris() {
        var uris = [];
        var qsVars = me.loc.search.split('&');

        // Try to get any variables out of the qs that we can. 
        for (var i=0; i < qsVars.length; i++) {
            var pair = qsVars[i].split('=');
            var val = ((pair.length === 1) ? pair[0].substring(1) : pair[1]);
            
            // If it has a '.' and is of a known filetype, then push it into the 
            // uri list after URL-ifying it.
            if (val && (val.indexOf('.') !== -1) && isKnownFileType(val)) {
                var url = new URL(val, getBaseUri());

                if (u.exists(url.href)) {
                    uris.push(url.href);
                }
            }
        }

        return uris;
    }


    /**
     * Scrape all <audio>,<source>,<param>
     */
    function scrapeAllAudioUris() {
        var audioUrls = getElementUrls({
            selector: 'audio[src],audio > source[src],param[value]',
            propName: 'src',
            altPropName: 'value',
        });
        var audioUris = [];

        // Make URL objects for all the audio srcs, to get the pathing right.
        // pop out all the uris that have an unknown file extension.
        for (var i=0; i < audioUrls.length; i++) {
            var uri = audioUrls[i].href;
            
            if (isAllowedAudioFile(uri)) {
                audioUris.push(uri);
            }
        }

        return audioUris;
    }


    /**
     * Find all the image/movie media that is directly on the current page.
     */
    me.scrape = function scrape(doc, loki, res) {
        me.webPath = loki.origin + loki.pathname.substr(0, loki.pathname.lastIndexOf('/'));
        me.response = res;
        me.localDoc = doc;
        me.locator = loki;
        me.dugUpUris = [];
        me.inflightThumbUris = [];

        var imgUris = [];
        var cssBgUris = [];
        var jsUris = [];
        var videoUris = [];
        var audioUris = [];
        var qsUris = [];

        if (me.options.img === true) {
            imgUris = scrapeAllImgUris();   
        }

        if (me.options.cssBgs === true) {
            cssBgUris = scrapeAllCssBgUris();
        }

        if (me.options.js === true) {
            jsUris = scrapeAllJsUris();
        }
        
        if (me.options.videos === true) {
            videoUris = scrapeAllVideoUris();
        }

        if (me.options.audios === true) {
            audioUris = scrapeAllAudioUris();
        }

        if (me.options.qs === true) {
            qsUris = scrapeAllQsUris();
        }

        me.response (
            [].concat(imgUris)
            .concat(cssBgUris)
            .concat(videoUris)
            .concat(audioUris)
            .concat(qsUris)
        );
    };


    /**
     * Find all the clicked-through (hopefully) large versions of images on pic detail page.
     * Do it by finding all the 'a img' selecteds, and then grabbing the document specified by
     * the <a> -- this is queried for any <img> with a similar filename to the supposed "thumbnail".
     */
    me.digGallery = function digGallery(doc, loki, res) {
        me.webPath = loki.origin + loki.pathname.substr(0, loki.pathname.lastIndexOf('/'));
        me.response = res;
        me.localDoc = doc;
        me.locator = loki;
        me.dugUpUris = [];
        me.inflightThumbUris = [];

        // Follow the options. If we're told:
        //  no scrape & no dig -- just call the callback. 
        //  yes scrape -- do it all normally through the default digDeep() behavior.
        if ((me.digOpts.doScrape === false) && (me.digOpts.doDig === false)) {
            me.dugUpUris = [];
            me.response(me.dugUpUris);
        }
        if (me.digOpts.doScrape) {
            scrapeForGallery(me.urisToDig);
        }
        else if (me.digOpts.doDig) {
            Object.keys(me.urisToDig).forEach(function digOneUri(thumbSrc) {
                me.digDeep(thumbSrc, me.urisToDig[thumbSrc]);
            });
        }
        else {
            scrapeForGallery()
        }
    };


    /**
     * Perform a scrape and dig of only the me.urisToDig thumb src -> zoom uri map..
     */
    me.digOverrideUris = function digOverrideUris(doc, loki, res) {
        me.webPath = loki.origin + loki.pathname.substr(0, loki.pathname.lastIndexOf('/'));
        me.response = res;
        me.localDoc = doc;
        me.locator = loki;
        me.dugUpUris = [];
        me.inflightThumbUris = [];

        if (me.hasOverrideUris()) {
            scrapeForGallery(me.urisToDig);
        }
        else {
            Output.toOut('No override values found. Must scrape the page.')
            scrapeForGallery();            
        }
    }


    /**
     * Does it match a regex in our list of blacklist regexes?
     */
    var isBannedUri = function isBannedUri(uri) {
        if (typeof uri === 'undefined') {
            return true;
        }
        else if (/\/zip\.php\?/.test(uri)) {
            return true;
        }
        else if (/\.zip/.test(uri)) {
            return true;
        }
        else {
            return false;
        }
    }


    /**
     * Take the passed-in map, and add all the src->uri mappings from me.urisToDig to
     * said passed-in map. Set up the other tracking and ui needed, then return the
     * updated map.
     */
    me.overrideGalleryScrape = function overrideGalleryScrape(to, from, ids) {
        // Apply the optionally-set me.urisToDig
        Object.keys(from).forEach(function setNewLinkHrefs(thumbUri) {
            // Store the old value, if there was one, and override with our new one.
            var oldPageUri = to[thumbUri];
            var newPageUri = from[thumbUri];

            if (u.exists(newPageUri)) {
                to[thumbUri] = newPageUri;
            }

            // If there already was an entry, and we replaced it, delete the old info.
            var id = -1;
            if (u.exists(oldPageUri) && Array.isArray(ids)) {
                id = ids[oldPageUri];
                delete ids[oldPageUri];
                
                me.inflightThumbUris[i] = thumbUri;
                console.log('[OVVERIDE UPDATED] thumbSrc: ' + thumbUri + ' -> linkUri: ' + newPageUri);
            }
            // Otherwise, just add to the tracking objects.
            else {
                id = me.inflightThumbUris.push(thumbUri);
                console.log('[OVERRIDE ADDED] src: ' + thumbUri + ' -> linkUri: ' + newPageUri);
            }

            // Finally, add a new Entry. It will overwrite one with the same id.
            ids[newPageUri] = id;
            Output.addNewEntry(id, newPageUri);                 
        });
        
        return to;
    };


    /**
     * Find all the gallery-item looking <a>...<img/>...</a> structures, mapping the src
     * of the thumbnail image to the href of the supposed zoom page.
     * 
     * ALSO URL-IFIES THE SRCs. FROM THIS POINT ON THEY ARE REAL URIs IN THE MAPS/ARRAYS.
     */
    function scrapeForGalleryItems() {
        var map = {};
        var links = me.localDoc.querySelectorAll('a[href]');

        // For all the links, find the <img> tags contained in them. 
        if (links.length > 0) {
            Output.toOut('Looking at ' + links.length + ' possible gallery links...');
            console.log('Found a[href]s on page in count: ' + links.length);

            for (var i=0; i < links.length; i++) {
                var linky = links[i];
                var linkHref = u.exists(linky.href) ? linky.href : linky.attributes.href.value;
                var linkUrl = new URL(linkHref, getBaseUri());
                var containedImgs = linky.querySelectorAll('img[src]');
                
                // Build the map of thumbUri -> zoomPageUrl.
                if (containedImgs.length > 0) {
                    for (var j=0; j < containedImgs.length; j++) { 
                        // Try to get the image src. src and currentSrc will be full uris.
                        // src.value will likely be relative.                            
                        var imgSrc = containedImgs[j].src;

                        if (!u.exists(imgSrc)) {
                            imgSrc = containedImgs[j].currentSrc;;
                        }
                        if (!u.exists(imgSrc)) {
                            imgSrc = containedImgs[j].attributes.src.value;
                        }
                        
                        // create a URL object for the img's src. Powerful things, these URL objects.
                        var imgUrl = new URL(imgSrc, getBaseUri());
                        var thumbUri = imgUrl.href;
                        var zoomUri = linkUrl.href;

                        // Only throw it in the map and the inflightFetchSrcs if both exist.
                        if (u.exists(thumbUri) && u.exists(zoomUri)) {
                            if (!isBannedUri(zoomUri)) {
                                console.log('adding thumbUri: ' + thumbUri + ' -> zoomUri: ' + zoomUri);

                                // put the association in the map... IF IT'S NOT ALREADY THERE!!!!!!!!
                                // Either someone else may have put it there first, or the location grabber
                                // or something. Don't overwrite.
                                if (thumbUri in map) {
                                    console.log(
                                        'Scraped two zoomUris for thumb: ' + thumbUri + 
                                        '\n  zoomUri: ' + map[thumbUri] + 
                                        '\n  ' + zoomUri
                                    );
                                }
                                else {
                                    // into the map. look, it's ---FULLY-QUALIFIED URIs---!!!!!!
                                    map[thumbUri] = zoomUri;
                        
                                    // put it in the list of xhrs about to be in flight.
                                    var newId = me.inflightThumbUris.push(thumbUri);

                                    // put its id in another map, keyed off of the linkUrl's href.
                                    me.uriIds[zoomUri] = newId;

                                    // alert the outside world.
                                    Output.addNewEntry(newId, thumbUri);
                                }
                            }
                        }
                    }
                }
            }
        }

        // This map contains all of the links with images in them, keyed off of the img's src.
        // so it's like, map[img.src] === a.href;
        return map;
    }


    /**
     * Find all the big images on zoom pages, matching the thumbSrc/zoomUri algorithm.
     * Items in the kingThumbToLinkMap ---MUST--- be fully-qualified URIs, http://blah/something/img.jpg?blah=z&f=oo. 
     */
    function scrapeForGallery(kingThumbToLinkMap) {
        // Make a map of all the <img> srcs contained in <a> tags. Sort it as src -> zoomPageUrl.
        // If the LocationGrabber got us stuff, there will already be some entries. Don't
        // stomp them.
        var thumbToLinkMap = {};
        me.inflightThumbUris = [];
        me.uriIds = [];

        if (me.digOpts.doScrape !== false) {
            thumbToLinkMap = scrapeForGalleryItems();
        }
        if (!!kingThumbToLinkMap && !!Object.keys(kingThumbToLinkMap).length) {
            thumbToLinkMap = me.overrideGalleryScrape(thumbToLinkMap, kingThumbToLinkMap, me.uriIds);
        }

        // Perform the XHRs to find the zoom image on the assumed zoomPageUrls. 
        var zoomUriCount = Object.keys(thumbToLinkMap).length;

        // If we have some uris, go dig them. 
        // Unless, of course, the digOpts say not to. Then we only scrape.       
        if (zoomUriCount > 0) {
            Output.toOut('Scrape found ' + zoomUriCount + ' probable gallery links. Now digging deep...');

            if (me.digOpts === false) {
                me.response(Object.values(thumbToLinkMap));
                return;
            }

            // Do a keys traversal to get each src/url pair and send out the xhr to try to find them.
            Object.keys(thumbToLinkMap).forEach(function digDeepForSrcAndPageUrl(thumbUri) {
                if (u.exists(thumbUri)) {
                    var zoomPageUri = thumbToLinkMap[thumbUri];


                    if (u.exists(zoomPageUri)) {
                        // Go dig that zoomPageUri! 
                        me.digDeep(thumbUri, zoomPageUri);
                    }
                    else {

                    }
                }
                else {
                    console.log("Thumb URI was blank.");
                }
            });
        }
        else {
            Output.toOut('Scrape found nothing matching on the page. Try reloading?');
            console.log('No href/img gallery things found. Try reloading?');
            
            me.response([]);
            return;
        }        
    };


    /**
     * Just dig the uris that are passed-in, or alternately dig the Digger's override
     * uris if nothing was passed-in.
     */
    me.digUris = function digUris(srcUriMap) {
        var traversalMap = (u.exists(srcUriMap) ? srcUriMap : me.urisToDig);
        
        Object.keys(traversalMap).forEach(function digEachUri(src) {
            me.digDeep(src, traversalMap[src]);
        });
    };


    /**
     * Algorithms to figure out if the zoomPage's image matches the thumbnail src. Since
     * we are used in a variety of contexts, this could mean any kind of file mapping from 
     * src to dest. It will always start with an image or element with background-image on the
     * gallery thumbs page (srcUrl), and always be tested against some destUrl that could end
     * up being another image, or a movie, or a pdf, or a song.... who knows.
     */
    me.isPossiblyZoomedFile = function isPossiblyZoomedFile(thumbUrl, zoomUrl) {
        var isPossibly = false;

        // confirm type and value existence, then trim whitespace. Otherwise, blank string, which
        // will make isPossibly be returned as false.
        if (!(thumbUrl && zoomUrl && (thumbUrl.href.length > 0) && (zoomUrl.href.length > 0))) {
            isPossibly = false;
            return isPossibly;    
        }

        // Pick out the basic filenames of the src and dest. No file extensions.
        var sname = thumbUrl.pathname.replace(/\/$/, '')
            .substring(thumbUrl.pathname.lastIndexOf('/') + 1)
            .substring(0, thumbUrl.lastIndexOf('.'));
        var zname = zoomUrl.pathname.replace(/\/$/, '')
            .substring(zoomUrl.pathname.lastIndexOf('/') + 1)
            .substring(0, zoomUrl.lastIndexOf('.'));
        
        var sval = '';
        var zval = '';

        // bail if the zoomUri.href is for a thumbnail.
        if (/(thumb|tn_|small|-t\.|)/i.test(zoomUrl.href)) {
            isPossibly = false;
            return isPossibly;
        }

        // Do the low-hanging fruit first. Just don't hit your head on it.
        // first: The happiest of paths.
        if ((sname.indexOf(zname) != -1) || (zname.indexOf(sname) != -1)) {
            isPossibly = true;
            return isPossibly;
        }

        // Strip off file extension, punctuation, and common thumb/zoomed deliniation strings.
        var getRootForName = (function getRootForName(name) {
            var root = '' + name;

            // remove "thumb" or "large" type words.
            root = root.replace(/(thumb|\/tn|small|thumbnail|\-t|full|large)/gi, '-');

            // replace all punctuation with dashes.
            root = root.replace(/(_|-|\(|\)|\.)/gi, '-');

            return root;
        });

        // Get the "root" strings. Test the happy path
        var sroot = getRootForName(sname);
        var zroot = getRootForName(zname);

        if ((zname.indexOf(sroot) != -1) || (sname.indexOf(zroot) != -1)) {
            isPossibly = true;
            return isPossibly;
        }

        // Now we get serious.
        //
        // Try getting the parts of the name alone, like hoping for a set number or something.
        // Start by normalizing the uri
        var normThumbUri = getRootForName(thumbUrl.href.substring(0, thumbUrl.href.indexOf('?') - 1));
        var normZoomUri = getRootForName(thumbUrl.href.substring(0, thumbUrl.href.indexOf('?') - 1));

        // Now get all the path parts of the pathname. we'll check for them individually.
        var sparts = [].concat(thumbUrl.pathname.split('/'));
        var maybes = [];

        // For all the parts of the root filename, look through all the parts of the root test filename,
        // and push a vote of '1' into the maybes array. We will use that to see how "likely" it is they're
        // for the same thing....
        sparts.forEach(function testSParts(spart) {
            if (zoomUrl.href.indexOf(spart) != -1) {
                maybes.push(1);
            }
            else {
                maybes.push(0);
            }
        });

        // count the trues, count the falses. 
        // Cut it off at 70% match.
        var sum = maybes.reduce(function sumMaybeVotes(count, val) {
            return (count + val);
        });

        var maybeRatio = (sum + 0.0) / (maybes.length + 0.0);
        if (maybeRatio > 0.7) {
            isPossibly = true;
        }
    
        return isPossibly;
    };


    /**
     * Return whether or not we have dug all the srcs.
     */
    var allDiggingIsDone = function allDiggingIsDone() {
        return( 
            (me.inflightThumbUris.length === 0) 
            && (me.dugUpUris.length > -1)
        );
    };


    /**
     * Wrapper for adding to _zoomSrcs, so we don't double-add.
     */
    var counter = 0;
    function pushNewFullSizeImgUri(newUri) {
        // Don't add nulls, don't double-add.
        if (u.exists(newUri) && me.dugUpUris.indexOf(newUri) === -1) {
            me.dugUpUris.push(newUri);
        }

        // Get the id of the uri, used to communicate with the UI,
        // And use it to update the UI.
        var id = me.uriIds[newUri];
        if (u.exists(id)) {
            Output.setEntryAsDug(id, newUri);
        }
        else {
            id = (counter++);
            me.uriIds[newUri] = id;

            Output.addNewEntry(id, newUri);
            Output.setEntryAsDug(id, newUri);
        }
        
        Output.toOut('Adding dug URLs to download list. Length: ' + me.dugUpUris.length);
    };


    /**
     * On the end of the xhr, onerror or on onloadend, complete the Xhr.
     */
    var completedXhrCount = 0;
    function completeXhr(thumbUri, zoomedImgUri) {
        thumbUri = thumbUri ? thumbUri : ''
        zoomedImgUri = zoomedImgUri ? zoomedImgUri : '';

        var loggedZoomUri = /^blob\:/.test(zoomedImgUri) ? '(A Blob)' : zoomedImgUri;

        console.log('[CompleteXhr] Zoomed image reported. thumbUri: "' + thumbUri 
            + '"\n      zoomedImgUri: "' + loggedZoomUri +'"');

        // If we can, now remove this thumbUri from the inflight array.
        if (thumbUri) {
            Output.toOut('Completed ' + (++completedXhrCount) + ' media fetches...')
            var fetchIndex = me.inflightThumbUris.indexOf(thumbUri);
            
            if (fetchIndex !== -1) {
                me.inflightThumbUris.splice(fetchIndex, 1);
            }
        }

        // If all the xhrs have succeeded, cancel the alarm, and call the
        // callback by ourselves.
        if (allDiggingIsDone()) {
            chrome.alarms.clear('DIG_SAVE');
            me.response(me.dugUpUris);
        }    
    }


    /**
     * Construct a baseUri suitable for passing to the URL() constructor.
     * It either builds it off the passed-in location obj, or it uses the Digger's
     * cached "locator".
     */
    function getBaseUri(l) {
        var loc = (u.exists(l) ? l : me.locator);
        var baseUri = loc.href.substring(0, loc.href.lastIndexOf('/')+1);

        return baseUri;
    }


    function srcToUrl(src, l) {
         if (!u.exists(src)) { 
            return ''; 
        };
        var loc = (u.exists(loc) ? loc : me.locator);
        var cleanSrc = '';

        if (src.indexOf("url(") === 0) {
            src.replace(/^url\(('|")?/, '').replace(/('|")?\)$/, '');
        }
        else {
            cleanSrc = src;
        }

        // Use the URL object to fix all our woes.
        return (
            new URL(cleanSrc, getBaseUri(loc))
        );
    }

    /**
     * Cleanse and scrub a src into a Uri string.
     */
    function srcToUri(src, l) {
        return srcToUrl(src, l).href;
    }
    

    /**
     * Check the allowed mime types for the type of dig we're
     * doing.
     */
    function isAllowedMediaMimeType(mtype) {
        if (u.exists(mtype)) {
            var allowedRxs = getAllowedMimeTypeRxs();

            for (var i=0; i < allowedRxs.length; i++) {
                if (allowedRxs[i].test(mtype)) {
                    return true;
                }
            }
        }
        
        return false;
    }




    /**
     * Finally grab resolved urls for what we think are main images, or
     * dig through a new page. 
     */
    me.digDeep = function digDeep(thumbUri, zoomPageUri) {
        if (!u.exists(zoomPageUri)) {
            // if no zoomPageUrl, but a src, at least splice it out of the inflightFetchSrcs.
            if (u.exists(thumbUri)) {
                var srcIndex = me.inflightThumbUris.indexOf(thumbUri);

                if (srcIndex != -1) {
                    me.inflightThumbUris.splice(srcIndex, 1);
                }
                return;
            }
            // if no src, we can't even splice. just bail.
            else {
                console.log("[DigDeep] Not passed value thumbUri or zoomPageUri.")
                return;     
            }
        }

        // Create a convenience URL object, parse out the filename.
        var thumbUrl = new URL(thumbUri);
        var thumbFilename = thumbUrl.pathname.substring(thumbUrl.pathname.lastIndexOf('/') + 1);
        
        // XHR to load the zoomPage with the (hopefully) big images.
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function onXhrReadyStateChange() {            
            // We can error out once headers received.
            if (this.readyState == XMLHttpRequest.HEADERS_RECEIVED && (this.status != 200)) {
                console.log('Error Status ' + this.status + ' fetching presumed zoom page:\n  ' + zoomPageUri);
                completeXhr(thumbUri, zoomPageUri);
                return;
            } 
            // Otherwise, we loaded at least! Check it all out.
            else if (this.readyState == XMLHttpRequest.DONE) 
            {
                var zoomedImgUri = false;

                // It might be a direct link to media. Check the mime type.
                if (isAllowedMediaMimeType(this.response.type)) {
                    console.log("Pushing blob url for direct media link: " + zoomPageUri);
                    
                    //zoomedImgUri = URL.createObjectURL(this.response);
                    zoomedImgUri = zoomPageUri;
                    pushNewFullSizeImgUri(zoomedImgUri);
                    completeXhr(thumbUri, zoomedImgUri);
                    return;
                }
                else {
                    scrapeZoomPage(thumbUri, zoomPageUri);
                }
            }
        };
        

        // On error, log the exception status with the Url, and call complete on the xhr.
        xhr.onerror = function onXhrError() {
            console.log('Exception Status ' + this.status + ' for: ' + zoomPageUri);
            completeXhr(thumbUri, zoomPageUri);
        };

        // xhr.open('GET', zoomPageUri, true); 
        // xhr.responseType = 'blob';
        xhr.open('HEAD', zoomPageUri, true);
        xhr.send();
    }




    function scrapeZoomPage(thumbUri, zoomPageUri) {
        // Do an xh-request to get a valid document to scrape. 
        var xh = new XMLHttpRequest();

        xh.onreadystatechange = function xhRsc() {
            if (this.readyState == XMLHttpRequest.DONE) 
            {
                var zoomedImgUri = false;

                // It might be a direct link to media. Check the mime type.
                if (this.status !== 200 || isAllowedMediaMimeType(this.response.type)) {                    
                    zoomedImgUri = zoomPageUri;
                    pushNewFullSizeImgUri(zoomedImgUri);
                    completeXhr(thumbUri, zoomedImgUri);
                    return;
                }
                else {            
                    if (u.exists(this.response) && /^text\//.test(this.response.type)) {                    
                        // First look in the special rules for a strategy that's already 
                        // been figured out by me. See if we can just get the Uri from there.
                        var blessedZoomUri = Logicker.findBlessedZoomUri(doc, thumbUri);
                        
                        // We can safely exit if we found the blessed uri.
                        if (u.exists(blessedZoomUri)) {
                            console.log('Found blessed uri: ' + blessedZoomUri);

                            zoomedImgUri = blessedZoomUri;
                            me.dugUpUris.push(blessedZoomUri);
                            pushNewFullSizeImgUri(zoomedImgUri);
                            completeXhr(thumbUri, zoomedImgUri);
                            return;
                        }
                        else {
                            // reset the options have it keep serching.
                            me.options = {
                                imgs: isAllowedImageFile(thumbUri),
                                cssBgs: isAllowedImageFile(thumbUri),
                                videos: isAllowedVideoFile(thumbUri),
                                js: false,
                                audios: isAllowedAudioFile,
                                qs: false,
                            }     
                        }

                        // Look at all the <img>s on the page for a possible zoom version of the thumb.
                        if (!zoomedImgUri && u.exists(me.options) && me.options.imgs === true) {
                            var imgUrls = getElementUrls({
                                doc: doc,
                                selector: 'img',
                                propName: 'src',
                                altPropName: 'currentSrc',
                            });

                            imgUrls.forEach(function putImgUriInZoomSrcs(iUrl) {
                                if (u.exists(iUrl) && iUrl.pathname) {
                                    var imgFilename = iUrl.pathname.substring(iUrl.pathname.lastIndexOf('/')+1);

                                    // If it could match a thumbnail, add it to the list, and complete the xhr.
                                    if (me.isPossiblyZoomedFile(thumbUrl, iUrl)) {
                                        zoomedImgUri = iUrl.href;
                                        pushNewFullSizeImgUri(zoomedImgUri);
                                        completeXhr(thumbUri, zoomedImageUri);
                                    }
                                }
                            });

                            if (zoomedImgUri) {
                                return;
                            }
                        }
                        
                        // Look at all the css background-images on the page for a possible zoom of the thumb.
                        if (!zoomedImgUri && u.exists(me.options) && me.options.cssBgs === true) {
                            var bgImgUrls = getElementUrls({
                                doc: doc,
                                selector: '*',
                                propName: 'style',
                                subPropName: 'backgroundImage',
                            });
                            
                            bgImgUrls.forEach(function putBgUriInZoomZrcs(bgImgUrl) {
                                if (u.exists(bgImgUrl) && bgImgUrl.pathname) {
                                    var bgImgFilename = bgImgUrl.pathname.substring(bgImgUrl.pathname.lastIndexOf('/')+1);
                                
                                    // If it could be a thumbnail match, add it to the list, complete the xhr.
                                    if (me.isPossiblyZoomedFile(thumbUrl, bgImgUrl)) {
                                        zoomedImgUri = bgImgUrl.href;
                                        pushNewFullSizeImgUri(zoomedImgUri);
                                        completeXhr(thumbUri, zoomedImgUri);
                                    }
                                }
                            });

                            if (zoomedImgUri) {
                                return;
                            }
                        }
                        
                        // Look at all the videos on the page for a possible zoom of the thumb.
                        if (!zoomedImgUri && u.exists(me.options) && me.options.videos === true) {
                            var videoUrls = getAllVideoUrls(doc);
                            
                            videoUrls.forEach(function putVideoUrlInZoomSrcs(vUrl) {
                                if (u.exists(vUrl) && vUrl.pathname) {
                                    var vFilename = vUrl.pathname.substring(vUrl.pathname.lastIndexOf('/'));

                                    // If it could be a thumbnail match, add it to the list, complete the xhr.
                                    if (vUri && me.isPossiblyZoomedFile(thumbUrl, vUrl)) {
                                        zoomedImgUri = vUrl.href;
                                        pushNewFullSizeImgUri(zoomedImgUri);
                                        completeXhr(thumbUri, zoomedImgUri);
                                    }
                                }
                            });

                            if (zoomedImgUri) {
                                return;
                            }
                        }

                        // Look in all the JavaScript for possible zoom of the thumb.
                        if (!zoomedImgUri && u.exists(me.options) && me.options.js === true) {
                            var jsUrls = scrapeAllJsUrls(doc);

                            jsUrls.forEach(function putJsUriInZoomSrcs(jsUrl) {
                                if (u.exists(jsUrl) && jsUrl.pathname) { 
                                    var jsFilename = jsUrl.pathname.substring(jsUrl.pathname.lastIndexOf('/'));
                                    
                                    // If it could be a thumbnail match, add it to the list, complete the xhr.
                                    if (me.isPossiblyZoomedFile(thumbUrl, jsUrl)) {
                                        zoomedImgUri = jsUrl.href;
                                        pushNewFullSizeImgUri(zoomedImgUri);
                                        completeXhr(thumbUri, zoomedImgUri);
                                    }
                                }
                            });

                            if (zoomedImgUri) {
                                return;
                            }
                        }

                        //TODO: Querystring.
                        if (!zoomedImgUri && u.exists(me.options) && me.options.qs === true) {
                            // Look for like: ?09.jpg or ?x=30&f=09.jpg&q=yuoiyu and stuff.
                        }
                    }

                    // Complete the main XHR. 
                    completeXhr(thumbUri, zoomedImgUri);
                    return;    
                }
            }
        };

        xh.onerror = function xhError(error) {
            console.log('[scrapeZoomPage] xh error: ' + JSON.stringify(error));
            completeXhr(thumbUri, '');
        };

        xh.open('GET', zoomPageUri, true);
        xh.responseType = 'document';
        xh.send();
    }





    /**
     * Create the alarm for calling me.response() for us if the XHRs hang or something.
     */
    chrome.alarms.create('DIG_SAVE', {
        periodInMinutes: 1.0    
    });


    /**
     * Alarm Listener for 'DIG_SAVE'. Periodically send the Uris for downloading. If the Xhrs 
     * all complete first, _lastXhrCount will be set back to -1 and this won't fire.
     */
    chrome.alarms.onAlarm.addListener(function(alarm){
        if (alarm.name === 'DIG_SAVE') {
            if (me.inflightThumbUris.length) {
                me.response(me.dugUpUris);
            }            
        }
    });


    // Return the Digger.
    return me;
});