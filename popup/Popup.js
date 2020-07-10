import { default as C } from '../lib/C.js';
import { default as Output } from '../background/Output.js';
import { default as Utils } from '../background/Utils.js'
import { default as Digger } from '../background/Digger.js';
import { default as Logicker } from '../background/Logicker.js';
import { default as EventPage } from '../background/EventPage.js';
import {
    Storing, 
    FileOption,
    Log,
} from '../lib/DataClasses.js';


/**
 * Controller for the popup window UI.
 */
class Popup {
    // Hold the instance of the popup.
    static instance = undefined;

    // the logger.
    log = new Log(C.LOG_SRC.POPUP);


    /**
     * Constructor. Sets up the page loaded hook to set the file options list, read
     * the preferences, and connect the button event handlers.
     */
    constructor() {
        this.log.log('Popup constructor called.');

        // Set up event handlers for the UI. All actual work is done in the background scripts.
        document.addEventListener("DOMContentLoaded", () => {
            this.setFileOptionList();
            this.readSpec();
            this.connectEventHandlers();    
        });

        Popup.instance = this;
    }

    
    /**
     * If there are still un-downloaded things from last time, show them. 
     * Note: clicking one of the "download all [ |jpgs]" button will clear them.
     */
    setFileOptionList() {
        var me = this;

        chrome.storage.local.get(
            Storing.storePrevUriMap({}), 
            (store) => {
                var uriMap = store.prevUriMap
                
                // If we're still in the digging/scraping stages, restore the textual file-list.
                // If we're in the file option download stage, show the list of file option checkboxes instead.
                var length = Object.values(uriMap).length;
                chrome.runtime.getBackgroundPage((bgWindow) => {
                    // Alias the static class Utils, and get the Output common instance..
                    var ut = Utils;
                    var out = Output.getInstanceSetToDoc(window.document);
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
                        me.log.log(
                            'Got persisted uris:\n' + 
                            '    ' + JSON.stringify(uriMap));

                        me.log.log(
                            '[Popup] Got checked uris:\n' +
                            '        ' + JSON.stringify(out.checkedFileOptUris)
                        );

                        out.showActionButtons();
                        var dir = ut.getSaltedDirectoryName();
                
                        out.clearFilesDug();
                        ut.resetDownloader();

                        var checkedItemCount = 0;
                        var idx = length - 1;

                        // Make a file option and hook up the event handlers for all in the prevUriMap.
                        for (var thumbUri in uriMap) { 
                            var uri = uriMap[thumbUri];

                            if (!uri || !uri.replace || uri.indexOf(C.ST.DOT) === 0) {
                                me.log.log('Bad uri string for download: ' + JSON.stringify(uri));
                                continue;
                            }

                            var queryPos = uri.lastIndexOf(C.ST.Q_MARK);

                            if (queryPos === -1) {
                                queryPos = uri.length;
                            }

                            var filePath = dir + C.ST.WHACK + uri.substring(uri.lastIndexOf(C.ST.WHACK) + 1, queryPos)
                            var optId = (idx--);

                            out.addFileOption(new FileOption(optId+C.ST.E, uri, thumbUri, filePath, ut.downloadFile));
                            
                            var cb = document.getElementById( C.ELEMENT_ID.CB_PREFIX + optId);
                            if (!!cb) {
                                if (out.checkedFileOptUris.indexOf(cb.value) !== -1) {
                                    checkedItemCount++;   
                                    cb.dataset.filePath = C.ST.E;
                                    cb.checked = true;
                                    cb.disabled = true;
                                }
                            }
                        }

                        // Set the badge text and background color.
                        chrome.browserAction.setBadgeText({ text: C.ST.E + (length - checkedItemCount) + C.ST.E });
                        chrome.browserAction.setBadgeBackgroundColor(C.COLOR.AVAILABLE_FOPTS);

                        if (checkedItemCount > 0) {
                            out.toOut('Please select which of the ' + (length - checkedItemCount) + ' remaining files you wish to download.');
                        }
                        else {
                            out.toOut('Please select which of the total ' + length + ' files you wish to download.');
                        }
                    }
                    else {
                        // If there are no previous uri entries, set us up normally.
                        chrome.browserAction.setBadgeText({ text: C.ST.E });
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
    static clearPreviousUriMap() {         
        chrome.browserAction.setBadgeText({ text: C.ST.E });
        chrome.storage.local.set(
            Storing.storePrevUriMap({}),
            () => {
                console.log(C.LOG_SRC.POPUP + 'Cleared prev uri map');
            }
        );
    }


    /**
     Read storage for the spec json.
    */
    readSpec() {
        chrome.storage.sync.get({
            spec: {
                config: C.OPT_CONF.CANNED_CONFIG,
                messages: [],
                processings: [],
                blessings: [],
            }
        }, 
        (store) => {
            // Set the options on the Digger and Logicker through static methods, and on
            // Output's common instance. 
            chrome.runtime.getBackgroundPage(function setSpec(bgWindow) {
                var d = Digger; //bgWindow[C.WIN_PROP.DIGGER_CLASS];
                var l = Logicker; //bgWindow[C.WIN_PROP.LOGICKER_CLASS];
                var o = Output.instance //bgWindow[C.WIN_PROP.OUTPUT_CLASS].instance;

                d.setBatchSize(store.spec.config.dlBatchSize);
                d.setChannels(store.spec.config.dlChannels);

                l.setMinZoomHeight(store.spec.config.minZoomHeight);
                l.setMinZoomWidth(store.spec.config.minZoomWidth);
                l.setKnownBadImgRegex(store.spec.config.knownBadImgRegex);

                l.setMessages(store.spec.messages);
                l.setProcessings(store.spec.processings);
                l.setBlessings(store.spec.blessings);

                o.setEnableHalfBakedFeatures(
                    (store.spec.config.enableHalfBakedFeatures === C.OPT_CONF.HALF_BAKED_VAL)
                );
            });

            // Show all the buttons if the user enabled the half-baked features.
            if (store.spec.config.enableHalfBakedFeatures === C.OPT_CONF.HALF_BAKED_VAL) {
                var bcs = document.getElementsByClassName('buttonColumn');

                for (var b = 0; b < bcs.length; b++) {
                    bcs[b].style.display = C.CSS_V.DISPLAY.IL_BLOCK;
                }
            }
        });
    }


    /**
     * Connect up all the event handlers.
     */
    connectEventHandlers() {
        var me = this; 
        var EP = C.WIN_PROP.EVENT_PAGE_CLASS; 

        /**
         * Scrape and dig, but don't automatically download. Instead, present the user with checkbox options
         * as to what files to download.
         */
        document.getElementById(C.ELEMENT_ID.DIG_FILE_OPTIONS).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage(function doDiggingForOptions(bgWindow) {
                bgWindow[EP].goDigFileOptions(window.document);
            });
        });


        /**
         * Scrape and dig a page that contains links to multiple galleries. Don't automatically download. 
         * Present the user with checkbox options as to what files to download.
         */
        document.getElementById(C.ELEMENT_ID.DIG_GALLERY_GALLERY).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage(function doGalleryGalleryDigging(bgWindow) {
                bgWindow[EP].goDigGalleryGallery(window.document);
            });
        });


        /**
         * This button is in the "action buttons" group. They act upon the list of file download options. This
         * fires all the checkboxes' click events, causing them all the download.
         */
        document.getElementById(C.ELEMENT_ID.GET_ALL_FILE_OPTS).addEventListener(C.EVT.CLICK, () => {
            document.querySelectorAll('input[type="checkbox"]').forEach(function initiateDownload(cbEl) {
                var evt = new MouseEvent(C.EVT.CLICK);
                cbEl.dispatchEvent(evt);
            });
        });


        /**
         * This button is in the "action buttons" group. They act upon the list of file download options. This
         * fires the checkboxes' click events for all jpg files only.
         */
        document.getElementById(C.ELEMENT_ID.GET_ALL_JPG_OPTS).addEventListener(C.EVT.CLICK, () => {
            document.querySelectorAll('input[type="checkbox"]').forEach(function initiateJpgDownload(cbEl) {
                if (cbEl.dataset.filePath.match(new RegExp(/\.(jpg|jpeg)$/, 'i'))) {
                    var evt = new MouseEvent(C.EVT.CLICK);
                    cbEl.dispatchEvent(evt);
                }
            });
        });


        /**
         * This button is in the "action buttons" group. It clears the download list, clears the 
         * previouslyHarvestedUriMap, shows the scrape/dig buttons, and hides the "action buttons".
         */
        document.getElementById(C.ELEMENT_ID.CLEAR_FILE_LIST).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage(function clearTheFileList(bgWindow) {
                Popup.clearPreviousUriMap();
                
                var out = Output.instance;
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
        document.getElementById(C.ELEMENT_ID.SCRAPE_FILE_OPTIONS).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage(function doScrapingForOptions(bgWindow) {
                bgWindow[EP].goScrapeFileOptions(window.document);
            });
        });


        /**
         * Scrape a page, picking up all the included images.
         */
        document.getElementById(C.ELEMENT_ID.SCRAPE_IMAGES).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
                bgWindow[EP].goScrapeImages(window.document);
            });
        });


        /**
         * Scrape a page, picking up all the included videos.
         */
        document.getElementById(C.ELEMENT_ID.SCRAPE_VIDEOS).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
                bgWindow[EP].goScrapeVideos(window.document);
            });
        });


        /**
         * A big one, scrape a page for *any* media.
         */
        document.getElementById(C.ELEMENT_ID.SCRAPE).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
                bgWindow[EP].goScrape(window.document);
            });
        });


        /**
         * Dig an image gallery.
         */
        document.getElementById(C.ELEMENT_ID.DIG_IMAGE_GALLERY).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage(function doImageGalleryDig(bgWindow) {
                bgWindow[EP].goDigImageGallery(window.document);
            });
        });
