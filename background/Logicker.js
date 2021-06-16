import * as mobilenet from '../node_modules/@tensorflow-models/mobilenet/dist/mobilenet.esm';
import { default as Utils } from './Utils.js';
import { default as CommonStaticBase } from '../lib/CommonStaticBase.js';
import { default as C } from '../lib/C.js';
import {
    ContentMessage,
    ProcessingInstructions,
    UriPair,
    ScoredUriPair,
    Dimensions,
    Log,
} from '../lib/DataClasses.js';
import Output from './Output.js';


/**
 * Logicker static class for stateless rules about how to 
 * find things on pages in general, and for specific sites.
 */
class Logicker extends CommonStaticBase {
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
    static MinZoomHeight = C.L_CONF.MIN_ZOOM_HEIGHT;
    static MinZoomWidth = C.L_CONF.MIN_ZOOM_WIDTH;


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
        var zoomHeight = parseInt(height + C.ST.E, 10);

        if (!isNaN(zoomHeight)) {
            Logicker.MinZoomHeight = zoomHeight;
        }
    }
    static setMinZoomWidth(width) {
        var zoomWidth = parseInt(width + C.ST.E, 10);

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
     * Perform setup for static class. It calls super.setup() to create the static log instance
     * and the event handler for STOP.
     */
    static setup() {
        if (!Utils.exists(Logicker.log)) {
            super.setup(C.LOG_SRC.LOGICKER);
        }
    }

    /**
     * Load the mobilenet image-matching model, and do it only once per instance.
     * Returns a promise resolving to our copy of this model.
     */
    static loadModel() {
        var me = this;

        return new Promise((resolve, reject) => {
            if (!!Logicker.mnModel) {
                // If it's already loaded, resolve with it.
                this.lm('returning cached copy of model.');
                resolve(Logicker.mnModel);
            }
            else if (Logicker.loadingModel === true) {
                //this.lm('Model is loading. We will wait a the end of the promise chain.');
                
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
                me.lm('Loading model...');
                const startTime = performance.now();

                Logicker.modelLoadPromiseChain = 
                    Logicker.modelLoadPromiseChain.then(() => { 
                        //return  Promise.reject('No current mobilenet support'); 
                        return mobilenet.load().then((mnModel) => {
                            Logicker.mnModel = mnModel;
                            Logicker.loadingModel = false;

                            if (!!Logicker.mnModel) {
                                resolve(Logicker.mnModel);
                            }
                            else {
                                reject('Mobilenet model came back null.')
                            } 
                        });
                    });

                const totalTime = Math.floor(performance.now() - startTime);
                me.lm(`Model loaded and initialized in ${totalTime}ms...`);
            }           
        });
    }


    /**
     * Using the TF Mobilenet model, get a classification vector for the image.
     */
    static classifyImage(imgElement) {
        var me = this;

        let p = new Promise((resolve, reject) => {
            // Stash away the original height and width.
            var originalHeight = imgElement.height;
            var originalWidth = imgElement.width;
    
            // Set the height and width to be the size that mobilenet expects.
            imgElement.height = C.L_CONF.IMAGE_SIZE;
            imgElement.width = C.L_CONF.IMAGE_SIZE;

            // Use mobilenet to get a classification array of objects.
            Logicker.mnModel.classify(imgElement, C.L_CONF.CLASSIFICATIONS).then((imgClassifications) => {
                // Restore the img's height and width.
                imgElement.height = originalHeight;
                imgElement.width = originalWidth;

                // Resolve with the classifications array if we got it.
                if (Array.isArray(imgClassifications)) {
                    //me.lm('mnModel.classify found these: ' + JSON.stringify(imgClassifications));
                    resolve(imgClassifications);  
                }
                else {
                    reject('[Logicker] Classifications came back null');
                }
            });
        }); 

        // Either resolves with the mobilenet classifications array, or rejects due the
        // array not being right.
        return p;
    }

    
    /**
     * Load an image via the Image() object, sized so tf can analyse it.
     */
    static loadImage(src) {
        return new Promise((resolve, reject) => {
            var img = new Image();
            img.src = src;
            img.crossOrigin = C.L_CONF.ANONYMOUS;

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
        var zoomImgUri = C.ST.E;
        var me = this;

        // Look through the blessings for one that matches this thumbUri.
        if (Logicker.blessings.length !== -1) {
            Logicker.blessings.forEach((blessing) => {
                //me.lm('applying blessing: ' + JSON.stringify(blessing));

                // If the thumbUri matches the pattern and we can find the blessed element,
                // use the blessing src prop on the element to get the right zoom uri.
                var matcher = new RegExp(blessing.match);
                if (matcher.test(doc.documentURI)) {
                    //me.lm('blessing matched thumbUri: ' + thumbUri);
                    var zoomImg = doc.querySelector(blessing.zoom);

                    if (!!zoomImg) {
                        //me.lm('found blessed zoomImg: ' + zoomImg[blessing.src]);

                        if (blessing.src.indexOf(C.SEL_PROP.STYLE) === 0) {
                            var parts = blessing.src.split(C.ST.D);
                            zoomImgUri = Logicker.extractUrl(zoomImg[parts[0]][parts[1]]);
                        }
                        else {
                            zoomImgUri = zoomImg[blessing.src];
                        }
                    }
                }
            });
        }

        // Do a special little thing here just for videos.
        if (zoomImgUri.length === 0) {
            var vidSource = doc.querySelector('video > source[src]');
            var vSrc = vidSource.src;


            if (!!vidSource && !!vidSource.src) {
                Output.toOut(`Using video with src:\n\t${vSrc}`);
                zoomImgUri = vidSource.src;
            }
            else {
                Output.toOut(`Not using that video.`);
            }
        }

        // Look for the trivial case, where it's a div.photo parent of a div child, where the div
        // child has a backgroundImage instead of an img tag -- totally sneaky pete.
        if (zoomImgUri.length === 0) {
            var holderDiv = doc.querySelector(`${C.SEL_PROP.DIV}.${C.CSS_CN.PHOTO} > ${C.SEL_PROP.DIV}`);

            // Extract the backgroundImage from the css props -- that background image is really
            // our zoom img.
            if (!!holderDiv && !!holderDiv.style.backgroundImage) {
                var bg = holderDiv.style.backgroundImage;
                zoomImgUri = bg.replace(C.ST.URL_P, C.ST.E)
                    .replace(/"/g, C.ST.E)
                    .replace(/'/g, C.ST.E)
                    .replace(C.ST.END_P, C.ST.E);
            }
        }

        // Returns empty string when there's no special rules.
        return zoomImgUri;
    };


    /**
     * Strip off file extension, punctuation, and common thumb/zoomed delineation strings.
     */
     static getRootForName(name)  {
        // force it to be a string, just in case.
        var root = C.ST.E + name;

        // remove "thumb" or "large" type words.
        root = root.replace(/(thumb|\/tn|small|thumbnail|\-t|full|large)/i, C.ST.E);

        // replace all punctuation with dashes.
        root = root.replace(/(_|-|\(|\)|\.)/gi, C.ST.DASH);

        return root;
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
        var sname = thumbUrl.path.replace(/\/$/, C.ST.E)
            .substring(thumbUrl.pathname.lastIndexOf(C.ST.WHACK) + 1)
            .substring(0, thumbUrl.pathname.lastIndexOf(C.ST.D));
        var zname = zoomUrl.pathname.replace(/\/$/, C.ST.E)
            .substring(zoomUrl.pathname.lastIndexOf(C.ST.WHACK + 1))
            .substring(0, zoomUrl.pathname.lastIndexOf(C.ST.D));

        // Do the low-hanging fruit first. Just don't hit your head on it.
        // first: The happiest of paths.
        if ((snaLogicker.indexOf(zname) != -1) || (znaLogicker.indexOf(sname) != -1)) {d
            isPossibly = true;
            return isPossibly;
        }

        // Get the "root" strings. Test the happy path
        var sroot = Logicker.getRootForName(sname);
        var zroot = Logicker.getRootForName(zname);

        if ((znaLogicker.indexOf(sroot) != -1) || (snaLogicker.indexOf(zroot) != -1)) {
            isPossibly = true;
            return isPossibly;
        }

        // Now we get serious.
        //
        // Try getting the parts of the name alone, like hoping for a set number or something.
        // Get all the path parts of the pathname. we'll check for them individually.
        var sparts = [].concat(thumbUrl.pathname.split(C.ST.WHACK));
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
        var me = this;

        // Make sure the model is loaded. We will wait for that using
        // a promise chain built inside loadModel().
        let p = Logicker.loadModel().then((mobilenetModel) => {
            return new Promise((resolve, reject) => {
                Logicker.loadImage(thumbUri).then((thumbImg) => {
                    if (!!thumbImg) {
                        resolve(Logicker.classifyImage(thumbImg));
                    }
                    else {
                        me.lm(`ThumbUri will not load, rejecting: ${thumbUri}`);
                        reject('ThumbUri will not load: ' + thumbUri);
                    }
                });
            });
        })
        // Process all the images in the doc for scores.
        .then((thumbClassifications) => {
            return new Promise((topLevelResolve, topLevelReject) => {
                var imgs = doc.querySelectorAll(C.SEL_PROP.IMG);
                var imgPromises = [];
                var largestImgSrc = undefined;
                var largestDims = new Dimensions(Logicker.MinZoomHeight, Logicker.MinZoomWidth);

                // Check every image for similarities.
                //me.lm('Checking ${imgs.length} images for TF similarity to the test image.`);
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
                                C.L_CONF.IMAGE_SIZE, 
                                C.L_CONF.IMAGE_SIZE
                            );

                            // Must use the "function" keyword so "this" points to the image.
                            testImg.onload = function onload() {
                                //me.lm('Loaded document image for TF scoring: ' + imgSrc);
                                if (Logicker.isKnownBadImg(this.src)) {
                                    me.lm('Known bad image naLogicker. Skipping...');
                                    resolve(zeroResponse);
                                    return;
                                } 
                                else {
                                    // Skip the image if it is not big enough.
                                    if (!Logicker.isZoomSized(originalDims)) {
                                        me.lm('Image too small. Skipping...');
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

                                // Do the scoring using tfjs mobilenet.
                                Logicker.classifyImage(this).then((classifications) => {
                                    if (!Array.isArray(classifications)) {
                                        me.lm(`got no classifications for img ${imgSrc}`);
                                        resolve(zeroResponse);
                                        return;
                                    }
                                    else {
                                        //me.lm('got classifications for img ${imgSrc}: ${JSON.stringify(classifications)}`);
                                        me.lm(`got classifications for img ${imgSrc}`);
                                    }
                                    
                                    var classAgreements = [];
                                    var totalClassesCount = classifications.length;
                    
                                    // For each of the class-match classifications, see how they compare to the thumbnail's classifications.
                                    // As the classifications are just arrays of objects of the form {className: C.ST.E, propability: 0}, we must
                                    // iterate in a nested loop. :(
                                    classifications.forEach((cls) => {
                                        thumbClassifications.forEach((tCls) => {
                                            if (tCls.className.indexOf(cls.className) != -1) {
                                                if (Math.abs(cls.probability - tCls.probability) < C.L_CONF.SCORE_CUTOFF) {
                                                    classAgreements.push(cls.className);
                                                } 
                                            }
                                        });
                                    });

                                    // Create a simple percentage score of the class matches. Resolve with the same object structure
                                    // that getPairWithLargestImage() does.
                                    var score = classAgreements.length / totalClassesCount;
                                    me.lm(`candidate ${imgSrc} has a match score to ${thumbUri} of: ${score}`);

                                    resolve(new ScoredUriPair(thumbUri, (new URL(imgSrc)).href, score));
                                });
                            };

                            // On error, still resolve. (Waiting on support for Promise.allSettled()).
                            // Must use the "function" keyword so "this" points to the image.
                            testImg.onerror = function onerror(evt) {
                                me.lm(
                                    'Error loading image for TF classifying. Resolving with score of 0.' +
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
                    var topImgScoreObj = new ScoredUriPair(thumbUri, C.ST.E, 0);
                    
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

                    me.lm(`TF Mobilenet's most likely match ->\n -Score: ${topImgScoreObj.score}, Uri: ${topImgScoreObj.zoomUri}`);
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
        var me = this;

        let p = new Promise((resolve, reject) => {
            var largestImgSrc = false;
            var largestDims = new Dimensions(0, 0);
 
            if (!!doc && !!doc.querySelectorAll) {                
                // Get all the imageNodes from the doc we are to search.
                //
                // NOTE: Since it is not a *rendered* document, just one returned from the XHR, there are no client rects.
                //       So we have to create image objects.
                var imgNodes = doc.querySelectorAll(C.SEL_PROP.IMG);
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
                        me.lm('Error creating image object to get dimensions. evt: ' + JSON.stringify(evt));
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
                me.lm('Invalid doc object passed to findUrlOfLargestImage().');
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
            
            this.lm('working on message: ' + JSON.stringify(m));

            if (url.match(m.match)) {
                this.lm('uri matched: ' + url);

                d.linkSelector = m.link;
                d.linkHrefProp = m.href;

                // Note, :scope the subselector.
                d.thumbSubselector = (
                    m.thumb.indexOf(C.SEL_PROP.SCOPE) === -1 ? 
                    `${C.SEL_PROP.SCOPE} ${m.thumb}` : 
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
            var me = this;

            //this.lm('working on processing: ' + JSON.stringify(p));

            // if the page uri matches, apply the processings to the galleryMap.
            var matcher = new RegExp(p.match);
            if (pageUri.match(matcher)) {
                //me.lm('pageUri matched: ' + pageUri);

                newGalleryMap = {};
                thumbUris.forEach((thumbUri) => {
                    var thumbUri2 = thumbUri + C.ST.E;

                    p.actions.forEach((act) => {
                        //me.lm('applying action: ' + JSON.stringify(act));

                        // We only support "replace" for now.
                        if (act.verb !== C.PP_VERB.REPLACE) {
                            return;
                        }

                        var matchey = new RegExp(act.match);
                        //me.lm('testing thumbUri with matcher...');

                        // Use the thumbUri if 'src', otherwise the 'href', zoomPageUri
                        if (act.noun === 'src' && thumbUri.match(matchey)) {
                            //me.lm('thumbUri matched. Replacing.');

                            thumbUri2 = thumbUri.replace(matchey, act.new);

                            if (thumbUri2.indexOf(C.F_NAMING.W_PREVIEWS_W) !== -1) {
                                thumbUri2 = thumbUri2.replace(C.F_NAMING.PREVIEWS_W, C.ST.E);
                            }
                            if (thumbUri2.indexOf(C.ST.Q_MK) !== -1) {
                                thumbUri2 = thumbUri.substring(0, thumbUri.indexOf(C.ST.Q_MK));
                            }
                            newGalleryMap[thumbUri] = thumbUri2; 
                        }
                        else if (act.noun === C.SEL_PROP.HREF && galleryMap[thumbUri].match(matchey)) {
                            //me.lm('zoomPageUri matched. Replacing.');

                            newGalleryMap[thumbUri] = galleryMap[thumbUri].replace(matchey, act.new);
                        }
                    });

                    // Put all other valid pairs into newGalleryMap, even the not actionated ones.
                    if (!newGalleryMap[thumbUri] && !!galleryMap[thumbUri]) {
                        newGalleryMap[thumbUri] = galleryMap[thumbUri] + C.ST.E;
                    }

                    //me.lm('new thumbUri, zoomUri: \n ' + thumbUri2 + '\n ' + newGalleryMap[thumbUri2]);
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
        if (!src || !(firstUri || secondUri)) { return C.ST.E; }
        else if (!secondUri) { return firstUri; }
        else if (!firstUri) { return secondUri; }

        // strip of the querystring if there is one.
        var bareSrc = src;        
        var srcQsIndex = bareSrc.indexOf(C.ST.Q_MK);
        if (srcQsIndex !== -1) { bareSrc = bareSrc.substring(0, srcQsIndex); };

        // if there's no extension C.ST.D, and we're not of protocol 'data:' or 'blob:', 
        // it's probably not a good <img>.
        var extIndex = bareSrc.lastIndexOf(C.ST.D);
        if (extIndex === -1) { return; };

        // Get just the name without the extension.
        var imgCanonicalName = bareSrc.substring(bareSrc.lastIndexOf(C.ST.WHACK)+1, extIndex);
        
        // check if the firstUri has the canonical name in one of its path parts.
        var firstHasIt = false;
        var firstUriArray = firstUri.split(C.ST.WHACK);
        firstUriArray.forEach((pathPart) => {
            if (!firstHasIt && pathPart.indexOf(imgCanonicalName) !== -1) {
                firstHasIt = true;
            }
        });                    

        // check if the secondUri has the canonical name in one of its path parts.
        var secondHasIt = false;
        var secondUriArray = secondUri.split(C.ST.WHACK);
        secondUriArray.forEach((pathPart) => {
            if (!secondHasIt && pathPart.indexOf(imgCanonicalName) !== -1) {
                secondHasIt = true;
            }
        });
        
        // Give the first uri priority. 
        var zoomPageUri = C.ST.E; 
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
            return C.ST.E;
        }

        // horrible hack for google images.
        if (tag.baseURI.indexOf('google.com') !== -1) {
            return tag.parentNode.href;
        }

        // Iterate through the path of properties to get the value.
        var pathParts = propPath.split(C.ST.D);
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
            return C.ST.E; 
        };

        // Special processing for srcset props.
        var lastPart = pathParts[pathParts.length-1];
        if (lastPart === 'srcset') {
            value = value.split(',')[0].split(' ')[0];
        }
        
        // Count the '..'s in relative uris. This is needed for the cases where we have to change from a 
        // C.WAY.CH_CWW reported uri. 
        var dotdotCount = 0;
        if (lastIterator && lastIterator.getAttribute && lastIterator.getAttribute(lastPart)) {
            dotdotCount = (lastIterator.getAttribute(lastPart).match(/\.\./g) || []).length;
        }

        // Do a url extraction from functions or javascript hrefs.
        if (typeof value === 'function' || /^(java)?script\:/.test(value)) {
            var text = value.toString();
            value = C.L_CONF.URL_EXTRACTING_REGEX.exec(text);

            if (!!value && value.length) {
                value = value[0];
            }
        }
        if (!value) { return C.ST.E; };

        // Remove the 'url("...")' wrapping from css background images.
        if (value.indexOf('url(') !== -1) {
            value = value.replace('url(', C.ST.E).replace(')', C.ST.E);
            value = value.replace("'", C.ST.E);
            value = value.replace('"', C.ST.E);
        }

        // Because we do an XHR with the "document" response type to get the thumbs and links, the inferred src/href
        // may be set relative to the extension (as the origin of the fetched document is in the extension's space).
        // We need to transform these weird src/href values back into having the correct base uri -- the one of the page.
        if (value.indexOf(C.WAY.HTTP) === 0) {
            // We may be running in the extension's space. That could be a protocol of 
            var rgxBackgroundPage = new RegExp('^(.+)?(-)?' + (C.WAY.E_CWW + chrome.runtime.id + C.F_NAMING.W_BACKGROUND_W), 'i');
            var rgxExtBase = new RegExp('^(.+)?(-)?' + (C.WAY.E_CWW + chrome.runtime.id + C.ST.WHACK), 'i');
            var rgxProtocol = new RegExp('^(.+)?(-)?' + C.WAY.E, 'i');

            if (value.match(rgxBackgroundPage)) {
                value = value.replace(
                    rgxBackgroundPage, 
                    loc.origin + loc.pathname.substring(0, loc.pathname.lastIndexOf(C.ST.WHACK)+1)
                ); 
            }
            else if (value.match(rgxExtBase) && dotdotCount > 0) {
                var trimmedPath = loc.pathname.substring(0, loc.pathname.lastIndexOf(C.ST.WHACK));
                
                for (var d = 0; d < dotdotCount; d++) {
                    trimmedPath = trimmedPath.substring(0, trimmedPath.lastIndexOf(C.ST.WHACK));
                }

                value = value.replace(rgxExtBase, loc.origin + trimmedPath + C.ST.WHACK);
            }
            else if (value.match(rgxExtBase)) {
                value = value.replace(rgxExtBase, loc.origin + C.ST.WHACK);
            }
            else {
                value = value.replace(rgxProtocol, loc.protocol);
            }       
        }

        return (new URL(value, loc.origin));
    };
}

// Call our static setup. It guards against 
Logicker.setup();

// Set the class on the background window just in case.
if (Utils.isBackgroundPage(window) && !window.hasOwnProperty(C.WIN_PROP.LOGICKER_CLASS)) {
    window[C.WIN_PROP.LOGICKER_CLASS] = Logicker;
}

// export.
export default Logicker;
