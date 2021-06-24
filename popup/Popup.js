import { default as C } from '../lib/C.js';
import { default as Output } from '../background/Output.js';
import { default as Utils } from '../background/Utils.js'
import {
    Storing, 
    FileOption,
    StopEvent,
    ResumeEvent,
} from '../lib/DataClasses.js';
import CommonBase from '../lib/CommonBase.js';


/**
 * Controller for the popup window UI.
 */
class Popup extends CommonBase {
    // Hold the instance of the singleton popup.
    static instance = undefined;


    /**
     * Constructor. Sets up the page loaded hook to set the file options list, read
     * the preferences, and connect the button event handlers.
     */
    constructor() {
        if (Utils.exists(Popup.instance)) {
            Popup.instance.lm('Popup constructor called, but there\'s already a valid Popup.instance.');
        }
        else {
            // set up Log, and STOP event handlers.
            super(C.LOG_SRC.POPUP);

            // Set the static instance.
            Popup.instance = this;

            // Set up event handlers for the UI. All actual work is done in the background scripts.
            document.addEventListener("DOMContentLoaded", () => {
                Popup.instance.setFileOptionList();
                Popup.instance.readSpec();
                Popup.instance.connectEventHandlers();    
            });
        }
    }

    
    /**
     * If there are still un-downloaded things from last time, show them. 
     * Note: clicking one of the "download all [ |jpgs]" button will clear them.
     */
    setFileOptionList() {
        var me = this;

        Utils.getFromStorage(Storing.buildPrevUriMapStoreObj({}), 'local')
            .then((store) => {
                var uriMap = store.prevUriMap

                // If we're still in the digging/scraping stages, restore the textual file-list.
                // If we're in the file option download stage, show the list of file option checkboxes instead.
                var length = Object.values(uriMap).length;

                chrome.runtime.getBackgroundPage((bgWindow) => {
                    // Alias the static class Utils, and get the Output common instance..
                    var ut = bgWindow[C.WIN_PROP.UTILS_CLASS];
                    var out = bgWindow[C.WIN_PROP.OUTPUT_CLASS].getInstanceSetToDoc(window.document);

                    // If it's still doing a dig/scrape, just say so and return.
                    if (out.appIsScraping || out.appIsDigging) {
                        var descriptionOfWork = out.appIsScraping ? 'scraping...' : 'digging...';
                        var outMessage = `Currently ${descriptionOfWork}`;
                        
                        out.toOut(outMessage);
                        out.showStopButton();
                        out.restoreFileList();

                        return C.CAN_FN.PR_RS(outMessage);
                    }
                    
                    // Otherwise, if there is a previousUriMap, make the file options.
                    if (length > 0) {
                        me.lm(
                            'Got persisted uris:\n' + 
                            '    ' + JSON.stringify(uriMap)
                        );

                        me.lm(
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

                            if (!uri || !uri.replace || uri.indexOf(C.ST.D) === 0) {
                                me.lm(`Bad uri string for download: ${JSON.stringify(uri)}`);
                                continue;
                            }

                            var queryPos = uri.lastIndexOf(C.ST.Q_MK);

                            if (queryPos === -1) {
                                queryPos = uri.length;
                            }

                            var filePath = dir + C.ST.WHACK + uri.substring(uri.lastIndexOf(C.ST.WHACK) + 1, queryPos);
                            var optId = (idx--);

                            out.addFileOption(new FileOption((optId + C.ST.E), uri, thumbUri, filePath, ut.downloadFile));
                            
                            var cBox = document.getElementById(C.ELEMENT_ID.CB_PREFIX + optId);
                            if (Utils.exists(cBox)) {
                                if (out.checkedFileOptUris.indexOf(cBox.value) !== -1) {
                                    checkedItemCount++;   
                                    cBox.dataset.filePath = C.ST.E;
                                    cBox.checked = true;
                                    cBox.disabled = true;
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

                return C.CAN_FN.PR_RS_DEF();
            })
            .catch((err) => {
                if (!err) {
                    return C.CAN_FN.PR_RS_DEF();
                }

                var outputArea = window.document.getElementById(C.ELEMENT_ID.OUTPUT);     
                outputArea.textContent = 'Problem loading previous results. My apologies.';
                me.lm('Could not get the prevUriMap. err: ' + JSON.stringify(err));
                
                return C.CAN_FN.PR_RJ(err);
            });
    }


    /**
     * Clear the persisted URI map from storage.
     */
    static clearPreviousUriMap() {         
        chrome.browserAction.setBadgeText({ text: C.ST.E });
        
        Utils.setInStorage(Storing.buildPrevUriMapStoreObj({}), 'local')
            .then(() => {
                Popup.instance.lm( 'Cleared prev uri map');
                return C.CAN_FN.PR_RS_DEF();
            })
            .catch((err) => {
                Popup.instance.lm(`Could not clear prevUriMap. Continuing, but that is weird. Error was:\n     ${JSON.stringify(err)}`);
                return C.CAN_FN.PR_RJ(err);
            });
    }


    /**
     Read storage for the spec json.
    */
    readSpec() {
        Utils.getFromStorage(
            {
                spec: {
                    config: C.OPT_CONF.CANNED_CONFIG,
                    messages: [],
                    processings: [],
                    blessings: [],
                }
            },
            'sync'
        )
        .then((store) => {
            // Set the options on the Digger and Logicker through static methods, and on
            // Output's common instance. 
            chrome.runtime.getBackgroundPage(function setSpec(bgWindow) {
                var d = bgWindow[C.WIN_PROP.DIGGER_CLASS];
                var l = bgWindow[C.WIN_PROP.LOGICKER_CLASS];
                var o = bgWindow[C.WIN_PROP.OUTPUT_CLASS].getInstance();
                var u = bgWindow[C.WIN_PROP.UTILS_CLASS];

                // Store the full options spec on the EventPage so it can easily 
                // merge in new galleryDefs to "spec.messages".
                var ep = bgWindow[C.WIN_PROP.EVENT_PAGE_CLASS];
                ep.optSpec = store.spec;

                u.setConcurrentDownloadCount(store.spec.config.concurrentDls);

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

            return C.CAN_FN.PR_RS_DEF();
        })
        .catch((err) => {
            Popup.instance.lm(`Failed to get options/preferences spec. Non-lethal, we just continue with defaults. Error caught is:\n\t${JSON.stringify(err)}`);
            return C.CAN_FN.PR_RJ(err);
        });
    }


    /**
     * Connect up all the event handlers.
     */
    connectEventHandlers() {
        var EP = C.WIN_PROP.EVENT_PAGE_CLASS; 
        
        /**
         * Scrape and dig, but don't automatically download. Instead, present the user with checkbox options
         * as to what files to download.
         */
        document.getElementById(C.ELEMENT_ID.DIG_FILE_OPTIONS).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage((bgWindow) => {
                bgWindow[EP].goDigFileOptions(window.document);
            });
        });


        /**
         * Scrape and dig a page that contains links to multiple galleries. Don't automatically download. 
         * Present the user with checkbox options as to what files to download.
         */
        document.getElementById(C.ELEMENT_ID.DIG_GALLERY_GALLERY).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage((bgWindow) => {
                bgWindow[EP].goDigGalleryGallery(window.document);
            });
        });


        /**
         * This button is in the "action buttons" group. They act upon the list of file download options. This
         * fires all the checkboxes' click events, causing them all the download.
         */
        document.getElementById(C.ELEMENT_ID.GET_ALL_FILE_OPTS).addEventListener(C.EVT.CLICK, () => {
            document.querySelectorAll('input[type="checkbox"]').forEach((cbEl) => {
                var evt = new MouseEvent(C.EVT.CLICK);
                cbEl.dispatchEvent(evt);
            });
        });


        /**
         * This button is in the "action buttons" group. They act upon the list of file download options. This
         * fires the checkboxes' click events for all jpg files only.
         */
        document.getElementById(C.ELEMENT_ID.GET_ALL_JPG_OPTS).addEventListener(C.EVT.CLICK, () => {
            document.querySelectorAll('input[type="checkbox"]').forEach((cbEl) => {
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
            chrome.runtime.getBackgroundPage((bgWindow) => {
                Popup.clearPreviousUriMap();
                
                var out = bgWindow[C.WIN_PROP.OUTPUT_CLASS].getInstanceSetToDoc(window.document);
                          
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
            chrome.runtime.getBackgroundPage((bgWindow) => {
                bgWindow[EP].goScrapeFileOptions(window.document);
            });
        });


        /**
         * Scrape a page, picking up all the included images.
         */
        document.getElementById(C.ELEMENT_ID.SCRAPE_IMAGES).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage((bgWindow) => {
                bgWindow[EP].goScrapeImages(window.document);
            });
        });


        /**
         * Scrape a page, picking up all the included videos.
         */
        document.getElementById(C.ELEMENT_ID.SCRAPE_VIDEOS).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage((bgWindow) => {
                bgWindow[EP].goScrapeVideos(window.document);
            });
        });


        /**
         * A big one, scrape a page for *any* media.
         */
        document.getElementById(C.ELEMENT_ID.SCRAPE).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage((bgWindow) => {
                bgWindow[EP].goScrape(window.document);
            });
        });


        /**
         * Dig an image gallery.
         */
        document.getElementById(C.ELEMENT_ID.DIG_IMAGE_GALLERY).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage((bgWindow) => {
                bgWindow[EP].goDigImageGallery(window.document);
            });
        });
""

        /**
         * Dig a video gallery.
         */
        document.getElementById(C.ELEMENT_ID.DIG_VIDEO_GALLERY).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage((bgWindow) => {
                bgWindow[EP].goDigVideoGallery(window.document);
            });
        });


        /**
         * The big one, digging *everything* that could be from a gallery.
         */
        document.getElementById(C.ELEMENT_ID.DIG).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage((bgWindow) => {
                bgWindow[EP].goDig(window.document);
            });
        });


        /**
         * Stop any digging or scraping currently happening. Fire off a STOP event, and provide
         * it with a silly dictionary (and it has the time triggered).
         */
        document.getElementById(C.ELEMENT_ID.STOP).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage((bgWindow) => {                
                var evt = new StopEvent();
                bgWindow.document.dispatchEvent(evt);
            });
        });


        document.getElementById(C.ELEMENT_ID.BACK_TO_TOP).addEventListener(C.EVT.CLICK, () => {
            window.scroll({ top: 0 });
        });

        /*
        document.getElementById(C.ELEMENT_ID.RESUME).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage((bgWindow) => {
                var evt = new ResumeEvent();
                bgWindow.document.dispatchEvent(evt);
            });
        });
        */


        /**
         * Toggle the Voyeur -- a very simple media request tracker-to-console-logger.
         */
        document.getElementById(C.ELEMENT_ID.TOGGLE_VOYEUR).addEventListener(C.EVT.CLICK, () => {
            chrome.runtime.getBackgroundPage((bgWindow) => {
                var voy = bgWindow[C.WIN_PROP.VOYEUR_CLASS];
                voy.toggleVoying();
            });
        });
    }       
}


// Set a new instance of the popup on the window object if it's not already there.
// Only do this if we're on the popup page.
if (Utils.isPopupPage(window) && !window.hasOwnProperty(C.WIN_PROP.POPUP_INST)) {
    // Make sure Output has been initialized.
    if (Utils.exists(Output.getInstance())) {
        window[C.WIN_PROP.OUTPUT_INST] = Output.getInstanceSetToDoc(window.document);
    }
    else {
        window[C.WIN_PROP.OUTPUT_INST] = new Output(window.document);
    }
    
    // Construct our single-ish-ton Popup.
    window[C.WIN_PROP.POPUP_INST] = (
        Utils.exists(Popup.instance) ? Popup.instance : new Popup()
    );
}

// Export.
export default Popup;
