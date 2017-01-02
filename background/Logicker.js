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
    }





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