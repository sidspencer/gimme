'use strict'


//
// Digging
//

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
    var digger = Digger(Scraper, output, Logicker, Utils, options);
    var app = App(output, digger, Scraper, Logicker, Utils);

    app.digGallery();
}


/**
 * Fire up the app, dig for all known media in the parameters that we can scrape outta that mutha. 
 *  - Image galleries (Thumb, Zoom)
 *  - CSS background-images
 *  - mucks through javascript (musta been green programmers)
 */
function goDigFileOptions(parentDocument) {
    var options = {
        imgs: true,
        cssBgs: true,
        videos: true,
        js: true,
    };

    var output = Output(parentDocument);
    var digger = Digger(Scraper, output, Logicker, Utils, options);
    var app = App(output, digger, Scraper, Logicker, Utils);

    app.digFileOptions();
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
    var digger = Digger(Scraper, output, Logicker, Utils, options);
    var app = App(output, digger, Scraper, Logicker, Utils);

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
    var digger = Digger(Scraper, output, Logicker, Utils, options);
    var app = App(output, digger, Scraper, Logicker, Utils);

    app.digGallery();
}


/**
 * Go dig multiple galleries from a page of gallery of galleries.
 */
function goDigGalleryGallery(parentDocument) {
    var options = {
        imgs: true,
        cssBgs: true,
        videos: true,
        js: true,
    };

    var output = Output(parentDocument);
    var digger = Digger(Scraper, output, Logicker, Utils, options);
    var app = App(output, digger, Scraper, Logicker, Utils);

    app.digGalleryGallery();
}





//
// Scraping
//

/**
 * Scrape the current page for all included <img>s, style.background-images, 
 * videos, audios, any urls inside of the <script> tags, and any urls in the 
 * query-string. Then JUST START DOWNLOADING THEM.
 */
function goScrape(parentDocument) {
    var options = {
        imgs: true,
        cssBgs: true,
        videos: true,
        audios: true,
        js: true,
        qs: true,
    };

    var output = Output(parentDocument);
    var digger = {};
    var app = App(output, digger, Scraper, Logicker, Utils);

    app.scrape(options);
}


/**
 * Scrape the current page for all included <img>s, style.background-images, 
 * videos, any urls inside of the <script> tags, and any urls in the 
 * query-string. Then present options for the user to choose to download or not.
 */
function goScrapeFileOptions(parentDocument) {
    var options = {
        imgs: true,
        cssBgs: true,
        videos: true,
        audios: true,
        js: true,
        qs: true,
    };

    var output = Output(parentDocument);
    var digger = {};
    var app = App(output, digger, Scraper, Logicker, Utils);

    app.scrapeFileOptions(options);
}


/**
 * Scrape the current page for <img>s.
 */
function goScrapeImages(parentDocument) {
    var options = {
        imgs: true,
        cssBgs: true,
        videos: false,
        audios: false,
        js: true,
        qs: true,
    };

    var output = Output(parentDocument);
    var digger = {};    
    var app = App(output, digger, Scraper, Logicker, Utils);

    app.scrape(options);
}


/**
 * Scrape the current page for <video>s.
 */
function goScrapeVideos(parentDocument) {
    var options = {
        imgs: false,
        cssBgs: false,
        videos: true,
        audios: false,
        js: true,
        qs: true,
    };

    var output = Output(parentDocument);
    var digger = {};
    var app = App(output, digger, Scraper, Logicker, Utils);

    app.scrape(options);
}