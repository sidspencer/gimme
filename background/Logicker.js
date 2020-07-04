import * as tf from '../node_modules/@tensorflow/tfjs/dist/tf.esm';
import * as mobilenet from '../node_modules/@tensorflow-models/mobilenet/dist/mobilenet.esm';
import { default as Utils } from './Utils.js';
import { default as GCon } from '../lib/GCon.js';
import {
    ContentMessage,
    ProcessingInstructions,
    UriPair,
    ScoredUriPair,
    Dimensions
} from '../lib/DataClasses.js';


/**
 * Logicker static class for stateless rules about how to 
 * find things on pages in general, and for specific sites.
 */
class Logicker {
    // service object
    static hasSpecialRules = false;
    static knownBadImgRegex = /^SUPER_FAKE_NOT_FOUND_IN_NATURE_ONLY_ZOOL$/;
    static messages = [];
    static processings = [];
    static blessings = [];
    static mnModel = undefined;
    static loadingModel = false;
    static modelLoadPromiseChain = Promise.resolve(true);

    // Configurable options.
    static MinZoomHeight = GCon.LOGICK_CONF.MIN_ZOOM_HEIGHT;
    static MinZoomWidth = GCon.LOGICK_CONF.MIN_ZOOM_WIDTH;

    /**
     * Methods for setting the preferences options on the Logicker.
     */
    static setMessages(messages) {
        Logicker.messages = JSON.parse(JSON.stringify(messages));
    }
    static setProcessings(processings) {
        Logicker.processings = JSON.parse(JSON.stringify(processings));
    }
    static setBlessings(blessings) {
        Logicker.blessings = JSON.parse(JSON.stringify(blessings));
    }
    static setMinZoomHeight(height) {
        var zoomHeight = parseInt(height + '', 10);

        if (!isNaN(zoomHeight)) {
            Logicker.MinZoomHeight = zoomHeight;
        }
    }
    static setMinZoomWidth(width) {
        var zoomWidth = parseInt(width + '', 10);

        if (!isNaN(zoomWidth)) {
            Logicker.MinZoomWidth = zoomWidth;
        }
    }
    static setKnownBadImgRegex(regexString) {
        if (!!regexString) {
            Logicker.knownBadImgRegex =  new RegExp(regexString);
        }
    }


    /**
     * Load the mobilenet image-matching model, and do it only once per instance.
     * Returns a promise resolving to our copy of this model.
     */
    static loadModel() {
        return new Promise((resolve, reject) => {
            if (!!Logicker.mnModel) {
                // If it's already loaded, resolve with it.
                console.log('[Logicker] returning cached copy of model.');
                resolve(Logicker.mnModel);
            }
            else if (Logicker.loadingModel === true) {
                console.log('[Logicker] Model is loading. We will wait a the end of the promise chain.');
                
                // If it's still loading, we chain onto the promise. This way we do not double-load,
                // and we continue execution once it's been loaded by the first caller.
                Logicker.modelLoadPromiseChain.then(() => {
                    if (!!Logicker.mnModel) {
                        resolve(Logicker.mnModel);
                    }
                    else {
                        reject('Mobilenet model came back null.')
                    }                   
                });
            }
            else {
                Logicker.loadingModel = true;
                console.log('[Logicker] Loading model...');
                const startTime = performance.now();

                Logicker.modelLoadPromiseChain = Logicker.modelLoadPromiseChain.then(() => { 
                    return mobilenet.load().then((mnModel) => {
                        Logicker.mnModel = mnModel;
                        Logicker.loadingModel = false;

                        if (!!Logicker.mnModel) {
                            resolve(Logicker.mnModel);
                        }
                        else {
                            reject('Mobilenet model came back null.')
                        }   

                        const totalTime = Math.floor(performance.now() - startTime);
                        console.log(`[Logicker] Model loaded and initialized in ${totalTime}ms...`);
                    });
                });
            }             
        });
    };


