'use strict'

/**
 * Client-Script for GimmeGimmieGimmie. Returns the location object, and will
 * scrape the page via a prop and a selector if asked -- or the extension can.
 */
var LocationGrabber = (function(loc, doc) {
    var me = {};

    var GGGIMME_ID = 'gimmegimmegimme';
    var LOCATIONGRABBER_ID = 'locationgrabber';

    /**
     * Handle GallDigger calling to get the location.
     */
    me.onGetLocation = function onGetLocation(req, sender, res) {
        // Do not respond at all if not from Galldigger.
        if (req.senderId == GGGIMME_ID) {
            // If we were asked for it, return an array of propValues for the propname and selector.
            if (req.selector && req.linkHrefProp && req.thumbSrcProp) {
                var selector = req.selector;
                var hrefProp = req.linkHrefProp;
                var hrefPropArr = (hrefProp ? hrefProp.split('.') : []);
                var srcProp = req.thumbSrcProp;
                var srcPropArr = (srcProp ? srcProp.split('.') : []);

                // Get the selected tags, build an array of values from their propName property.
                // if keyPropName is specified, that prop contains the value to use for the array key.
                var zoomLinkUris = [];
                var thumbUris = [];

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
                            var zoomUrl = new URL(value, baseUri);
                            var thumbUrl = new URL(value2, baseUri);

                            zoomLinkUris.push(zoomUrl.href);
                            thumbUris.push(thumbUrl.href);
                        }
                    });
                }

                // Respond with our results, the window.location, an identifier, and our inputs.
                return res({
                    'contentScriptId': LOCATIONGRABBER_ID,

                    'locator': loc,
                    'zoomLinkUris': zoomLinkUris,
                    'thumbUris': thumbUris,
                    'docHtml': doc.documentElement.outerHTML,
                    
                    'inputs': {
                        'senderId': GGGIMME_ID,
                        'selector': selector,
                        'linkHrefProp': hrefProp,
                        'thumbSrcProp': srcProp,
                    },
                });
            }
            else { 
                if (req.thegreening == true) { // <-- GreenTextOnBlackify the page.
                    me.wraithIt();
                }

                // Send the result, identifying us, the inputs we received, the window.location, and
                // an empty array for propValues, as we weren't asked for any.
                return res({
                    'contentScriptId': LOCATIONGRABBER_ID,

                    'locator': loc,
                    'zoomLinkUris': [],
                    'thumbUris': [],
                    'docHtml': doc.documentElement.outerHTML,

                    'inputs': {
                        'senderId': GGGIMME_ID,
                        'thegreening': true
                    }
                });
            }
        }
    };

    // hook up listener.
    chrome.runtime.onMessage.addListener(me.onGetLocation);



    /**
     * EASTER EGGGGGGG
     */
    me.wraithIt = function wraithIt() {
        var nodes = document.querySelectorAll('*');

        for (var i=0; i < nodes.length; i++) {
            var node = nodes[i];

            if (node.style) {
                node.style.backgroundColor = "rgba(0,0,0,1)";
                node.style.color = "rgba(0,255,0,1)";
                node.style.fontFamily = "monaco monospace";

                if (node.style.border) {
                    node.borderColor = "rgba(0,255,0,1)";
                }
            }
        }
    };


    return me;
})(window.location, document);