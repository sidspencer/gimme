/**
 * Client-Script for Gimme. Returns the location object, and will
 * scrape the page via a prop and a selector if asked.
 */
(function ContentPeeper(w) {
    // constants
    var GIMME_ID = 'gimme';
    var CONTENTPEEPER_ID = 'contentpeeper';
    
    var doc = w.document;
    var loc = w.location;
    var loadComplete = (document.readyState === 'complete');
    var peepingAround = false;

    window.addEventListener('load', function setWindowLoadComplete() {
        window.removeEventListener('load', setWindowLoadComplete, false);
        loadComplete = true;

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
    function peepAroundOnceContentLoaded(req, sender, res) {
        if (loadComplete && !peepingAround) {
            peepAround(req, sender, res);
        }
        else {
            window.addEventListener("load", function load(event){
                window.removeEventListener("load", load, false); //remove listener, no longer needed
            
                if (!peepingAround) {
                    peepAround(req, sender, res);
                }
            }, false);

            doc.addEventListener('readystatechange', function rsc(event) {
                if (doc.readyState === 'complete') {
                    doc.removeEventListener('readystatechange', rsc, false);
                
                    if (!peepingAround) {
                        peepAround(req, sender, res);
                    }
                }
            }, false);
        }

        return true;
    }

    /**
     * Handle Gimme calling to get document.location.
     * Also do a simple page scrape for whatever is asked.
     */
    function peepAround(req, sender, res) {
        peepingAround = true;
        var response = undefined;

        // Do not respond at all if not from Gimme.
        if (req.senderId == GIMME_ID) {
            if (!loc || !doc) {
                console.log("[ContentPeeper] No window.location, no window.document");
            }
            else {
                console.log("[ContentPeeper] Looking in window.document...")
            }

            // If we were asked for it, return an array of propValues for the propname and selector.
            if (req.selector && req.linkHrefProp && req.thumbSrcProp) {
                var selector = req.selector;
                var hrefProp = req.linkHrefProp;
                var hrefPropArr = (hrefProp ? hrefProp.split('.') : []);
                var srcProp = req.thumbSrcProp;
                var srcPropArr = (srcProp ? srcProp.split('.') : []);
                var useRawValues = req.useRawValues;

                // Get the selected tags, build an array of values from their propName property.
                // if keyPropName is specified, that prop contains the value to use for the array key.
                var galleryMap = {};

                var tags = document.querySelectorAll(selector);
                var baseUri = location.href.substring(0, location.href.lastIndexOf('/') + 1);

                if (tags) {
                    tags.forEach(function getPropFromTag(tag) {
                        var value = tag;
                        var value2 = tag;
                        var wasError = false;

                        for (var i=0; i < hrefPropArr.length; i++) {
                            if (value) {
                                value = value[hrefPropArr[i]];
                            }
                            else {
                                wasError = true;
                            }
                        }

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
                                var zoomUrl = new URL(value, baseUri);
                                var thumbUrl = new URL(value2, baseUri);

                                galleryMap[thumbUrl.href] = zoomUrl.href;
                            }
                        }
                    });
                }

                // Respond with our results, the window.location, an identifier, and our inputs.
                response = {
                    'contentScriptId': CONTENTPEEPER_ID,

                    'locator': loc,
                    'docInnerHtml': w.document.documentElement.innerHTML,
                    'galleryMap': galleryMap,
                    
                    'inputs': {
                        'senderId': GIMME_ID,
                        'selector': selector,
                        'linkHrefProp': hrefProp,
                        'thumbSrcProp': srcProp,
                        'useRawValues': useRawValues,
                    },
                };
            }
            else {
                // Send the result, identifying us, the inputs we received, the window.location, and
                // an empty array for propValues, as we weren't asked for any.
                response = {
                    'contentScriptId': CONTENTPEEPER_ID,

                    'locator': loc,
                    'docInnerHtml': w.document.documentElement.innerHTML,
                    'galleryMap': {},

                    'inputs': {
                        'senderId': GIMME_ID,
                    },
                };
            }
        }

        res(response);
        return true;
    }

    // hook up the event listener.
    chrome.runtime.onMessage.addListener(peepAroundOnceContentLoaded);
})(window);
