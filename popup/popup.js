import { default as Digger } from '../background/Digger.js';
import { default as Output } from '../background/Output.js';
import { default as EventPage } from '../background/EventPage.js';

class Popup {
    constructor() {
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
                            var out = bgWindow.output;
                            out.setDoc(document);

                            if (out.appIsScraping || out.appIsDigging) {
                                var descriptionOfWork = out.appIsScraping ? 'scraping...' : 'digging...';
                                out.toOut('Currently ' + descriptionOfWork);
                                out.restoreFileList();
                                return;
                            }
                            
                            if (length) {
                                console.log("[Popup] Got persisted uris:");
                                console.log(JSON.stringify(uriMap));

                                console.log('[Popup] Got checked uris: ');
                                console.log(JSON.stringify(out.checkedFileOptUris));

                                out.showActionButtons();

                                var dir = bgWindow.Utils.getSaltedDirectoryName();
                        
                                out.clearFilesDug();
                                bgWindow.Utils.resetDownloader();

                                var checkedItemCount = 0;
                                var idx = length - 1;

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
                                        if (out.checkedFileOptUris.indexOf(cb.value) !== -1) {
                                            checkedItemCount++;   
                                            cb.dataset.filePath = '';
                                            cb.checked = true;
                                            cb.disabled = true;
                                        }
                                    }
                                }

                                chrome.browserAction.setBadgeText({ text: '' + (length - checkedItemCount) + '' });
                                chrome.browserAction.setBadgeBackgroundColor({ color: [247, 81, 158, 255] });

                                if (checkedItemCount > 0) {
                                    out.toOut('Please select which of the ' + (length - checkedItemCount) + ' remaining files you wish to download.');
                                }
                                else {
                                    out.toOut('Please select which of the total ' + length + ' files you wish to download.');
                                }
                            }
                            else {
                                chrome.browserAction.setBadgeText({ text: '' });
                                out.showDigScrapeButtons();
                                out.toOut('hit a button to begin.');
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
                            enableHalfBakedFeatures: '0',
                        },
                        messages: [],
                        processings: [],
                        blessings: [],
                    }
                }, 
                function storageRetrieved(store) {
                    chrome.runtime.getBackgroundPage(function setSpec(bgWindow) {
                        bgWindow.digger.setBatchSize(store.spec.config.dlBatchSize);
                        bgWindow.digger.setChannels(store.spec.config.dlChannels);

                        bgWindow.logicker.setMinZoomHeight(store.spec.config.minZoomHeight);
                        bgWindow.logicker.setMinZoomWidth(store.spec.config.minZoomWidth);
                        bgWindow.logicker.setKnownBadImgRegex(store.spec.config.knownBadImgRegex);

                        bgWindow.logicker.setMessages(store.spec.messages);
                        bgWindow.logicker.setProcessings(store.spec.processings);
                        bgWindow.logicker.setBlessings(store.spec.blessings);

                        bgWindow.output.setEnableHalfBakedFeatures(
                            (store.spec.config.enableHalfBakedFeatures === '-1')
                        );
                    });

                    if (store.spec.config.enableHalfBakedFeatures === '-1') {
                        var bcs = document.getElementsByClassName('buttonColumn');
                        for (var b = 0; b < bcs.length; b++) {
                            bcs[b].style.display = 'inline-block';
                        }
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
                        bgWindow.eventPage.goDigFileOptions(window.document);
                    });
                });


                /**
                 * Scrape and dig a page that contains links to multiple galleries. Don't automatically download. 
                 * Present the user with checkbox options as to what files to download.
                 */
                document.getElementById('digGalleryGallery').addEventListener('click', function onDigGalleryGallery() {
                    chrome.runtime.getBackgroundPage(function doGalleryGalleryDigging(bgWindow) {
                        bgWindow.eventPage.goDigGalleryGallery(window.document);
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
                        
                        var out = bgWindow.output;
                        out.setDoc(document);           
                        out.clearFilesDug();
                        out.resetFileData();
                        out.showDigScrapeButtons();

                        out.toOut('Hit a button to begin.');
                    });
                });


                /**
                 * Scrape for all known types of media on a page.
                 */
                document.getElementById('scrapeFileOptionsButton').addEventListener('click', function onDigFileOptions() {
                    chrome.runtime.getBackgroundPage(function doScrapingForOptions(bgWindow) {
                        bgWindow.eventPage.goScrapeFileOptions(window.document);
                    });
                });


                /**
                 * Scrape a page, picking up all the included images.
                 */
                document.getElementById("scrapeImagesButton").addEventListener("click", function onDigButton() {
                    chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
                        bgWindow.eventPage.goScrapeImages(window.document);
                    });
                });


                /**
                 * Scrape a page, picking up all the included videos.
                 */
                document.getElementById("scrapeVideosButton").addEventListener("click", function onDigButton() {
                    chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
                        bgWindow.eventPage.goScrapeVideos(window.document);
                    });
                });


                /**
                 * A big one, scrape a page for *any* media.
                 */
                document.getElementById("scrapeButton").addEventListener("click", function onDigButton() {
                    chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
                        bgWindow.eventPage.goScrape(window.document);
                    });
                });


                /**
                 * Dig an image gallery.
                 */
                document.getElementById("digImageGalleryButton").addEventListener("click", function onDigButton() {
                    chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
                        bgWindow.eventPage.goDigImageGallery(window.document);
                    });
                });


                /**
                 * Dig a video gallery.
                 */
                document.getElementById("digVideoGalleryButton").addEventListener("click", function onDigButton() {
                    chrome.runtime.getBackgroundPage(function doVideoGalleryDig(bgWindow) {
                        bgWindow.eventPage.goDigVideoGallery(window.document);
                    });
                });


                /**
                 * The big one, digging *everything* that could be from a gallery.
                 */
                document.getElementById("digButton").addEventListener("click", function onDigButton() {
                    chrome.runtime.getBackgroundPage(function doDigging(bgWindow) {
                        bgWindow.eventPage.goDig(window.document);
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
    }
}

window.popup = new Popup();

export default Popup;
