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
                var uriMap = store.prevUriMap

                // If we're still in the digging/scraping stages, restore the textual file-list.
                // If we're in the file option download stage, show the list of file option checkboxes instead.
                var length = Object.values(uriMap).length;
                chrome.runtime.getBackgroundPage(function doDiggingForOptions(bgWindow) {
                    var out = bgWindow.outputController;

                    if (!!out) {
                        out.setDoc(document);
                        
                        if (Array.isArray(document.checkedFileOptUris)) {
                            console.log('got checkedFileOptUris: ' + JSON.stringify(document.checkedFileOptUris));
                        }

                        if (out.appIsScraping || out.appIsDigging) {
                            var descriptionOfWork = out.appIsScraping ? 'scraping...' : 'digging...';
                            out.toOut('Currently ' + descriptionOfWork);
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
                        out.hideDigScrapeButtons();
                        out.showActionButtons();

                        var dir = bgWindow.Utils.getSaltedDirectoryName();
                
                        out.clearFilesDug();
                        bgWindow.Utils.resetDownloader();

                        var uriMapLength = Object.keys(uriMap).length;
                        var alreadyCheckedItemsLength = (
                            Array.isArray(document.checkedFileOptUris) ? document.checkedFileOptUris.length : 0
                        );

                        var idx = uriMapLength - 1;

                        for (var thumbUri in uriMap) { 
                            var uri = uriMap[thumbUri];
                            var queryPos = uri.lastIndexOf('?');

                            if (queryPos === -1) {
                                queryPos = uri.length;
                            }

                            var filePath = dir + '/' + uri.substring(uri.lastIndexOf('/') + 1, queryPos)
                            var optId = (idx--);

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

                        chrome.browserAction.setBadgeText({ text: '' + (uriMapLength - alreadyCheckedItemsLength) + '' });
                        chrome.browserAction.setBadgeBackgroundColor({ color: [247, 81, 158, 255] });

                        if (!!cbUris && cbUris.length > 0) {
                            out.toOut('Please select which of the ' + (uriMapLength - alreadyCheckedItemsLength) + ' remaining files you wish to download.');
                        }
                        else {
                            out.toOut('Please select which of the total ' + uriMapLength + ' files you wish to download.');
                        }
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
                    dlChannels: '11',
                    dlBatchSize: '3',
                    knownBadImgRegex: '/\\/(logo\\.|loading|header\\.jpg|premium_|preview\\.png|holder-trailer-home\\.jpg|logo-mobile-w\\.svg|logo\\.svg|logo-desktop-w\\.svg|user\\.svg|speech\\.svg|folder\\.svg|layers\\.svg|tag\\.svg|video\\.svg|favorites\\.svg|spinner\\.svg|preview\\.jpg)/i',
                },
                messages: [],
                processings: [],
                blessings: [],
            }
        }, 
        function storageRetrieved(store) {
            chrome.runtime.getBackgroundPage(function setSpec(bgWindow) {
                bgWindow.Digger.prototype.setBatchSize(store.spec.config.dlBatchSize);
                bgWindow.Digger.prototype.setChannels(store.spec.config.dlChannels);

                bgWindow.Logicker.setMinZoomHeight(store.spec.config.minZoomHeight);
                bgWindow.Logicker.setMinZoomWidth(store.spec.config.minZoomWidth);
                bgWindow.Logicker.setKnownBadImgRegex(store.spec.config.knownBadImgRegex);

                bgWindow.Logicker.setMessages(store.spec.messages);
                bgWindow.Logicker.setProcessings(store.spec.processings);
                bgWindow.Logicker.setBlessings(store.spec.blessings);

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
                document.checkedFileOptUris = [];
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
