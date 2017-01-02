'use strict';

/**
 * Set up event handlers for the UI. All actual work is done in the background scripts.
 */
document.addEventListener("DOMContentLoaded", function init() {
    
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
