'use strict'


/**
 * Fire up the app, dig for all known media in the parameters that we can scrape outta that mutha. 
 *  - Image galleries (Thumb, Zoom)
 *  - CSS background-images
 *  - mucks through javascript (musta been green programmers)
 */
function goDig(parentDocument) {
    var options = {
        imgs: true,
        cssBgs: true,
        videos: true,
        js: true,
    };

    var output = Output(parentDocument);
    var digger = Digger(output, Logicker, Utils, options);
    var app = App(output, digger, Logicker, Utils);

    app.digGallery();
}


/**
 * Fire up the app, dig only for image galleries.
 * This includes css Background Images for bastards like FB.
 */
function goDigImageGallery(parentDocument) {
    var options = {
        imgs: true,
        cssBgs: true,
        videos: false,
        js: true,
    };

    var output = Output(parentDocument);
    var digger = Digger(output, Logicker, Utils, options);
    var app = App(output, digger, Logicker, Utils);

    app.digGallery();
}


/**
 * Fire up the app, dig only for video galleries.
 */
function goDigVideoGallery(parentDocument) {
    var options = {
        imgs: false,
        cssBgs: false,
        videos: true,
        js: true,
    };

    var output = Output(parentDocument);
    var digger = Digger(output, Logicker, Utils, options);
    var app = App(output, digger, Logicker, Utils);

    app.digGallery();
}


/**
 * Scrape the current page for all included <img>s, style.background-images, 
 * videos, and any urls inside of the <script> tags.
 */
function goScrape(parentDocument) {
    var options = {
        imgs: true,
        cssBgs: true,
        videos: true,
        js: true
    };

    var output = Output(parentDocument);
    var digger = Digger(output, Logicker, Utils, options);
    var app = App(output, digger, Logicker, Utils);

    app.scrape();
}


/**
 * Scrape the current page for <img>s.
 */
function goScrapeImages(parentDocument) {
    var options = {
        imgs: true,
        cssBgs: true,
        videos: false,
        js: true
    };

    var output = Output(parentDocument);
    var digger = Digger(output, Logicker, Utils, options);
    var app = App(output, digger, Logicker, Utils);

    app.scrape();
}


/**
 * Scrape the current page for <video>s.
 */
function goScrapeVideos(parentDocument) {
    var options = {
        imgs: false,
        cssBgs: false,
        videos: true,
        js: true
    };

    var output = Output(parentDocument);
    var digger = Digger(output, Logicker, Utils, options);
    var app = App(output, digger, Logicker, Utils);

    app.scrape();
}