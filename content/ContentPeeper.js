// constants
const GIMME_ID = 'gimme';
const CONTENTPEEPER_ID = 'contentpeeper';
const CONTENTPEEPER_WINDOW_KEY = 'GimmeGimmeGimme_ContentPeeper';


/**
 * Client-Script for Gimme. Returns the location object, and will
 * scrape the page via a prop and a selector if asked.
 */
class ContentPeeper {
    loadComplete = false;
    peepingAround = false;


    /**
     * Constructor which sets up the event handlers for window load complete,
     * document load complete, and (of course) our extension message listener.
     */
    constructor()
    {
        // Send a message to the background when window load is complete.
        var setWindowLoadComplete = () => {
            window.removeEventListener('load', setWindowLoadComplete, false);
            this.loadComplete = true;
    
            console.log('[ContentPeeper] Content Tab\'s Window.load() fired.');        
    
            chrome.runtime.sendMessage({ 
                content: 'ContentPeeper window load',
                uri: document.location.href,
                docOuterHtml: document.documentElement.outerHTML,
             });
        };
        window.addEventListener('load', setWindowLoadComplete, false);
    

        // Send a message to the background when document load is complete.
        var setDocLoadComplete = () => {
            if (document.readyState === 'complete') {
                document.removeEventListener('readystatechange', setDocLoadComplete, false);
                this.loadComplete = true;
    
                console.log('[ContentPeeper] Content Tab\'s Window.document.readyState is "complete".');                    
    
                chrome.runtime.sendMessage({ 
                    content: 'ContentPeeper doc complete',
                    uri: document.location.href,
                    docOuterHtml: document.documentElement.outerHTML,
                });
            }
        };
        document.addEventListener('readystatechange', setDocLoadComplete, false);


        // Do the content-peeping around for the backend when it messages us.
        chrome.runtime.onMessage.addListener((req, sender, res) => {
            this.peepAroundOnceContentLoaded(req, sender, res, false);
        });
    }