    /**
     * Using the TF Mobilenet model, get a classification vector for the image.
     */
    static classifyImage(imgElement) {
        let p = new Promise((resolve, reject) => {
            var originalHeight = imgElement.height;
            var originalWidth = imgElement.width;
    
            imgElement.height = GCon.LOGICK_CONF.IMAGE_SIZE;
            imgElement.width = GCon.LOGICK_CONF.IMAGE_SIZE;

            Logicker.mnModel.classify(imgElement, GCon.LOGICK_CONF.CLASSIFICATIONS).then((imgClassifications) => {
                imgElement.height = originalHeight;
                imgElement.width = originalWidth;

                if (Array.isArray(imgClassifications)) {
                    //console.log('[Logicker] mnModel.classify found these: ' + JSON.stringify(imgClassifications));
                    resolve(imgClassifications);  
                }
                else {
                    reject('[Logicker] Classifications came back null');
                }
            });
        });

        return p;
    }

    
    /**
     * Load an image via the Image() object, sized so tf can analyse it.
     */
    static loadImage(src) {
        return new Promise((resolve, reject) => {
            var img = new Image();
            img.src = src;
            img.crossOrigin = "anonymous";

            img.onerror = (e) => {
                resolve(null);
            };

            // Set image size for tf!
            img.onload = (evt) => {
                resolve(img);
            }

            img.src = src;
        });
    }


