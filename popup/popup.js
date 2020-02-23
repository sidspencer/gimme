'use strict';


/**
 * Set up event handlers for the UI. All actual work is done in the background scripts.
 */
document.addEventListener("DOMContentLoaded", function init() {
    setFileOptionList();
    readSpec();
    connectEventHandlers();    
    

    /**
     * If there are still un-downloaded things from last time, show them. 
     * Note: clicking one of the "download all [ |jpgs]" button will clear them.
     */
    function setFileOptionList() {
        chrome.storage.local.get({
                prevUriMap: {}
            }, 
            function storageRetrieved(store) {
                var uriMap = store.prevUriMap;

                // If there were non-downloaded files from last time, show that list.
                var length = Object.values(uriMap).length;
                chrome.runtime.getBackgroundPage(function doDiggingForOptions(bgWindow) {
                    var out = bgWindow.outputController;

                    if (!!out) {
                        console.log('set the document on the OUtput');
                        out.setDoc(document);
                        
                        if (Array.isArray(document.checkedFileOptUris)) {
                            console.log('got checkedFileOptUris: ' + JSON.stringify(document.checkedFileOptUris));
                        }
                    }

                    if (!!out && (out.appIsDigging || out.appIsScraping)) { 
                        if (out.appIsScraping) {
                            chrome.browserAction.setBadgeText({ text: '' });
                            out.toOut('Currently scraping...');
                            out.restoreFileList();
                            return;
                        }
                        else if (out.appIsDigging) {
                            chrome.browserAction.setBadgeText({ text: '' });
                            out.toOut('Currently digging...');
                            out.restoreFileList();
                            return;
                        }
                    }
                    
                    if (length) {
                        console.log("[Popup] Got persisted uris:");
                        console.log(JSON.stringify(uriMap));
                        var cbUris = document.checkedFileOptUris;

                        if (!out) {
                            out = new bgWindow.Output(window.document);
                            out.checkedFileOptUris = cbUris;
                        }

                        var dir = bgWindow.Utils.getSaltedDirectoryName();
                
                        out.clearFilesDug();
                        bgWindow.Utils.resetDownloader();

                        var idx = 0;
                        for (var thumbUri in uriMap) { 
                            var uri = uriMap[thumbUri];
                            var queryPos = uri.lastIndexOf('?');

                            if (queryPos === -1) {
                                queryPos = uri.length;
                            }

                            var filePath = dir + '/' + uri.substring(uri.lastIndexOf('/') + 1, queryPos)
                            var optId = (idx++);

                            out.addFileOption({ 
                                id: optId + '', 
                                uri: uri, 
                                thumbUri: thumbUri,
                                filePath: filePath,
                                onSelect: bgWindow.Utils.downloadFile, 
                            });

                            var cb = document.getElementById('cbFile' + optId);
                            if (!!cb) {
                                if (Array.isArray(cbUris) && cbUris.indexOf(cb.value) !== -1) {   
                                    console.log('checkbox was previously checked!');                             
                                    cb.dataset.filePath = '';
                                    cb.disabled = true;
                                    cb.checked = true;
                                }
                            }
                        }

                        out.hideDigScrapeButtons();
                        out.toOut('Please select which of the ' + length + ' files you wish to download.');
                        out.showActionButtons();
                        chrome.browserAction.setBadgeText({ text: '' + idx + '' });
                        chrome.browserAction.setBadgeBackgroundColor({ color: [247, 81, 158, 255] });

                    }
                    else {
                        chrome.browserAction.setBadgeText({ text: '' });
                    }
                });
            }
        );
    }


    /**
     * Clear the persisted URI map from storage.
     */
    function clearPreviousUriMap() {
        chrome.browserAction.setBadgeText({ text: '' });
        chrome.storage.local.set({
                prevUriMap: {},
            },
            function storageSet() {
                console.log('[Popup] Cleared prev uri map');
            }
        );
    }


    /**
     Read storage for the spec json.
     */
    function readSpec() {
        chrome.storage.sync.get({
            spec: {
                config: {
                    minZoomWidth: '300',
                    minZoomHeight: '300',
                    dlChannels: '3',
                    dlBatchSize: '5',
                },
                messages: [],
                processings: [],
                blessings: [],
            }
        }, 
        function storageRetrieved(store) {
            chrome.runtime.getBackgroundPage(function setSpec(bgWindow) {
                bgWindow.Digger.BATCH_SIZE = store.spec.config.dlBatchSize;
                bgWindow.Digger.CHANNELS = store.spec.config.dlChannels;

                bgWindow.Logicker.MIN_ZOOM_HEIGHT = store.spec.config.minZoomHeight;
                bgWindow.Logicker.MIN_ZOOM_WIDTH = store.spec.config.minZoomWidth;

                bgWindow.Logicker.messages = [].concat(store.spec.messages);
                bgWindow.Logicker.processings = [].concat(store.spec.processings);
                bgWindow.Logicker.blessings = [].concat(store.spec.blessings);

                console.log("Logicker:");
                console.log(bgWindow.Logicker);

                console.log("Digger:");
                console.log(bgWindow.Digger);
            });
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
         * Scrape and dig a page that contains links to multiple galleries. Don't automatically download. 
         * Present the user with checkbox options as to what files to download.
         */
        document.getElementById('digGalleryGallery').addEventListener('click', function onDigGalleryGallery() {
            chrome.runtime.getBackgroundPage(function doGalleryGalleryDigging(bgWindow) {
                bgWindow.goDigGalleryGallery(window.document);
            });
        });


        /**
         * This button is in the "action buttons" group. They act upon the list of file download options. This
         * fires all the checkboxes' click events, causing them all the download.
         * Note: Also clears the previouslyHarvestedUriMap.
         */
        document.getElementById('getAllFileOptsButton').addEventListener('click', function getAllFileOpts() {
            document.querySelectorAll('input[type="checkbox"]').forEach(function initiateDownload(cbEl) {
                var evt = new MouseEvent('click');
                cbEl.dispatchEvent(evt);
            });
        });


        /**
         * This button is in the "action buttons" group. They act upon the list of file download options. This
         * fires the checkboxes' click events for all jpg files only.
         * Note: Also clears the previouslyHarvestedUriMap.
         */
        document.getElementById('getAllJpgOptsButton').addEventListener('click', function getAllJpgOpts() {
            document.querySelectorAll('input[type="checkbox"]').forEach(function initiateJpgDownload(cbEl) {
                if (cbEl.dataset.filePath.match(new RegExp(/\.(jpg|jpeg)$/, 'i'))) {
                    var evt = new MouseEvent('click');
                    cbEl.dispatchEvent(evt);
                }
            });
        });


        /**
         * This button is in the "action buttons" group. It clears the download list, clears the 
         * previouslyHarvestedUriMap, shows the scrape/dig buttons, and hides the "action buttons".
         */
        document.getElementById('clearFileListButton').addEventListener('click', function clearFileList() {
            chrome.runtime.getBackgroundPage(function clearTheFileList(bgWindow) {
                clearPreviousUriMap();
                
                var out = (
                    bgWindow.outputController ? bgWindow.outputController : bgWindow.Output(window.document)
                );                
                out.clearFilesDug();
                out.showDigScrapeButtons();
                out.toOut('Hit a button to begin.');
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


        /**
         * Toggle the Voyeur.
         */
        document.getElementById("toggleVoyeur").addEventListener("click", function onToggleVoyeurButton() {
            chrome.runtime.getBackgroundPage(function toggleVoyeur(bgWindow) {
                if (bgWindow.Voyeur.isWatching) {
                    bgWindow.Voyeur.stop();
                }
                else {
                    bgWindow.Voyeur.start();
                }
            });
        });
    }
});