    /**
     * The message handler for gimme sending the peep request. 
     * Note: returns true, as this is aync.
     */
    peepAroundOnceContentLoaded(req, sender, res, secondTry) {
        console.log('[ContentPeeper] Got message with request: ' + JSON.stringify(req));

        // Don't respond if we didn't get all of the data we need.
        if (!req || !sender || !res) {
            console.log('[ContentPeeper] Peep action request missing required fields. Not responding,');
            return false;
        }

        // Don't even respond if it's not gimme. return blank if we have a no-good window object.
        if (req.senderId !== GIMME_ID) {
            console.log('[ContentPeeper] Sent message by someone other than gimme, "' + req.senderId + '". Not responding.');
            return false;
        }

        // if any images haven't loaded yet, try again. In fact, keep trying until they all loaded.
        // Even failures to load will mark them as complete.
        if (this.loadComplete && document && !!document.location && document.images && document.images.length) {
            var allImagesComplete = true;
            
            for (var idx = 0; idx < document.images.length; idx++) {
                var image = document.images[idx];
                if ('complete' in image) {
                    allImagesComplete = allImagesComplete && image.complete; 
                }
            }

            if (!allImagesComplete) {
                if (!secondTry) {
                    console.log('[ContentPeeper] Not all images complete. Trying again in 2 seconds.');
                    
                    setTimeout(() => {
                        this.peepAroundOnceContentLoaded(req, sender, res, true);
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
            
            'locator': {},
            'docOuterHtml': '',
            'galleryMap': {},

            'inputs': Object.assign({}, req),
        };
        
        // Choose which function we are to do off of the command and validation of inputs.
        var proc;
        if (!document || !document.location || !document.location.href || !document.documentElement || !document.documentElement.outerHTML) {
            proc = this.badDocumentProc;
        }        
        else 
        {
            // Now we can safely set the locator and docOuterHtml
            resPayload.locator = Object.assign({}, document.location);
            resPayload.docOuterHtml = document.documentElement.outerHTML;

            if (this.peepingAround) {
                proc = this.alreadyPeepingAround;
            }
            else if (req.command === 'peepAround' && req.linkSelector && req.linkHrefProp && req.thumbSubselector && req.thumbSrcProp) {
                proc = this.peepAround;            
            }
            else {
                proc = this.errorProc;
            }
        }

        // If the page hasn't loaded, set up event listeners to call once we've loaded.
        if (!secondTry && !this.loadComplete) {
            console.log('[ContentPeeper] DOM not loaded. Setting event handlers.');
            
            // set one for page load.
            var load = (event) => {
                window.removeEventListener("load", load, false); //remove listener, no longer needed
                
                if (!this.peepingAround) {
                    resPayload = proc(resPayload, req)
                    res(resPayload);
                }
            };
            window.addEventListener("load", load, false);

            // set one for document.readyState === 'complete'.
            var rsc = (event) => {
                document.removeEventListener('readystatechange', rsc, false);
                
                if (document.readyState === 'complete' && !this.peepingAround) {
                     resPayload = proc(resPayload, req)
                     res(resPayload);
                }
            };
            document.addEventListener('readystatechange', rsc, false);

            // async - wait for the events.
            return true;
        }

        // sync - peep around the document
        this.peepingAround = true;
        resPayload = proc(resPayload, req);
        this.peepingAround = false;
        

        // console.log('[ContentPeeper] -----------------------------');
        // console.log(req);
        // console.log(resPayload);
        // console.log('[ContentPeeper] -----------------------------')
        // console.log('[ContentPeeper] Sending response');

        res(resPayload);
        return true;
    }


     /**
      * If our loc or doc is bad.
      */ 
    badDocumentProc(payload) {
        console.log('[ContentPeeper] Bad locator or bad document. Stopping.');
        
        resPayload.status = 'error';
        resPayload.error = 'Bad locator or bad document';

        return payload;
    }


    /**
     * Default function to call if not a command we know.
     */
    errorProc(payload) {
        console.log('[ContentPeeper] Bad command sent. Stopping.');
        
        payload.status = 'what?';
        payload.error = 'No such command';

        return payload;
    }


    /**
     * Function to call if we're already peeping around right now.
     */
    alreadyPeepingAround(payload) {
        console.log('[ContentPeeper] Already peeping around. Not starting another peeping.');

        payload.status = 'peeping around';
        payload.error = 'Already peeping around';
        
        return payload;
    }


 
    /**
     * Handle Gimme calling to get document.location.
     * Also do a simple page scrape for whatever is asked.
     */
    peepAround(payload, req) {     
        // If we were asked for it, return an array of propValues for the propname and selector.
        var linkSelector = req.linkSelector;
        var hrefProp = req.linkHrefProp;
        var hrefPropArr = (hrefProp ? hrefProp.split('.') : [hrefProp]);
        
        var thumbSubselector = req.thumbSubselector;
        var srcProp = req.thumbSrcProp;
        var srcPropArr = (srcProp ? srcProp.split('.') : [srcProp]);
        
        var useRawValues = req.useRawValues;

        // Get the selected tags, build an array of values from their propName property.
        // if keyPropName is specified, that prop contains the value to use for the array key.
        var galleryMap = {};

        var linkTags = document.querySelectorAll(linkSelector);

        if (linkTags && linkTags.length) {
            linkTags.forEach((tag) => {
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
                        var zoomUrl = new URL(value, document.location);
                        var thumbUrl = new URL(value2, document.location);

                        galleryMap[thumbUrl.href] = zoomUrl.href;
                    }
                }
            });
        }

        // Respond with our results, the window.location, an identifier, and our inputs.
        payload.galleryMap = galleryMap;
        return payload;
    }
}

window[CONTENTPEEPER_WINDOW_KEY] = new ContentPeeper();

export default ContentPeeper;