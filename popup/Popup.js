import { default as Digger } from '../background/Digger.js';
import { default as Output } from '../background/Output.js';
import { default as EventPage } from '../background/EventPage.js';
import { default as Optionator } from '../options/Optionator.js';
import { default as GCon } from '../lib/GCon.js';
import {
    Storing, 
    FileOption,
} from '../lib/DataClasses.js';


/**
 * Controller for the popup window UI.
 */
class Popup {
    constructor() {
        /**
         * Set up event handlers for the UI. All actual work is done in the background scripts.
         */
        document.addEventListener("DOMContentLoaded", () => {
            setFileOptionList();
            readSpec();
            connectEventHandlers();    
            

            /**
             * If there are still un-downloaded things from last time, show them. 
             * Note: clicking one of the "download all [ |jpgs]" button will clear them.
             */
            function setFileOptionList() {
                chrome.storage.local.get(
                    Storing.storePrevUriMap({}), 
                    (store) => {
                        var uriMap = store.prevUriMap
                        
                        // If we're still in the digging/scraping stages, restore the textual file-list.
                        // If we're in the file option download stage, show the list of file option checkboxes instead.
                        var length = Object.values(uriMap).length;
                        chrome.runtime.getBackgroundPage((bgWindow) => {
                            // Get the Output common instance and the Static Utils obj, and set our popup document on the Output.
                            var out = bgWindow[GCon.WIN_PROP.OUTPUT_INST];
                            var ut = bgWindow[GCon.WIN_PROP.UTILS_ST];
                            out.setDoc(document);

                            // If it's still doing a dig/scrape, just say so and return.
                            if (out.appIsScraping || out.appIsDigging) {
                                var descriptionOfWork = out.appIsScraping ? 'scraping...' : 'digging...';
                                out.toOut('Currently ' + descriptionOfWork);
                                out.restoreFileList();
                                return;
                            }
                            
                            // Otherwise, if there is a previousUriMap, make the file options.
                            if (length) {
                                console.log("[Popup] Got persisted uris:");
                                console.log(JSON.stringify(uriMap));

                                console.log('[Popup] Got checked uris: ');
                                console.log(JSON.stringify(out.checkedFileOptUris));

                                out.showActionButtons();
                                var dir = ut.getSaltedDirectoryName();
                        
                                out.clearFilesDug();
                                ut.resetDownloader();

                                var checkedItemCount = 0;
                                var idx = length - 1;

                                // Make a file option and hook up the event handlers for all in the prevUriMap.
                                for (var thumbUri in uriMap) { 
                                    var uri = uriMap[thumbUri];

                                    if (!uri || !uri.replace || uri.indexOf('.') === 0) {
                                        console.log('[Popup] Bad uri string for download: ' + JSON.stringify(uri));
                                        continue;
                                    }

                                    var queryPos = uri.lastIndexOf('?');

                                    if (queryPos === -1) {
                                        queryPos = uri.length;
                                    }

                                    var filePath = dir + '/' + uri.substring(uri.lastIndexOf('/') + 1, queryPos)
                                    var optId = (idx--);

                                    out.addFileOption(new FileOption(optId+'', uri, thumbUri, filePath, ut.downloadFile));
                                    
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

                                // Set the badge text and background color.
                                chrome.browserAction.setBadgeText({ text: '' + (length - checkedItemCount) + '' });
                                chrome.browserAction.setBadgeBackgroundColor(GCon.B_COLOR.AVAILABLE_FOPTS);

                                if (checkedItemCount > 0) {
                                    out.toOut('Please select which of the ' + (length - checkedItemCount) + ' remaining files you wish to download.');
                                }
                                else {
                                    out.toOut('Please select which of the total ' + length + ' files you wish to download.');
                                }
                            }
                            else {
                                // If there are no previous uri entries, set us up normally.
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
                chrome.storage.local.set(
                    Storing.storePrevUriMap({}),
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
                        config: GCon.OPT_CONF.CANNED_CONFIG,
                        messages: [],
                        processings: [],
                        blessings: [],
                    }
                }, 
                function storageRetrieved(store) {
                    // Set the options on the background-page objects and classes.
                    chrome.runtime.getBackgroundPage(function setSpec(bgWindow) {
                        var d = bgWindow[GCon.WIN_PROP.DIGGER_CLASS];
                        var l = bgWindow[GCon.WIN_PROP.LOGICKER_ST];
                        var o = window[GCon.WIN_PROP.OUTPUT_INST];

                        d.setBatchSize(store.spec.config.dlBatchSize);
                        d.setChannels(store.spec.config.dlChannels);

                        l.setMinZoomHeight(store.spec.config.minZoomHeight);
                        l.setMinZoomWidth(store.spec.config.minZoomWidth);
                        l.setKnownBadImgRegex(store.spec.config.knownBadImgRegex);

                        l.setMessages(store.spec.messages);
                        l.setProcessings(store.spec.processings);
                        l.setBlessings(store.spec.blessings);

                        o.setEnableHalfBakedFeatures(
                            (store.spec.config.enableHalfBakedFeatures === GCon.OPT_CONF.HALF_BAKED_VAL)
                        );
                    });

                    // Show all the buttons if the user enabled the half-baked features.
                    if (store.spec.config.enableHalfBakedFeatures === GCon.OPT_CONF.HALF_BAKED_VAL) {
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
                        bgWindow[GCon.WIN_PROP.EVENTPAGE_ST].goDigFileOptions(window.document);
                    });
                });


                /**
                 * Scrape and dig a page that contains links to multiple galleries. Don't automatically download. 
                 * Present the user with checkbox options as to what files to download.
                 */
                document.getElementById('digGalleryGallery').addEventListener('click', function onDigGalleryGallery() {
                    chrome.runtime.getBackgroundPage(function doGalleryGalleryDigging(bgWindow) {
                        bgWindow[GCon.WIN_PROP.EVENTPAGE_ST].goDigGalleryGallery(window.document);
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
                        
                        var out = bgWindow[GCon.WIN_PROP.OUTPUT_INST];
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
                        bgWindow[GCon.WIN_PROP.EVENTPAGE_ST].goScrapeFileOptions(window.document);
                    });
                });


                /**
                 * Scrape a page, picking up all the included images.
                 */
                document.getElementById("scrapeImagesButton").addEventListener("click", function onDigButton() {
                    chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
                        bgWindow[GCon.WIN_PROP.EVENTPAGE_ST].goScrapeImages(window.document);
                    });
                });


                /**
                 * Scrape a page, picking up all the included videos.
                 */
                document.getElementById("scrapeVideosButton").addEventListener("click", function onDigButton() {
                    chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
                        bgWindow[GCon.WIN_PROP.EVENTPAGE_ST].goScrapeVideos(window.document);
                    });
                });


                /**
                 * A big one, scrape a page for *any* media.
                 */
                document.getElementById("scrapeButton").addEventListener("click", function onDigButton() {
                    chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
                        bgWindow[GCon.WIN_PROP.EVENTPAGE_ST].goScrape(window.document);
                    });
                });


                /**
                 * Dig an image gallery.
                 */
                document.getElementById("digImageGalleryButton").addEventListener("click", function onDigButton() {
                    chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
                        bgWindow[GCon.WIN_PROP.EVENTPAGE_ST].goDigImageGallery(window.document);
                    });
                });


                /**
                 * Dig a video gallery.
                 */
                document.getElementById("digVideoGalleryButton").addEventListener("click", function onDigButton() {
                    chrome.runtime.getBackgroundPage(function doVideoGalleryDig(bgWindow) {
                        bgWindow[GCon.WIN_PROP.EVENTPAGE_ST].goDigVideoGallery(window.document);
                    });
                });


                /**
                 * The big one, digging *everything* that could be from a gallery.
                 */
                document.getElementById("digButton").addEventListener("click", function onDigButton() {
                    chrome.runtime.getBackgroundPage(function doDigging(bgWindow) {
                        bgWindow[GCon.WIN_PROP.EVENTPAGE_ST].goDig(window.document);
                    });
                });


                /**
                 * Stop any digging or scraping currently happening.
                 */
                document.getElementById('stopButton').addEventListener('click', () => {
                    chrome.runtime.getBackgroundPage((bgWindow) => {
                        console.log('[Popup] stop button was pressed. Stopping.');
                        bgWindow[GCon.WIN_PROP.EVENTPAGE_ST].stopHarvesting(window.document);
                    });
                });


                /**
                 * Toggle the Voyeur.
                 */
                document.getElementById("toggleVoyeur").addEventListener("click", function onToggleVoyeurButton() {
                    chrome.runtime.getBackgroundPage(function toggleVoyeur(bgWindow) {
                        if (bgWindow.theVoyeur.isWatching) {
                            bgWindow.theVoyeur.stop();
                        }
                        else {
                            bgWindow.theVoyeur.start();
                        }
                    });
                });
            }
        });
    }
}

window[GCon.WIN_PROP.POPUP_INST] = new Popup();

export default Popup;
