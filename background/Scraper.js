'use strict'

/**
 * Scraper service/singleton for Gimme. It holds all the
 * functions for scraping a node.
 */
var Scraper = (function Scraper(Utils) {
    // service object
    var me = {};

    // aliases
    var u = Utils;

    // constants
    var DEFAULT_ALL_JS_SELECTOR = '*[onclick],*[onmouseover],*[onmouseout],*[onmouseenter],*[onchange],[href^="javascript:"],script';    
    var BLANK_LOC = new URL('http://localhost/');

    /**
     * Collect all the values of "propName" of all the tags of a given kind on
     * the page.
     */
    me.getElementUrls = function getElementUrls(inOpts) {
        if (!u.exists(inOpts) || !u.exists(inOpts.root)) {
            console.log('[Scraper] getElementUrls called with no root node.');
            return [];
        }

        var ptns = {
            root: inOpts.root,
            loc: inOpts.loc,
            selector: '*',
            propName: 'currentSrc',
            subPropName: undefined,
            subSubPropName: undefined,
            altPropName: 'href',
            altSubPropName: undefined,
            altSubSubPropName: undefined,
        };

        // Only use the defaults if we were not passed in a valid options object.
        if (u.exists(inOpts.selector) && u.exists(inOpts.propName)) {
            ptns = inOpts;
        }

        if (!u.exists(ptns.loc)) {
            ptns.loc = BLANK_LOC;
        }

        // Grab whatever the selector told us to inside the root node
        var tagUrls = [];
        var tags = ptns.root.querySelectorAll(ptns.selector);

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
                var cleansedUrl = u.srcToUrl(src, ptns.loc);

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
    me.getAllCssBackgroundUrls = function getAllCssBackgroundUrls(root, loc) {
        if (!u.exists(root)) {
            console.log('[Scraper] No root node. Returning blank array.');
            return [];
        }

        var urlList = [];
        var nodes = root.querySelectorAll('*');

        // Look for all background-images.
        if (nodes.length > 0) {
            nodes.forEach(function getNodeCssBgUrl(node) {
                // Extract the style.backgroundImage, and take the 'url("' and '")' off of it.
                if (u.exists(node) && u.exists(node.style)) {
                    var bgVal = node.style.backgroundImage;

                    if (!u.exists(bgVal)) {
                        return;
                    }

                    var bgSrc = bgVal.replace(/^url\(/, '').replace(/\)$/, '').replace(/\'/g, '').replace(/\"/g, '');                

                    if (u.exists(bgSrc)) {
                        var cleansedUrl = u.srcToUrl(bgSrc, (loc || BLANK_LOC));
                        
                        // Add to the list if an OK url.
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
     * Amass the video urls within a given node.
     */
    me.getAllVideoUrls = function getAllVideoUrls(node, loc) {
        if (!u.exists(node)) {
            console.log('[Scraper] No root node. Returning blank array.');
            return [];
        }

        var urlList = [];

        // Query for video-src-holding elements. Currently no <object> or <embed> support.
        var videos = node.querySelectorAll('video, a[href], source');
        if (videos.length > 0) {
            videos.forEach(function getVideoCurrentSrc(vid) {
                var vidSrc = '';

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
                        var cleansedUrl = u.srcToUrl(vidSrc, (loc || BLANK_LOC));

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
    me.getAllJsUrls = function getAllJsUrls(node, loc, selector) {
        if (!u.exists(node)) {
            console.log('[Scraper] No root node. Returning blank array.');
            return [];
        }

        selector = (u.exists(selector) ? selector : DEFAULT_ALL_JS_SELECTOR);

        var urlList = [];

        // Look in all the on* attributes, and inside script tags by default. Can be overriden
        // by the user.
        var clickableTags = node.querySelectorAll(selector);
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
                var possibleMatches = js.match(/(\'|\").+?\.(jpg|png|gif|mp4|flv|wmv|webm|mov)\.[\?].+?(\'|\")/g) || [];

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
                                if (u.isAllowedImageFile(possibleHref)) {
                                    allowedHref = possibleHref;
                                }
                            }
                            if (!allowedHref && (me.options.audios === true)) {
                                if (u.isAllowedAudioFile(possibleHref)) {
                                    allowedHref = possibleHref;
                                }
                            }
                            if (!allowedHref && (me.options.videos === true)) {
                                if (u.isAllowedVideoFile(possibleHref)) {
                                    allowedHref = possibleHref;
                                }
                            }

                            var possibleUrl = u.srcToUrl(allowedHref, (loc || BLANK_LOC));
                            if (u.exists(possibleUrl)) {
                                urlList.push(possibleUrl);
                            }
                        }
                    }
                });
            }
        });

        return urlList;
    };


    /**
     * Get all the audio URLs in a given node.
     */
    me.getAllAudioUrls = function getAllAudioUrls(node, loc) {
        if (!u.exists(node)) {
            console.log('[Scraper] No root node. Returning blank array.');
            return [];
        }

        var audioUrls = me.getElementUrls({
            root: node,
            loc: loc,
            selector: 'audio[src],audio>source[src],param[value],a[href]',
            propName: 'currentSrc',
            altPropName: 'value',
        });

        var cleanAudioUrls = [];

        // Make URL objects for all the audio srcs, to get the pathing right.
        // pop out all the uris that have an unknown file extension.
        if (audioUrls.length > 0) {
            audioUrls.forEach(function pushAudioUrl(url) {
                if (u.isAllowedAudioFile(url.href)) {
                    cleanAudioUrls.push(url);
                }
            });
        }

        return cleanAudioUrls;
    };


    /**
     * Scrape a node for all the <img> uris in it.
     */
    me.getAllImgUrls = function getAllImgUrls(node, loc) {
        if (!u.exists(node)) {
            console.log('[Scraper] No root node. Returning blank array.');
            return [];
        }

        return me.getElementUrls({
            root: node,
            loc: loc,
            selector: 'img[src]',
            propName: 'src',
            altPropName: 'currentSrc',
        });    
    };


    /**
     * Scrape out any file paths and names seen in the querystring.
     */
    me.getAllQsUrls = function getAllQsUrls(d, l) {
        if (!u.exists(l) && !u.exists(d.location)) {
            console.log('[Scraper] No location. Returning blank array.');
            return [];
        }

        var loc = (l || d.location || BLANK_LOC);
        var urls = [];
        var qsVars = '';

        if (!!loc && !!loc.search) {
            qsVars = loc.search.split('&');        
        }
        else {
            return urls;
        }

        // Try to get any variables out of the qs that we can. 
        for (var i=0; i < qsVars.length; i++) {
            var pair = qsVars[i].split('=');
            var val = ((pair.length === 1) ? pair[0].substring(1) : pair[1]);
            
            // If it has a '.' and is of a known filetype, then push it into the 
            // uri list after URL-ifying it.
            if (val && (val.indexOf('.') !== -1) && u.isKnownFileType(val)) {
                var url = new URL(val, u.getBaseUri(loc));

                if (u.exists(url)) {
                    urls.push(url);
                }
            }
        }

        return urls;
    };


    /**
     * Scrape the node's <script> tags for any URIs.
     */
    me.scrapeAllJsUris = function scrapeAllJsUris(node, loc, selector) {
        return (
            me.getAllJsUrls(node, loc, selector).map(function returnUrisFromUrls(url) {
                return url.href;
            })
        );
    };


    /**
     * Scrape the node for all the <img> uris.
     */
    me.scrapeAllImgUris = function scrapeAllImgUris(node, loc) {
        return (
            me.getAllImgUrls(node, loc).map(function urisFromUrls(url) {
                return url.href;
            })
        );
    };


    /**
     * Scrape the node for anything with a css background-image.
     * extract the uri from the "url('uri')" before returning.
     */
    me.scrapeAllCssBgUris = function scrapeAllCssBgUris(node, loc) {
        return (
            me.getAllCssBackgroundUrls(node, loc).map(function urisFromUrls(url) {
                return url.href;
            })
        );
    };


    /**
     * Scrape the node for any type of video. <video>, <object>, <embed>.
     * Try to grab flvs as ya can.
     */
    me.scrapeAllVideoUris = function scrapeAllVideoUris(node, loc) {
        return (
            me.getAllVideoUrls(node, loc).map(function urisFromUrls(url) {
                return url.href;
            })
        );
    };


    /**
     * Scrape a querystring for anything that looks like a filename.
     */
    me.scrapeAllQsUris = function scrapeAllQsUris(node, loc) {
        return (
            me.getAllQsUrls(node, loc).map(function urisFromUrls(url) {
                return url.href;
            })
        );
    };


    /**
     * Scrape all <audio>,<source>,<param>s inside a node.
     */
    me.scrapeAllAudioUris = function scrapeAllAudioUris(node, loc) {
        return (
            me.getAllAudioUrls(node, loc).map(function urisFromUrls(url) {
                return url.href;
            })
        );
    };


    /**
     * Find all the image/movie media that is directly inside a node.
     */
    me.scrape = function scrape(config) {
        var opts = config.opts;
        var node = config.node;
        var loc = config.loc;

        var imgUris = [];
        var cssBgUris = [];
        var jsUris = [];
        var videoUris = [];
        var audioUris = [];
        var qsUris = [];

        console.log('[Scraper] options: ' + JSON.stringify(opts));

        if (opts.imgs) {
            imgUris = me.scrapeAllImgUris(node, loc);   
        }

        if (opts.cssBgs) {
            cssBgUris = me.scrapeAllCssBgUris(node, loc);
        }

        if (opts.js) {
            jsUris = me.scrapeAllJsUris(node, loc, null);
        }
        
        if (opts.videos) {
            videoUris = me.scrapeAllVideoUris(node, loc);
        }

        if (opts.audios) {
            audioUris = me.scrapeAllAudioUris(node, loc);
        }

        if (opts.qs && (!!loc || !!node.location)) {
            qsUris = me.scrapeAllQsUris(node, loc);
        }
        else {
            console.log('[Scraper] skipping qs scrape. No location information.')
        }

        console.log('[Scraper] Found imgUris: ' + JSON.stringify(imgUris));
        console.log('[Scraper] Found cssBgUris: ' + JSON.stringify(cssBgUris));
        console.log('[Scraper] Found jsUris: ' + JSON.stringify(jsUris));
        console.log('[Scraper] Found videoUris: ' + JSON.stringify(videoUris));
        console.log('[Scraper] Found audioUris: ' + JSON.stringify(audioUris));
        console.log('[Scraper] Found qsUris: ' + JSON.stringify(qsUris));

        // Turn it into a silly map with the same values as keys. 
        var harvestedUris = []
            .concat(imgUris)
            .concat(cssBgUris)
            .concat(jsUris)
            .concat(videoUris)
            .concat(audioUris)
            .concat(qsUris);

        var harvestedUriMap = harvestedUris.reduce(
            function(harvestedMap, uri) {
                harvestedMap[uri] = uri;
                return harvestedMap;
            }, 
            {}
        );

        return Promise.resolve(harvestedUriMap);
    };


    // return the singleton
    return me;
})(Utils);