""

        /**
         * Dig a video gallery.
         */
        document.getElementById(C.ELEMENT_ID.DIG_VIDEO_GALLERY).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage(function doVideoGalleryDig(bgWindow) {
                bgWindow[EP].goDigVideoGallery(window.document);
            });
        });


        /**
         * The big one, digging *everything* that could be from a gallery.
         */
        document.getElementById(C.ELEMENT_ID.DIG).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage(function doDigging(bgWindow) {
                bgWindow[EP].goDig(window.document);
            });
        });


        /**
         * Stop any digging or scraping currently happening.
         */
        document.getElementById(C.ELEMENT_ID.STOP).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage((bgWindow) => {
                me.log.log('stop button was pressed. Stopping.');
                bgWindow[EP].stopHarvesting(window.document);
            });
        });


        /**
         * Toggle the Voyeur.
         */
        document.getElementById(C.ELEMENT_ID.TOGGLE_VOYEUR).addEventListener(C.EVT.CLICK, () => {
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
}


// Set a new instance of the popup on the window object if it's not already there.
// Only do this if we're on the popup page.
if (!window.hasOwnProperty(C.WIN_PROP.POPUP_INST) && Utils.isPopupPage(window)) {
    // Make sure Output has been initialized.
    if (!!Output.getInstance()) {
        window[C.WIN_PROP.OUTPUT_INST] = Output.getInstanceSetToDoc(window.document);
    }
    else {
        window[C.WIN_PROP.OUTPUT_INST] = new Output(window.document);
    }
    
    // Construct our popup
    window[C.WIN_PROP.POPUP_INST] = new Popup();
}


// Export.
export default Popup;
