/**
 * Client-Script for Gimme. Returns the location object, and will
 * scrape the page via a prop and a selector if asked.
 */
(function ContentPeeper(w) {
    // constants
    var GIMME_ID = 'gimme';
    var CONTENTPEEPER_ID = 'contentpeeper';
    var MAX_IMG_HEIGHT = 500;
    var MAX_IMG_WIDTH = 500;
    var URL_EXTRACTING_REGEX = /(url\()?(\'|\")?(https?:\/\/|data|blob)\:.+?(\'|\")?\)?/i;    
    
    
    var doc = w.document;
    var loc = w.location;
    var loadComplete = (document.readyState === 'complete');
    var peepingAround = false;

    

    window.addEventListener('load', function setWindowLoadComplete() {
        window.removeEventListener('load', setWindowLoadComplete, false);
        loadComplete = true;

        console.log('[ContentPeeper] Content Tab\'s Window.load() fired.');        

        chrome.runtime.sendMessage({ 
            content: 'ContentPeeper window load',
            uri: loc.href,
            docInnerHtml: doc.documentElement.innerHTML,
         });
    }, false);

    doc.addEventListener('readystatechange', function setDocLoadComplete() {
        if (doc.readyState === 'complete') {
            doc.removeEventListener('readystatechange', setDocLoadComplete, false);
            loadComplete = true;

            console.log('[ContentPeeper] Content Tab\'s Window.document.readyState is "complete".');                    

            chrome.runtime.sendMessage({ 
                content: 'ContentPeeper doc complete',
                uri: loc.href,
                docInnerHtml: doc.documentElement.innerHTML,
            });
        }
    }, false);


    /**
     * The message handler for gimme sending the peep request. 
     * Note: returns true, as this is aync.
     */
    function peepAroundOnceContentLoaded(req, sender, res, secondTry) {
        // Don't even respond if it's not gimme. return blank if we have a no-good window object.
        if (req.senderId !== GIMME_ID) {
            console.log('[ContentPeeper] Sent message by someone other than gimme. Not responding.');
            return false;
        }

        // if any images haven't loaded yet, try again. In fact, keep trying until they all loaded.
        // Even failures to load will mark them as complete.
        if (loadComplete && !!loc && !!doc && doc.images && doc.images.length) {
            var allImagesComplete = true;
            
            for (var idx = 0; idx < doc.images.length; idx++) {
                var image = doc.images[idx];
                if ('complete' in image) {
                    allImagesComplete = allImagesComplete && image.complete; 
                }
            }

            if (!allImagesComplete) {
                if (!secondTry) {
                    console.log('[ContentPeeper] Not all images complete. Trying again in 2 seconds.');
                    setTimeout(function() {
                        peepAroundOnceContentLoaded(req, sender, res, true);
                    }, 2000);
                    return true;
                }
                else {
                    console.log('[ContentPeeper] Proceeding though not all images are loaded.');
                }   
            }            
        }

        // Put in the basics of the payload.
        var resPayload = {
            'contentScriptId': CONTENTPEEPER_ID,
            'status': 'success',
            'error': '',
            
            'locator': Object.assign({}, loc),
            'docInnerHtml': doc.documentElement.outerHtml,
            'galleryMap': {},

            'inputs': Object.assign({}, req),
        };
        
        // Choose which function we are to do off of the command and validation of inputs.
        var proc;
        if (!loc || !doc || !loc.href || !doc.documentElement) {
            proc = badDocumentProc;
        }        
        else if (peepingAround) {
            proc = alreadyPeepingAround;
        }
        else if (req.command === 'peepAround' && req.linkSelector && req.linkHrefProp && req.thumbSubselector && req.thumbSrcProp) {
            proc = peepAround;            
        }
        else {
            proc = errorProc;
        }

        // If the page hasn't loaded, set up event listeners to call once we've loaded.
        if (!secondTry && !loadComplete) {
            console.log('[ContentPeeper] DOM not loaded. Setting event handlers.');
            
            // set one for page load.
            window.addEventListener("load", function load(event){
                window.removeEventListener("load", load, false); //remove listener, no longer needed
                
                if (!peepingAround) {
                    resPayload = proc(resPayload, req)
                    res(resPayload);
                }
            }, false);

            // set one for document.readyState === 'complete'.
            doc.addEventListener('readystatechange', function rsc(event) {
                doc.removeEventListener('readystatechange', rsc, false);
                
                if (doc.readyState === 'complete' && !peepingAround) {
                     resPayload = proc(resPayload, req)
                     res(resPayload);
                }
            }, false);

            // async - wait for the events.
            return true;
        }

        // sync - peep around the document
        peepingAround = true;
        resPayload = proc(resPayload, req);
        peepingAround = false;
        
        console.log('[ContentPeeper] Sending response');

        res(resPayload);
        return false;
    }


     /**
      * If our loc or doc is bad.
      */ 
     function badDocumentProc(payload) {
        console.log('[ContentPeeper] Bad locator or bad document. Stopping.');
        
        resPayload.status = 'error';
        resPayload.error = 'Bad locator or bad document';

        return payload;
    }


    /**
     * Default function to call if not a command we know.
     */
    function errorProc(payload) {
        console.log('[ContentPeeper] Bad command sent. Stopping.');
        
        payload.status = 'what?';
        payload.error = 'No such command';

        return payload;
    }


    /**
     * Function to call if we're already peeping around right now.
     */
    function alreadyPeepingAround(payload) {
        console.log('[ContentPeeper] Already peeping around. Not starting another peeping.');

        payload.status = 'peeping around';
        payload.error = 'Already peeping around';
        
        return payload;
    }


 
    /**
     * Handle Gimme calling to get document.location.
     * Also do a simple page scrape for whatever is asked.
     */
    function peepAround(payload, req) {     
        // If we were asked for it, return an array of propValues for the propname and selector.
        var linkSelector = req.linkSelector;
        var hrefProp = req.linkHrefProp;
        var hrefPropArr = (hrefProp ? hrefProp.split('.') : []);
        
        var thumbSubselector = req.thumbSubselector;
        var srcProp = req.thumbSrcProp;
        var srcPropArr = (srcProp ? srcProp.split('.') : []);
        
        var useRawValues = req.useRawValues;

        // Get the selected tags, build an array of values from their propName property.
        // if keyPropName is specified, that prop contains the value to use for the array key.
        var galleryMap = {};

        var linkTags = doc.querySelectorAll(linkSelector);

        if (linkTags && linkTags.length) {
            linkTags.forEach(function getPropFromTag(tag) {
                var wasError = false;

                // Get the href by going through each key til we hit the 
                // href value at the end.
                var value = tag;                        
                for (var i=0; i < hrefPropArr.length; i++) {
                    if (value) {
                        value = value[hrefPropArr[i]];
                    }
                    else {
                        wasError = true;
                    }
                }

                // Get the thumbSrc by going through each key til we hit
                // the src value at the end.
                var value2 = tag.querySelector(thumbSubselector);                        
                for (var j=0; j < srcPropArr.length; j++) {
                    if (value2) {
                        value2 = value2[srcPropArr[j]];
                    }
                    else {
                        wasError = true;
                    }
                }

                if (!wasError) {
                    if (useRawValues) {
                        galleryMap[value2] = value;
                    }
                    else {
                        var zoomUrl = new URL(value, loc);
                        var thumbUrl = new URL(value2, loc);

                        galleryMap[thumbUrl.href] = zoomUrl.href;
                    }
                }
            });
                
            // Respond with our results, the window.location, an identifier, and our inputs.
            payload.galleryMap = galleryMap;
            return payload;
        }
    }

    // hook up the event listener.
    chrome.runtime.onMessage.addListener(peepAroundOnceContentLoaded);
})(window);
