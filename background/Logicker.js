'use strict'

/**
 * Logicker service/singleton for stateless rules about how to 
 * find things on pages in general, and for specific sites.
 */
var Logicker = (function Logicker(Utils) {
    // service object
    var me = {};

    // aliases
    var u = Utils;


    /**
     * Find the right uri for the zoomed media item pointed to by the gallery thumb.
     * (this applies the scraped rules I view-sourced to see.)
     */
    me.findBlessedZoomUri = function findBlessedZoomUri(doc, thumbUri) {
        var zoomImgUri = '';

        // Put special rules for particular sites here.
        if (false) {
            
        }
        else {
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
            isPossibly = false;
            return isPossibly;    
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
     * put any image srcs or patterns here that you know you don't want.
     * Like logos and whatnot. Currently blocks all png files. 
     */
    me.isKnownBadImg = function isKnownBadImg(src) {
        var isBad = false;

        if ((/\.png$/i).test(src)) {
            isBad = true;
        }

        return isBad;
    };


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

                        if (!me.isKnownBadImg(this.src)) {
                            var dims = {
                                height: (!!this.height ? this.height : this.naturalHeight),
                                width: (!!this.width ? this.width : this.naturalWidth)
                            };

                            if (dims.height > largestDims.height && dims.width > largestDims.width) {
                                largestImg = this;
                                largestImgSrc = this.src;
                                largestDims = dims;
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
            selector: 'a[href]',
            linkHrefProp: 'href',
            thumbSrcProp: 'firstElementChild.src',
            useRawValues: false,
        };

        // Force popup-side dom processing.
        if (!url || !url.match) {
            d = {};
            return d;
        }

        // Add all the special rules for particular sites here.
        if (/facebook\.com\//.test(url)) {
            d.selector = '.uiMediaThumbImg';
            d.linkHrefProp = 'style.backgroundImage';
            d.thumbSrcProp = 'firstElementChild.src';
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
            processedMap: {},
        };
        var thumbUris = Object.getOwnPropertyNames(galleryMap);
        
        // Put your special processing rules for particular sites here.
        if (/facebook\.com\//.test(pageUri)) {
            thumbUris.forEach(function extractUriFromCss(href) {
                instructions.processedMap[href] = href.replace(/^url\(('|")?/, '').replace(/('|")?\)$/, '');
            });

            instructions.doScrape = false;
            instructions.doDig = true;
        }
        else {
            instructions.processedMap = Object.assign({}, galleryMap);
            instructions.doScrape = true;
            instructions.doDig = true;            
        }

        return instructions;
    };


    // return the singleton
    return me;
})(Utils);