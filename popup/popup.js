'use strict';

/**
 * Set up event handlers for the UI. All actual work is done in the background scripts.
 */
document.addEventListener("DOMContentLoaded", function init() {
    connectEventHandlers();    
    setFileOptionList();
    

    /**
     * If there are still un-downloaded things from last time, show them. 
     * Note: clicking one of the "download all [ |jpgs]" button will clear them.
     */
    function setFileOptionList() {
        chrome.runtime.getBackgroundPage(function doDiggingForOptions(bgWindow) {            
            var uriMap = bgWindow.Digger.previouslyHarvestedUriMap || {};

            // If there were non-downloaded files from last time, show that list.
            var length = Object.values(uriMap).length;
            if (length) {
                console.log("[Popup] Got persisted uris:")
                console.log(JSON.stringify(uriMap));

                var out = new bgWindow.Output(window.document);
                var dir = bgWindow.App.getSaltedDirectoryName();

                var idx = 0;
                for (var thumbUri in uriMap) { 
                    var uri = uriMap[thumbUri];
                                  
                    out.addFileOption({ 
                        id: idx, 
                        uri: uri, 
                        thumbUri: thumbUri,
                        filePath: dir + '/' + uri.substring(uri.lastIndexOf('/')),
                        onSelect: bgWindow.App.downloadFile, 
                    });
                }

                out.hideDigScrapeButtons();
                out.showActionButtons();
            }
        });
    }


    /**
     * Connect up all the event handlers.
     */
    function connectEventHandlers () {
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
         * Note: Also clears the persistentDugUris.
         */
        document.getElementById('getAllFileOptsButton').addEventListener('click', function getAllFileOpts() {
            document.querySelectorAll('input[type="checkbox"]').forEach(function initiateDownload(cbEl) {
                var evt = new MouseEvent('click');
                cbEl.dispatchEvent(evt);
            });

            chrome.runtime.getBackgroundPage(function clearPersistentDugUris(bgWindow) {
                bgWindow.Digger.persistentDugUris = [];                
            });
        });


        /**
         * This button is in the "action buttons" group. They act upon the list of file download options. This
         * fires the checkboxes' click events for all jpg files only.
         * Note: Also clears the persistentDugUris.
         */
        document.getElementById('getAllJpgOptsButton').addEventListener('click', function getAllJpgOpts() {
            document.querySelectorAll('input[type="checkbox"]').forEach(function initiateJpgDownload(cbEl) {
                if (cbEl.dataset.filePath.match(new RegExp(/\.(jpg|jpeg)$/, 'i'))) {
                    var evt = new MouseEvent('click');
                    cbEl.dispatchEvent(evt);
                }

                chrome.runtime.getBackgroundPage(function clearPersistentDugUris(bgWindow) {
                    bgWindow.Digger.persistentDugUris = [];                
                });
            });
        });


        /**
         * This button is in the "action buttons" group. It clears the download list, clears the 
         * persistentDownloadUris, shows the scrape/dig buttons, and hides the "action buttons".
         */
        document.getElementById('clearFileListButton').addEventListener('click', function clearFileList() {
            chrome.runtime.getBackgroundPage(function clearTheFileList(bgWindow) {
                bgWindow.Digger.persistentDugUris = [];
                
                var out = new bgWindow.Output(window.document);
                out.clearFilesDug();
                out.showDigScrapeButtons();
            });
        });


        /**
         * Scrape for all known types of media on a page.
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
         * Scrape a page, picking up all the included videos.
         */
        document.getElementById("scrapeVideosButton").addEventListener("click", function onDigButton() {
            chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
                bgWindow.goScrapeVideos(window.document);
            });
        });


        /**
         * A big one, scrape a page for *any* media.
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
         * The big one, digging *everything* that could be from a gallery.
         */
        document.getElementById("digButton").addEventListener("click", function onDigButton() {
            chrome.runtime.getBackgroundPage(function doDigging(bgWindow) {
                bgWindow.goDig(window.document);
            });
        });
    }
});
