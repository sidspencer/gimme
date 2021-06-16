import { default as C } from '../lib/C.js';
import CommonBase from '../lib/CommonBase.js';
import { 
    ContentMessage, 
    ContentPeeperMessage,
    Log,
 } from '../lib/DataClasses.js';


/**
 * Client-Script for Gimme. Returns the location object, and will
 * scrape the page via a prop and a selector if asked.
 */
class ContentPeeper extends CommonBase {
    // static instance.
    static instance = undefined;

    // instance properties.
    loadComplete = false;
    peepingAround = false;

    /**
     * Constructor which sets up the event handlers for window load complete,
     * document load complete, and (of course) our extension message listener.
     */
    constructor()
    {
        // Set up Log, and set up STOP listener.
        super(C.LOG_SRC.CONTENT_PEEPER);

        // Send a message to the background when window load is complete.
        var setWindowLoadComplete = () => {
            window.removeEventListener(C.EVT.LOAD, setWindowLoadComplete, false);
            this.loadComplete = true;
    
            //this.lm(('Content Tab\'s Window.load() fired.');        
    
            chrome.runtime.sendMessage(
                new ContentPeeperMessage( 
                    'ContentPeeper window load',
                    document.location.href,
                    document.documentElement.outerHTML,
                )
            );
        };
        window.addEventListener(C.EVT.LOAD, setWindowLoadComplete, false);
    
        // Send a message to the background when document load is complete.
        var setDocLoadComplete = () => {
            if (document.readyState === C.EVT.COMPLETE) {
                document.removeEventListener(C.EVT.RSC, setDocLoadComplete, false);
                this.loadComplete = true;
    
                // Send the message with the doc's URL and HTML to Gimme's backend.
                chrome.runtime.sendMessage(
                    new ContentPeeperMessage( 
                        'ContentPeeper doc complete',
                        document.location.href,
                        document.documentElement.outerHTML
                    )
                );
            }
        };
        document.addEventListener(C.EVT.RSC, setDocLoadComplete, false);

        // Do the content-peeping around for the backend when it messages us.
        chrome.runtime.onMessage.addListener((req, sender, res) => {
            this.peepAroundOnceContentLoaded(req, sender, res, false);
        });

        // Set the static instance.
        ContentPeeper.instance = this;
    }


    /**
     * Get the singleton instance.
     */
    static getInstance() {
        return ContentPeeper.instance;
    }


    /**
     * The message handler for gimme sending the peep request. 
     * Note: returns true, as this is aync.
     */
    peepAroundOnceContentLoaded(req, sender, res, secondTry) {
        //this.lm(('Got message with request: ' + JSON.stringify(req));

        // Don't respond if we didn't get all of the data we need.
        if (!req || !sender || !res) {
            //this.lm(('Peep action request missing required fields. Not responding,');
            return false;
        }

        // Don't even respond if it's not gimme. return blank if we have a no-good window object.
        if (req.senderId !== ContentMessage.GIMME_ID) {
            this.lm(`Sent message by not Gimme, but someone called "${req.senderId}". Not responding.`);
            return false;
        }

        // if any images haven't loaded yet, try again. In fact, keep trying until they all loaded.
        // Even failures to load will mark them as complete.
        if (this.loadComplete && !!document && !!document.location && !!document.images && !!document.images.length) {  
            var allImagesComplete = true;
            
            for (var idx = 0; idx < document.images.length; idx++) {
                var image = document.images[idx];
                if (C.EVT.COMPLETE in image) {
                    allImagesComplete = allImagesComplete && image.complete; 
                }
            }

            if (!allImagesComplete) {
                if (!secondTry) {
                    //this.lm(('Not all images complete. Trying again in 2 seconds.');
                    
                    setTimeout(() => {
                        this.peepAroundOnceContentLoaded(req, sender, res, true);
                    }, 2000);
                    
                    return true;
                }
                else {
                    //this.lm(('Proceeding though not all images are loaded.');
                }   
            }            
        } 

        // Put in the basics of the payload.
        var resPayload = {
            'contentScriptId': ContentMessage.CONTENTPEEPER,
            'status': 'success',
            'error': C.ST.E,
            
            'locator': {},
            'docOuterHtml': C.ST.E,
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
            else if (req.command === C.ACTION.PEEPAROUND && req.linkSelector && req.linkHrefProp && req.thumbSubselector && req.thumbSrcProp) {
                proc = this.peepAround;            
            }
            else {
                proc = this.errorProc;
            }
        }

        // If the page hasn't loaded, set up event listeners to call once we've loaded.
        if (!secondTry && !this.loadComplete) {
            //this.lm(('DOM not loaded. Setting event handlers.');
            
            // set one for page load.
            var load = (event) => {
                window.removeEventListener(C.EVT.LOAD, load, false); //remove listener, no longer needed
                
                if (!this.peepingAround) {
                    resPayload = proc(resPayload, req)
                    res(resPayload);
                }
            };
            window.addEventListener(C.EVT.LOAD, load, false);

            // set one for document.readyState === C.EVT.COMPLETE.
            var rsc = (event) => {
                document.removeEventListener(C.EVT.RSC, rsc, false);
                
                if (document.readyState === C.EVT.COMPLETE && !this.peepingAround) {
                     resPayload = proc(resPayload, req)
                     res(resPayload);
                }
            };
            document.addEventListener(C.EVT.RSC, rsc, false);

            // Returning true means Be Asynchronous - wait for the events.
            return true;
        }

        // sync - peep around the document
        this.peepingAround = true;
        resPayload = proc(resPayload, req);
        this.peepingAround = false;
        

        // this.lm(('-----------------------------');
        // console.log(req);
        // console.log(resPayload);
        // this.lm(('-----------------------------')
        // this.lm(('Sending response');

        res(resPayload);
        return true;
    }


     /**
      * If our loc or doc is bad.
      */ 
    badDocumentProc(payload) {
        this.lm('Bad locator or bad document. Stopping.');
        
        resPayload.status = 'error';
        resPayload.error = 'Bad locator or bad document';

        return payload;
    }


    /**
     * Default function to call if not a command we know.
     */
    errorProc(payload) {
        this.lm('Bad command sent. Stopping.');
        
        payload.status = 'what?';
        payload.error = 'No such command';

        return payload;
    }


    /**
     * Function to call if we're already peeping around right now.
     */
    alreadyPeepingAround(payload) {
        this.lm('Already peeping around. Not starting another peeping.');

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
        var hrefPropArr = (hrefProp ? hrefProp.split(C.ST.D) : [hrefProp]);
        
        var thumbSubselector = req.thumbSubselector;
        var srcProp = req.thumbSrcProp;
        var srcPropArr = (srcProp ? srcProp.split(C.ST.D) : [srcProp]);
        
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

// Any page we're on needs one ContentPeeper instance.
if (!window.hasOwnProperty(C.WIN_PROP.CONTENT_PEEPER_INST)) {
    if (!!ContentPeeper.getInstance()) {
        window[C.WIN_PROP.CONTENT_PEEPER_INST] = ContentPeeper.getInstance();
    }
    else {
        window[C.WIN_PROP.CONTENT_PEEPER_INST] = new ContentPeeper();
    }
}

// export;
export default ContentPeeper;
