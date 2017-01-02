'use strict'

var Logicker = (function Logicker(Utils) {
    var me = {
    
    };
    var u = Utils;


    /**
     * Find the right uri for the zoomImage.
     * (this applies the scraped rules I view-sourced to see.)
     */
    me.findBlessedZoomUri = function findBlessedZoomUri(doc, thumbUri) {
        var zoomImgUri = '';

        // TODO: put stuff here.

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
            .substring(0, thumbUrl.lastIndexOf('.'));
        var zname = zoomUrl.pathname.replace(/\/$/, '')
            .substring(zoomUrl.pathname.lastIndexOf('/') + 1)
            .substring(0, zoomUrl.lastIndexOf('.'));
        
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
     * This is where the knowledge-magic comes in. By inspecting a number of sites' galleries,
     * I have found easy selector/prop pairs to get the URIs by. 
     */
    me.getMessageDescriptorForUrl = function getMessageDescriptorForUrl(url) {
        var d = {
            selector: 'a[href]',
            linkHrefProp: 'href',
            thumbSrcProp: 'firstElementChild.src',
        };

        // Force popup-side dom processing.
        if (!url || !url.match) {
            d = {};
            return d;
        }

        // Change d to be all the
        // special rules for the site.
        if (/facebook\.com\//.test(url)) {
            d.selector = '.uiMediaThumbImg';
            d.linkHrefProp = 'style.backgroundImage';
            d.thumbSrcProp = 'firstElementChild.src'
        }
        else {
            d = {
                selector: 'a[href]',
                linkHrefProp: 'href',
                thumbSrcProp: 'querySelector("img[src]").src'
            };
        }

        return d;
    };


  /**
     * For any processing that should be done before calling the Digger.
     * Often, you can munge your thumbSrc and linkHref values into place 
     * enough that you can just call the downloader. 
     */
    me.postProcessResponseData = function postProcessResponseData(thumbUris, pageUri) {
        var instructions = {
            doScrape: true,
            doDig: true,
            zoomLinkUris: [],
        };

        var url = pageUri;
        var thumbUri0 = thumbUris[0];

        if (!u.exists(url)) {
            url = '';
        }
        if (!u.exists(thumbUri0)) {
            thumbUri0 = '';
        }

        console.log('[PostProcess] url: ' + url + ', thumb0: ' + thumbUri0);

        // Facebook. Sigh.
        if (/facebook\.com\//.test(url)) {
            instructions.zoomLinkUris.forEach(function extractUriFromCss(href, idx, hrefs) {
                href = href.replace(/^url\(('|")?/, '')
                           .replace(/('|")?\)$/, '');

                hrefs[idx] = href;
            });

            instructions.doScrape = false;
            instructions.doDig = true;
        }

        console.log('[PostProcess] thumbUris: ' + JSON.stringify(thumbUris));
        console.log('[PostProcess] zoomLinkUris: ' + JSON.stringify(instructions.zoomLinkUris));

        return instructions;
    };







    return me;
}(Utils));