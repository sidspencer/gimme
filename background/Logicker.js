'use strict'

/**
 * Logicker service/singleton for stateless rules about how to 
 * find things on pages in general, and for specific sites.
 */
var Logicker = (function Logicker(Utils) {
    // service object
    var me = {
        hasSpecialRules: false,
        
        MIN_ZOOM_HEIGHT: 250,
        MIN_ZOOM_WIDTH: 250,

        messages: [],
        processings: [],
        blessings: [],
    };

    // aliases
    var u = Utils;   

    /**
     * Find the right uri for the zoomed media item pointed to by the gallery thumb.
     * (this applies the scraped rules I view-sourced to see.)
     */
    me.findBlessedZoomUri = function findBlessedZoomUri(doc, thumbUri) {
        var zoomImgUri = '';

        // Look through the blessings for one that matches this thumbUri.
        if (me.blessings.length !== -1) {
            me.blessings.forEach(function applyBlessing(blessing) {
                //console.log('[Logicker] applying blessing: ' + JSON.stringify(blessing));

                // If the thumbUri matches the pattern and we can find the blessed element,
                // use the blessing src prop on the element to get the right zoom uri.
                var matcher = new RegExp(blessing.match);
                if (matcher.test(doc.documentURI)) {
                    //console.log('[Logicker] blessing matched thumbUri: ' + thumbUri);
                    var zoomImg = doc.querySelector(blessing.zoom);

                    if (!!zoomImg) {
                        //console.log('[Logicker] found blessed zoomImg: ' + zoomImg[blessing.src]);

                        if (blessing.src.indexOf('style') === 0) {
                            var parts = blessing.src.split('.');
                            zoomImgUri = me.extractUrl(zoomImg[parts[0]][parts[1]]);
                        }
                        else {
                            zoomImgUri = zoomImg[blessing.src];
                        }
                    }
                }
            });
        }

        // Look for the trivial case.
        if (zoomImgUri.length === 0) {
            var holderDiv = doc.querySelector('div.photo > div');
            if (!!holderDiv && !!holderDiv.style.backgroundImage) {
                var bg = holderDiv.style.backgroundImage;
                zoomImgUri = bg.replace('url(', '').replace(/"/g, '').replace(/'/g, '').replace(')', '');
            }
        }

        // Returns empty string when there's no special rules.
        return zoomImgUri;
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
            return false;    
        }

        if (me.isKnownBadImg(zoomUrl)) {
            return false;
        }

        // Pick out the basic filenames of the src and dest. No file extensions.
        var sname = thumbUrl.pathname.replace(/\/$/, '')
            .substring(thumbUrl.pathname.lastIndexOf('/') + 1)
            .substring(0, thumbUrl.pathname.lastIndexOf('.'));
        var zname = zoomUrl.pathname.replace(/\/$/, '')
            .substring(zoomUrl.pathname.lastIndexOf('/') + 1)
            .substring(0, zoomUrl.pathname.lastIndexOf('.'));
        
        var sval = '';
        var zval = '';

        // bail if the zoomUri.href is for a thumbnail.
        // if (/(thumb|tn_|small|-t\.|_t\.)/i.test(zoomUrl.href)) {
        //     isPossibly = false;
        //     return isPossibly;
        // }

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
            root = root.replace(/(thumb|\/tn|small|thumbnail|\-t|full|large)/i, '');

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
     * put any image srcs or patterns here that you know you don't want.
     * Like logos and whatnot. Currently blocks all png files. 
     */
    me.isKnownBadImg = function isKnownBadImg(src) {
        var isBad = false;

        if ((/(\/logo\.|\/loading\/header\.jpg|premium_|preview\.png)|preview\.jpg/i).test(src))
        {
            isBad = true;
        }

        return isBad;
    };


    /**
     * Is this image large enough to be a zoom image? 
     * Any object with the "width" and "height" properties can be used.
     */
    me.isZoomSized = function isZoomSized(obj) {
        return (obj.height > me.MIN_ZOOM_HEIGHT || obj.width > me.MIN_ZOOM_WIDTH);
    }


    /**
     * Find the largest image in a document. It can't be by dimensions, because the documents returned
     * by the XHRs are not "live", and no elements have dimensions because there was no rendering. SO,
     * we create Image objects and get the dimensions from those. 
     */
    me.getPairWithLargestImage = function getPairWithLargestImage(thumbUri, doc) {
        return new Promise(function findLargestImage(resolve, reject) {
            var largestImg = false;
            var largestImgSrc = false;
            var largestDims = {
                height: 0,
                width: 0,
            };

            if (doc && doc.querySelectorAll) {                
                // Get all the imageNodes from the doc we are to search.
                //
                // NOTE: Since it is not a *rendered* document, just one returned from the XHR, there are no client rects.
                //       So we have to create image objects.
                var imgNodes = doc.querySelectorAll('img');
                var imgsToCheck = imgNodes.length;

                if (imgsToCheck < 1) {
                    return reject('[Logicker] No images to check.');
                }

                for (var i = 0; i < imgNodes.length; i++) {
                    var imgNode = imgNodes[i];

                    // Construct a temporary image object so we can get the natural dimensions. 
                    var imageObj = new Image();

                    imageObj.onload = function compareDimensions(evt) {
                        imgsToCheck--;

                        // Skip the image if the filename is known to not ever be a real zoom-image.
                        if (!me.isKnownBadImg(this.src)) {
                            var dims = {
                                height: (!!this.height ? this.height : this.naturalHeight),
                                width: (!!this.width ? this.width : this.naturalWidth)
                            };

                            // Skip the image if it is not big enough.
                            if (me.isZoomSized(dims)) {
                                if (dims.height > largestDims.height && dims.width > largestDims.width) {
                                    largestImg = this;
                                    largestImgSrc = this.src;
                                    largestDims = dims;
                                }
                            }
                        }

                        // If we've reached the last image, call the callback.
                        if (imgsToCheck === 0) {
                            if (!!largestImgSrc) {
                                resolve({
                                    thumbUri: thumbUri,
                                    zoomUri: (new URL(largestImgSrc)).href,
                                });                            
                            }
                            else {
                                reject('[Logicker] Could not find largest image');
                            }
                        }
                    };

                    imageObj.onerror = function handleImageLoadError(evt) {                        
                        console.log('[Logicker] Error creating image object to get dimensions. evt: ' + JSON.stringify(evt));
                        imgsToCheck--;
                        
                        // If we've reached the last image, call the callback.
                        if (imgsToCheck === 0) {
                            if (!!largestImgSrc) {
                                resolve({
                                    thumbUri: thumbUri,
                                    zoomUri: (new URL(largestImgSrc)).href,
                                });
                            }
                            else {
                                reject('[Logicker] Could not find URL of largest image.');
                            }
                        }
                    };

                    imageObj.src = !!imgNode.src ? imgNode.src : imgNode.currentSrc;
                }
            }
            else {
                console.log('[Logicker] Invalid doc object passed to findUrlOfLargestImage().');
                console.log(JSON.stringify(doc));
                reject('[Logicker] Invalid doc object passed to findUrlOfLargestImage().');
                return;
            }
        });
    };


    /**
     * This is where the knowledge-magic comes in. By inspecting a number of sites' galleries,
     * I have found easy selector/prop pairs to get the URIs by. 
     */
    me.getMessageDescriptorForUrl = function getMessageDescriptorForUrl(url) {
        var d = {
            command: 'peepAround',
            linkSelector: 'a[href]',
            linkHrefProp: 'href',
            thumbSubselector: ':scope img',
            thumbSrcProp: 'src',
            useRawValues: false,
        };

        // Force popup-side dom processing.
        if (!url || !url.match) {
            d = {};
            return d;
        }

        // Check all of the special messaging rules for guidance in what to use for the
        // thumb element and uri, and the zoom page anchor element and uri.
        for (var i = 0; i < me.messages.length; i++) {
            var m = me.messages[i];
            
            console.log('[Logicker] working on message: ' + JSON.stringify(m));

            if (url.match(m.match)) {
                console.log('[Logicker] uri matched: ' + url);

                d.linkSelector = m.link;
                d.linkHrefProp = m.href;

                // Note, :scope the subselector.
                d.thumbSubselector = (m.thumb.indexOf(':scope') === -1 ? ':scope ' + m.thumb : m.thumb);
                d.thumbSrcProp = m.src;
            }
        }

        return d;
    };


    /**
     * For any processing that should be done before calling the Digger.
     * Often, you can munge your thumbSrc and linkHref values into place 
     * enough that you can just call the downloader in App directly. 
     */
    me.postProcessResponseData = function postProcessResponseData(galleryMap, pageUri) {
        var instructions = {
            doScrape: true,
            doDig: true,
            processedMap: null,
        };
        var thumbUris = Object.getOwnPropertyNames(galleryMap);
        var newGalleryMap = null;

        // Utilize processings hints from the Options page.
        for (var i=0; i < me.processings.length; i++) {
            var p = me.processings[i];

            //console.log('[Logicker] working on processing: ' + JSON.stringify(p));

            // if the page uri matches, apply the processings to the galleryMap.
            var matcher = new RegExp(p.match);
            if (pageUri.match(matcher)) {
                //console.log('[Logicker] pageUri matched: ' + pageUri);

                newGalleryMap = {};
                thumbUris.forEach(function applyProcessings(thumbUri) {
                    var thumbUri2 = thumbUri + '';

                    p.actions.forEach(function applyActions(act) {
                        //console.log('[Logicker] applying action: ' + JSON.stringify(act));

                        // We only support "replace" for now.
                        if (act.verb !== 'replace') {
                            return;
                        }

                        var matchey = new RegExp(act.match);
                        //console.log('[Logicker] testing thumbUri with matcher...');

                        // Use the thumbUri if 'src', otherwise the 'href', zoomPageUri
                        if (act.noun === 'src' && thumbUri.match(matchey)) {
                            //console.log('[Logicker] thumbUri matched. Replacing.');

                            thumbUri2 = thumbUri.replace(matchey, act.new);
                            newGalleryMap[thumbUri] = thumbUri2; 
                        }
                        else if (act.noun === 'href' && galleryMap[thumbUri].match(matchey)) {
                            //console.log('[Logicker] zoomPageUri matched. Replacing.');

                            newGalleryMap[thumbUri] = galleryMap[thumbUri].replace(matchey, act.new);
                        }
                    });

                    // Put all other valid pairs into newGalleryMap, even the not actionated ones.
                    if (!newGalleryMap[thumbUri] && !!galleryMap[thumbUri]) {
                        newGalleryMap[thumbUri] = galleryMap[thumbUri] + '';
                    }

                    //console.log('[Logicker] new thumbUri, zoomUri: \n ' + thumbUri2 + '\n ' + newGalleryMap[thumbUri2]);
                });

                // The scrape and dig flags come through as strings...
                instructions.doScrape = (p.scrape !== 'false');
                instructions.doDig = (p.dig !== 'false');
            }
        }

        // Set the new gallery map if we built one, otherwise copy galleryMap.
        if (!!newGalleryMap) {
            instructions.processedMap = newGalleryMap;
        }
        else {
            instructions.processedMap = Object.assign({}, galleryMap);            
        }

        return instructions;
    };


    /**
     * See whether firstUri or secondUri better matches src, by doing a canonical filename match.
     * favor firstUri.
     */
    me.chooseBetterMatchingUri = function chooseBetterMatchingUri(src, firstUri, secondUri) {
        if (!src || !(firstUri || secondUri)) { return ''; }
        else if (!secondUri) { return firstUri; }
        else if (!firstUri) { return secondUri; }

        // strip of the querystring if there is one.
        var bareSrc = src;        
        var srcQsIndex = bareSrc.indexOf('?');
        if (srcQsIndex !== -1) { bareSrc = bareSrc.substring(0, srcQsIndex); };

        // if there's no extension '.', and we're not of protocol 'data:' or 'blob:', 
        // it's probably not a good <img>.
        var extIndex = bareSrc.lastIndexOf('.');
        if (extIndex === -1) { return; };

        // Get just the name without the extension.
        var imgCanonicalName = bareSrc.substring(bareSrc.lastIndexOf('/')+1, extIndex);
        
        // check if the firstUri has the canonical name in one of its path parts.
        var firstHasIt = false;
        var firstUriArray = firstUri.split('/');
        firstUriArray.forEach(function lookForCanonicalNameInUri(pathPart) {
            if (!firstHasIt && pathPart.indexOf(imgCanonicalName) !== -1) {
                firstHasIt = true;
            }
        });                    

        // check if the secondUri has the canonical name in one of its path parts.
        var secondHasIt = false;
        var secondUriArray = secondUri.split('/');
        secondUriArray.forEach(function lookForCanonicalNameInUri(pathPart) {
            if (!secondHasIt && pathPart.indexOf(imgCanonicalName) !== -1) {
                secondHasIt = true;
            }
        });
        
        // Give the first uri priority. 
        var zoomPageUri = ''; 
        if (secondHasIt && !firstHasIt) {
            zoomPageUri = secondUri;
        }
        else {
            zoomPageUri = firstUri;
        } 

        return zoomPageUri;
    };


    /**
     * Get a property value given a tag, and a dot-notation property path as a string.
     * It handles extracting from javascript functions, and from css properties.
     */
    var URL_EXTRACTING_REGEX = /(url\()?('|")?(https?|data|blob|file)\:.+?\)?('|")?\)?/i;
    var googleHackCounter = 0;    
    me.extractUrl = function extractUrl(tag, propPath, loc) {
        if (!tag || !propPath) {
            return '';
        }

        // horrible hack for google images.
        if (tag.baseURI.indexOf('google.com') !== -1) {
            return tag.parentNode.href;
        }

        // Iterate through the path of properties to get the value.
        var pathParts = propPath.split('.');
        var iterator = tag;
        for(var i = 0; (!!iterator && iterator !== null && typeof iterator !== 'undefined') && i < pathParts.length; i++) {
            if (!!iterator && iterator !== null) {
                iterator = iterator[pathParts[i]];
            }
        }
        var value = iterator;
        if (!value) { return ''; };

        // Special processing for srcset props.
        if (pathParts[pathParts.length-1] === 'srcset') {
            value = value.split(',')[0].split(' ')[0];
        }

        // Do a url extraction from functions or javascript hrefs.
        if (typeof value === 'function' || /^(java)?script\:/.test(value)) {
            var text = value.toString();
            value = URL_EXTRACTING_REGEX.exec(text);

            if (!!value && value.length) {
                value = value[0];
            }
        }
        if (!value) { return ''; };

        // Remove the 'url("...")' wrapping from css background images.
        if (value.indexOf('url(') !== -1) {
            value = value.replace('url(', '').replace(')', '');
            value = value.replace("'", '');
            value = value.replace('"', '');
        }

        return (new URL(value, loc.origin));
    };


    // return the singleton
    return me;
})(Utils);
