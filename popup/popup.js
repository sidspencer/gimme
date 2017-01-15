'use strict';

/**
 * Set up event handlers for the UI. All actual work is done in the background scripts.
 */
document.addEventListener("DOMContentLoaded", function init() {
    /**
     * Scrape and dig, but don't automatically download. Instead, present the user with checkbox options
     * as to what files to download.
     */
    document.getElementById('digFileOptionsButton').addEventListener('click', function onDigFileOptions() {
        chrome.runtime.getBackgroundPage(function doDiggingForOptions(bgWindow) {
            bgWindow.goDigFileOptions(window.document);
        });
    });


    /**
     * This button is in the "action buttons" group. They act upon the list of file download options. This
     * fires all the checkboxes' click events, causing them all the download.
     */
    document.getElementById('getAllFileOptsButton').addEventListener('click', function onDigFileOptions() {
        document.querySelectorAll('input[type="checkbox"]').forEach(function makeDescriptors(cbEl) {
           var evt = new MouseEvent('click');
           cbEl.dispatchEvent(evt);
        });
    });


    /**
     * 
     */
    document.getElementById('scrapeFileOptionsButton').addEventListener('click', function onDigFileOptions() {
        chrome.runtime.getBackgroundPage(function doScrapingForOptions(bgWindow) {
            bgWindow.goScrapeFileOptions(window.document);
        });
    });

    /**
     * Scrape a page, picking up all the included images.
     */
    document.getElementById("scrapeImagesButton").addEventListener("click", function onDigButton() {
        chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
            bgWindow.goScrapeImages(window.document);
        });
    });


    /**
     * Scrape a page, picking up all the included images.
     */
    document.getElementById("scrapeVideosButton").addEventListener("click", function onDigButton() {
        chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
            bgWindow.goScrapeVideos(window.document);
        });
    });


    /**
     * Scrape a page, picking up all the included images.
     */
    document.getElementById("scrapeButton").addEventListener("click", function onDigButton() {
        chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
            bgWindow.goScrape(window.document);
        });
    });


    /**
     * Dig an image gallery.
     */
    document.getElementById("digImageGalleryButton").addEventListener("click", function onDigButton() {
        chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
            bgWindow.goDigImageGallery(window.document);
        });
    });


    /**
     * Dig a video gallery.
     */
    document.getElementById("digVideoGalleryButton").addEventListener("click", function onDigButton() {
        chrome.runtime.getBackgroundPage(function doVideoGalleryDig(bgWindow) {
            bgWindow.goDigVideoGallery(window.document);
        });
    });


   /**
     * The big one, digging everything that could be from a gallery.
     */
    document.getElementById("digButton").addEventListener("click", function onDigButton() {
        chrome.runtime.getBackgroundPage(function doDigging(bgWindow) {
            bgWindow.goDig(window.document);
        });
    });


});