    /**
     * Find the right uri for the zoomed media item pointed to by the gallery thumb.
     * (this applies the scraped rules I view-sourced to see.)
     */
    static findBlessedZoomUri(doc, thumbUri) {
        var zoomImgUri = '';

        // Look through the blessings for one that matches this thumbUri.
        if (Logicker.blessings.length !== -1) {
            Logicker.blessings.forEach((blessing) => {
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
                            zoomImgUri = Logicker.extractUrl(zoomImg[parts[0]][parts[1]]);
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
    static isPossiblyZoomedFile(thumbUrl, zoomUrl) {
        var isPossibly = false;

        // confirm type and value existence, then trim whitespace. Otherwise, blank string, which
        // will make isPossibly be returned as false.
        if (!(thumbUrl && zoomUrl && (thumbUrl.href.length > 0) && (zoomUrl.href.length > 0))) {
            return false;    
        }

        if (Logicker.isKnownBadImg(zoomUrl)) {
            return false;
        }

        // Pick out the basic filenames of the src and dest. No file extensions.
        var sname = thumbUrl.path.replace(/\/$/, '')
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
        if ((snaLogicker.indexOf(zname) != -1) || (znaLogicker.indexOf(sname) != -1)) {
            isPossibly = true;
            return isPossibly;
        }

        // Strip off file extension, punctuation, and common thumb/zoomed deliniation strings.
        var getRootForName = ((name) => {
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

        if ((znaLogicker.indexOf(sroot) != -1) || (snaLogicker.indexOf(zroot) != -1)) {
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
        sparts.forEach((spart) => {
            if (zoomUrl.href.indexOf(spart) != -1) {
                maybes.push(1);
            }
            else {
                maybes.push(0);
            }
        });

        // count the trues, count the falses. 
        // Cut it off at 70% match.
        var sum = maybes.reduce((count, val) => {
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
    static isKnownBadImg(src) {
        var isBad = false;

        if (!!Logicker.knownBadImgRegex) {
            if (Logicker.knownBadImgRegex.test(src)) {
                isBad = true;
            }
        }

        return isBad;
    };


    /**
     * Is this image large enough to be a zoom image? 
     * Any object with the "width" and "height" properties can be used.
     */
    static isZoomSized(obj) {
        return !(obj.height < Logicker.MinZoomHeight && obj.width < Logicker.MinZoomWidth);
    }


    /**
     * Try to find the best matching image in the doc by using tensorFlow image classification using
     * Mobilenet, and just comparing classification vectors.
     */
    static tfClassificationMatch(thumbUri, doc) {
        // Make sure the model is loaded.
        let p = Logicker.loadModel().then((mobilenetModel) => {
            return new Promise((resolve, reject) => {
                Logicker.loadImage(thumbUri).then((thumbImg) => {
                    if (!!thumbImg) {
                        resolve(Logicker.classifyImage(thumbImg));
                    }
                    else {
                        console.log(`[Logicker] ThumbUri will not load, rejecting: ${thumbUri}`);
                        reject('ThumbUri will not load: ' + thumbUri);
                    }
                });
            });
        })
        // Process all the images in the doc for scores.
        .then((thumbClassifications) => {
            return new Promise((topLevelResolve, topLevelReject) => {
                var imgs = doc.querySelectorAll('img');
                var imgPromises = [];
                var largestImgSrc = undefined;
                var largestDims = new Dimensions(Logicker.MinZoomHeight, Logicker.MinZoomWidth);

                // Check every image for similarities.
                //console.log(`[Logicker] Checking ${imgs.length} images for TF similarity to the test image.`);
                imgs.forEach((img) => {                
                    var imgSrc = img.src;
                    var originalDims = new Dimensions(
                        (!!this.naturalHeight ? this.naturalHeight : this.height),
                        (!!this.naturalWidth ? this.naturalWidth : this.width)
                    );
                    var zeroResponse = new ScoredUriPair(thumbUri, (new URL(imgSrc)).href, 0);

                    // Load all the images in the document, wrapping their onload/onerror in promises. Score them.
                    imgPromises.push(
                        new Promise((resolve, reject) => {
                            let testImg = new Image(
                                GCon.LOGICK_CONF.IMAGE_SIZE, 
                                GCon.LOGICK_CONF.IMAGE_SIZE
                            );

                            // Must use the "function" keyword so "this" points to the image.
                            testImg.onload = function onload() {
                                //console.log('[Logicker] Loaded document image for TF scoring: ' + imgSrc);
                                if (Logicker.isKnownBadImg(this.src)) {
                                    console.log('[Logicker] Known bad image naLogicker. Skipping...');
                                    resolve(zeroResponse);
                                    return;
                                } 
                                else {
                                    // Skip the image if it is not big enough.
                                    if (!Logicker.isZoomSized(originalDims)) {
                                        console.log('[Logicker] Image too small. Skipping...');
                                        resolve(zeroResponse);
                                        return;
                                    } 
                                    else {
                                        if (originalDims.height > largestDims.height && originalDims.width > largestDims.width) {
                                            largestImgSrc = this.src;
                                            largestDims = originalDims;
                                        }
                                    }
                                }

                                // Do the scoring.
                                Logicker.classifyImage(this).then((classifications) => {
                                    if (!Array.isArray(classifications)) {
                                        console.log(`[Logicker] got no classifications for img ${imgSrc}`);
                                        resolve(zeroResponse);
                                        return;
                                    }
                                    else {
                                        //console.log(`[Logicker] got classifications for img ${imgSrc}: ${JSON.stringify(classifications)}`);
                                        console.log(`[Logicker] got classifications for img ${imgSrc}`);
                                    }
                                    
                                    var classAgreements = [];
                                    var totalClassesCount = classifications.length;
                    
                                    // For each of the class-match classifications, see how they compare to the thumbnail's classifications.
                                    // As the classifications are just arrays of objects of the form {className: '', propability: 0}, we must
                                    // iterate in a nested loop. :(
                                    classifications.forEach((cls) => {
                                        thumbClassifications.forEach((tCls) => {
                                            if (tCls.className.indexOf(cls.className) != -1) {
                                                if (Math.abs(cls.probability - tCls.probability) < GCon.LOGICK_CONF.SCORE_CUTOFF) {
                                                    classAgreements.push(cls.className);
                                                } 
                                            }
                                        });
                                    });

                                    // Create a simple percentage score of the class matches. Resolve with the same object structure
                                    // that getPairWithLargestImage() does.
                                    var score = classAgreements.length / totalClassesCount;
                                    console.log(`[Logicker] candidate ${imgSrc} has a match score to ${thumbUri} of: ${score}`);

                                    resolve(new ScoredUriPair(thumbUri, (new URL(imgSrc)).href, score));
                                });
                            };

                            // On error, still resolve. (Waiting on support for Promise.allSettled()).
                            // Must use the "function" keyword so "this" points to the image.
                            testImg.onerror = function onerror(evt) {
                                console.log(
                                    '[Logicker] Error loading image for TF classifying. Resolving with score of 0.' +
                                    '           Event for onerror was: ' + JSON.stringify(evt)
                                );
                                resolve(zeroResponse);
                            };

                            testImg.src = imgSrc;
                        })
                    )
                });

                // Go through the img scores and pick the best one.
                Promise.all(imgPromises).then((imgScores) => {
                    var topImgScoreObj = new ScoredUriPair(thumbUri, '', 0);
                    
                    imgScores.forEach((s) => {
                        if (s.score > topImgScoreObj.score) {
                            topImgScoreObj = s;
                        }
                        else if (s.score === topImgScoreObj.score) {
                            if (s.zoomUri.indexOf(largestImgSrc) !== -1) {
                                topImgScoreObj = s;
                            }
                            // else, keep the current top scoring image.
                        }
                    });

                    console.log(`[Logicker] TF Mobilenet's most likely match ->\n -Score: ${topImgScoreObj.score}, Uri: ${topImgScoreObj.zoomUri}`);
                    topLevelResolve(topImgScoreObj);
                });
            });
        });

        // p resolves with the top image score object for the thumbnail.
        return p;
    }


    /**
     * Find the largest image in a document. It can't be by dimensions, because the documents returned
     * by the XHRs are not "live", and no elements have dimensions because there was no rendering. SO,
     * we create Image objects and get the dimensions from those. 
     */
    static getPairWithLargestImage(thumbUri, doc) {
        let p = new Promise((resolve, reject) => {
            var largestImgSrc = false;
            var largestDims = new Dimensions(0, 0);
 
            if (!!doc && !!doc.querySelectorAll) {                
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

                    // Must use the "function" keyword so "this" points to the image.
                    imageObj.onload = function compareDimensions(evt) {
                        imgsToCheck--;

                        // Skip the image if the filename is known to not ever be a real zoom-image.
                        if (!Logicker.isKnownBadImg(this.src)) {
                            var dims = new Dimensions(
                                (!!this.height ? this.height : this.naturalHeight),
                                (!!this.width ? this.width : this.naturalWidth)
                            );

                            // Skip the image if it is not big enough.
                            if (Logicker.isZoomSized(dims)) {
                                if (dims.height > largestDims.height && dims.width > largestDims.width) {
                                    largestImgSrc = this.src;
                                    largestDims = dims;
                                }
                            }
                        }

                        // If we've reached the last image, call the callback.
                        if (imgsToCheck === 0) {
                            if (!!largestImgSrc) {
                                resolve(new UriPair(thumbUri, (new URL(largestImgSrc)).href));
                            }
                            else {
                                reject('[Logicker] Could not find largest image');
                            }
                        }
                    };
                    
                    // Must use the "function" keyword so "this" points to the image.
                    imageObj.onerror = function handleImageLoadError(evt) {                        
                        console.log('[Logicker] Error creating image object to get dimensions. evt: ' + JSON.stringify(evt));
                        imgsToCheck--;
                        
                        // If we've reached the last image, call the callback.
                        if (imgsToCheck === 0) {
                            if (!!largestImgSrc) {
                                resolve(new UriPair(thumbUri, (new URL(largestImgSrc)).href));
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
        
        return p;
    };


    /**
     * This is where the knowledge-magic comes in. By inspecting a number of sites' galleries,
     * I have found easy selector/prop pairs to get the URIs by. 
     */
    static getMessageDescriptorForUrl(url) {
        var d = new ContentMessage();

        // Force popup-side dom processing.
        if (!url || !url.match) {
            d = {};
            return d;
        }

        // Check all of the special messaging rules for guidance in what to use for the
        // thumb element and uri, and the zoom page anchor element and uri.
        for (var i = 0; i < Logicker.messages.length; i++) {
            var m = Logicker.messages[i];
            
            console.log('[Logicker] working on message: ' + JSON.stringify(m));

            if (url.match(m.match)) {
                console.log('[Logicker] uri matched: ' + url);

                d.linkSelector = m.link;
                d.linkHrefProp = m.href;

                // Note, :scope the subselector.
                d.thumbSubselector = (
                    m.thumb.indexOf(GCon.SEL_PROP.SCOPE) === -1 ? 
                    `${GCon.SEL_PROP.SCOPE} ${m.thumb}` : 
                    m.thumb
                );
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
    static postProcessResponseData(galleryMap, pageUri) {
        var instructions = new ProcessingInstructions(true, true, null);
        var thumbUris = Object.getOwnPropertyNames(galleryMap);
        var newGalleryMap = null;

        // Utilize processings hints from the Options page.
        for (var i=0; i < Logicker.processings.length; i++) {
            var p = Logicker.processings[i];

            //console.log('[Logicker] working on processing: ' + JSON.stringify(p));

            // if the page uri matches, apply the processings to the galleryMap.
            var matcher = new RegExp(p.match);
            if (pageUri.match(matcher)) {
                //console.log('[Logicker] pageUri matched: ' + pageUri);

                newGalleryMap = {};
                thumbUris.forEach((thumbUri) => {
                    var thumbUri2 = thumbUri + '';

                    p.actions.forEach((act) => {
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

                            if (thumbUri2.indexOf('/previews/') !== -1) {
                                thumbUri2 = thumbUri2.replace('previews/', '');
                            }
                            if (thumbUri2.indexOf('?') !== -1) {
                                thumbUri2 = thumbUri.substring(0, thumbUri.indexOf('?'));
                            }
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
    static chooseBetterMatchingUri(src, firstUri, secondUri) {
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
        firstUriArray.forEach((pathPart) => {
            if (!firstHasIt && pathPart.indexOf(imgCanonicalName) !== -1) {
                firstHasIt = true;
            }
        });                    

        // check if the secondUri has the canonical name in one of its path parts.
        var secondHasIt = false;
        var secondUriArray = secondUri.split('/');
        secondUriArray.forEach((pathPart) => {
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
    static googleHackCounter = 0;    
    static extractUrl(tag, propPath, loc) {
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
        var lastIterator = undefined;
        for(var i = 0; (!!iterator && i < pathParts.length); i++) {
            if (!!iterator && iterator !== null) {
                lastIterator = iterator;
                iterator = iterator[pathParts[i]];
            }
        }

        var value = iterator;
        if (!value) { 
            return ''; 
        };

        // Special processing for srcset props.
        var lastPart = pathParts[pathParts.length-1];
        if (lastPart === 'srcset') {
            value = value.split(',')[0].split(' ')[0];
        }
        
        // Count the '..'s in relative uris. This is needed for the cases where we have to change from a 
        // 'chrome-extension://' reported uri. 
        var dotdotCount = 0;
        if (lastIterator && lastIterator.getAttribute && lastIterator.getAttribute(lastPart)) {
            dotdotCount = (lastIterator.getAttribute(lastPart).match(/\.\./g) || []).length;
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

        // Because we do an XHR with the "document" response type to get the thumbs and links, the inferred src/href
        // may be set relative to the extension (as the origin of the fetched document is in the extension's space).
        // We need to transform these weird src/href values back into having the correct base uri -- the one of the page.
        if (value.indexOf('chrome-extension://') === 0) {
            if (value.match('chrome-extension://' + chrome.runtime.id + '/background/')) {
                value = value.replace(
                    'chrome-extension://' + chrome.runtime.id + '/background/', 
                    loc.origin + loc.pathname.substring(0, loc.pathname.lastIndexOf('/')+1)
                ); 
            }
            else if (value.match('chrome-extension://' + chrome.runtime.id + '/') && dotdotCount > 0) {
                var trimmedPath = loc.pathname.substring(0, loc.pathname.lastIndexOf('/'));
                for (var d = 0; d < dotdotCount; d++) {
                    trimmedPath = trimmedPath.substring(0, trimmedPath.lastIndexOf('/'));
                }

                value = value.replace(
                    'chrome-extension://' + chrome.runtime.id + '/', 
                    loc.origin + trimmedPath + '/'
                );
            }
            else if (value.match('chrome-extension://' + chrome.runtime.id + '/')) {
                value = value.replace('chrome-extension://' + chrome.runtime.id + '/', loc.origin + '/');
            }
            else {
                value = value.replace('chrome-extension:', loc.protocol);
            }       
        }

        return (new URL(value, loc.origin));
    };
}

window[GCon.WIN_PROP.LOGICKER_ST] = Logicker;

export default Logicker;
