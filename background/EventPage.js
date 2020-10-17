import { default as Scraper } from './Scraper.js';
import { default as Digger } from './Digger.js';
import { default as Output } from './Output.js';
import { default as Logicker } from './Logicker.js';
import { default as Utils } from './Utils.js';
import { default as Voyeur } from './Voyeur.js';
import { default as App } from './App.js';
import { default as C } from '../lib/C.js';
import { 
    InspectionOptions, 
    Log, 
    ResumeEvent,
    GalleryDef,
    ConfigSpec, 
    Storing,
} from '../lib/DataClasses.js';


const EP = C.WIN_PROP.EVENT_PAGE_CLASS; 

class EventPage {
    // The definitively active EventPage's app instance, stored statically.
    static app = undefined;

    // The full value of chrome.storage.local.get(['spec'], ...). Set by the Popup,
    // because it handles storage the most.
    static optSpec = {};


    //
    // Digging
    //


    /**
     * Fire up the EventPage.app, dig for all known media in the parameters that we can scrape outta that mutha. 
     *  - Image galleries (Thumb, Zoom)
     *  - CSS background-images
     *  - mucks through javascript (musta been green programmers)
     */
    static goDig(parentDocument) {
        window.document.dispatchEvent(new ResumeEvent());

        var inspectionOptions = new InspectionOptions(true, true, true, true, false, false);
        var out = Output.getInstanceSetToDoc(parentDocument);
        out.resetFileData();
        
        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);

        return(
            EventPage.app.digGallery() 
                .finally(EventPage.undefineApp)
        );
    }


    /**
     * Fire up the EventPage.app, dig for all known media in the parameters that we can scrape outta that mutha. 
     *  - Image galleries (Thumb, Zoom)
     *  - CSS background-images
     *  - mucks through javascript (musta been green programmers)
     */
    static goDigFileOptions(parentDocument) {
        window.document.dispatchEvent(new ResumeEvent());

        var inspectionOptions = new InspectionOptions(true, true, true, true, false, false);
        var out = Output.getInstanceSetToDoc(parentDocument);
        out.resetFileData();
        
        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);
        
        return(
            EventPage.app.digFileOptions()
                .finally(EventPage.undefineApp)
        );
    }


    /**
     * Fire up the EventPage.app, dig only for image galleries.
     * This includes css Background Images for bastards like FB.
     */
    static goDigImageGallery(parentDocument) {
        window.document.dispatchEvent(new ResumeEvent());

        var inspectionOptions = new InspectionOptions(true, true, false, true, false, false);
        var out = Output.getInstanceSetToDoc(parentDocument);
        out.resetFileData();

        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);

        return(
            EventPage.app.digGallery()
                .finally(EventPage.undefineApp)
        );
    }


    /**
     * Fire up the EventPage.app, dig only for video galleries.
     */
    static goDigVideoGallery(parentDocument) {
        window.document.dispatchEvent(new ResumeEvent());

        var inspectionOptions = new InspectionOptions(false, false, true, true, false, false);    
        var out = Output.getInstanceSetToDoc(parentDocument);
        out.resetFileData();

        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);

        return(
            EventPage.app.digGallery()
                .finally(EventPage.undefineApp)
        );
    }


    /**
     * Go dig multiple galleries from a page of gallery of galleries.
     */
    static goDigGalleryGallery(parentDocument) {
        window.document.dispatchEvent(new ResumeEvent());

        var inspectionOptions = new InspectionOptions(true, true, true, true, false, false);
        var out = Output.getInstanceSetToDoc(parentDocument);
        out.resetFileData();

        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);

        return(
            EventPage.app.digGalleryGallery()
                .finally(EventPage.undefineApp)
        );
    }




    //
    // Scraping
    //


    /**
     * Scrape the current page for all included <img>s, style.background-images, 
     * videos, audios, any urls inside of the <script> tags, and any urls in the 
     * query-string. Then JUST START DOWNLOADING THEM.
     */
    static goScrape(parentDocument) {
        window.document.dispatchEvent(new ResumeEvent());

        var inspectionOptions = new InspectionOptions(true);
        var out = Output.getInstanceSetToDoc(parentDocument);
        out.resetFileData();

        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);

        return(
            EventPage.app.scrape(inspectionOptions)
                .finally(EventPage.undefineApp)
        );
    }


    /**
     * Scrape the current page for all included <img>s, style.background-images, 
     * videos, any urls inside of the <script> tags, and any urls in the 
     * query-string. Then present options for the user to choose to download or not.
     */
    static goScrapeFileOptions(parentDocument) {
        window.document.dispatchEvent(new ResumeEvent());

        var inspectionOptions = new InspectionOptions(true);
        var out = Output.getInstanceSetToDoc(parentDocument);
        out.resetFileData();

        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);

        return(
            EventPage.app.scrapeFileOptions(inspectionOptions)
                .finally(EventPage.undefineApp)
        );
    }


    /**
     * Scrape the current page for <img>s.
     */
    static goScrapeImages(parentDocument) {
        window.document.dispatchEvent(new ResumeEvent());

        var inspectionOptions = new InspectionOptions(true, true, false, true, false, true);
        var out = Output.getInstanceSetToDoc(parentDocument);
        out.resetFileData();

        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);

        return(
            EventPage.app.scrape(inspectionOptions)
                .finally(EventPage.undefineApp)
        );
    }


    /**
     * Scrape the current page for <video>s.
     */
    static goScrapeVideos(parentDocument) {
        window.document.dispatchEvent(new ResumeEvent());

        var inspectionOptions = new InspectionOptions(false, false, true, true, false, true);
        var out = Output.getInstanceSetToDoc(parentDocument);
        out.resetFileData();

        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);

        return(
            EventPage.app.scrape(inspectionOptions)
                .finally(EventPage.undefineApp)
        );
    }


    /**
     * Set the EventPage.app back to undefined on process completion.
     */
    static undefineApp() {
        EventPage.app = undefined;
        return(true);
    }
    

    /**
     * Start a chrome.storage change listener, which takes the values from the 
     * 'galleryDefs' storage key and creates 'spec.messages' entries from them.
     */
    static debounceLocked = false;
    static startListeningForNewGalleryDefs() {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            // Were we called about a galleryDefs change? Otherwise, do nothing. 
            var gDefChange = false;
            if (!EventPage.debounceLocked && !!changes && (gDefChange = changes[C.OPT_CONF.GALLERY_DEFS])) {
                // If we have new gallery definitions, create SpecMessage objects from them
                // and append them to the "spec" key's "messages" array and store.
                if (Array.isArray(gDefChange.newValue)) {
                    // Lock so this handler does not stomp itself.
                    EventPage.debounceLocked = true;

                    // Convert the defs to Messages, append them to our copy of the spec.
                    var defMessages = gDefChange.newValue.map(gDefObj => GalleryDef.fromStorage(gDefObj).toSpecMessage());                    
                    Array.prototype.push.apply(EventPage.optSpec.messages, defMessages);

                    // Set the spec into storage, now containing its expanded messages list. 
                    // On success, also update Logicker with the new messages and remove the 
                    // now unneeded gallery defs from storage.
                    // Finally unlock our debounce var.
                    Utils.setInStorage(Storing.buildConfigSpecStoreObj(EventPage.optSpec))
                        .then(() => {
                            EventPage.lm(`Set spec in storage with ${defMessages.length} discovered gallery definitions.`);
                            Logicker.setMessages(EventPage.optSpec.messages);
                            return Utils.removeFromStorage([C.OPT_CONF.GALLERY_DEFS]);
                        })
                        .catch((err) => {
                            EventPage.lm(`Could not store the updated options spec! Error was:\n\t${JSON.stringify(err)}`);
                            return C.CAN_FN.PR_RJ(err);
                        })
                        .finally(() => {
                            EventPage.debounceLocked = false;
                        });
                }
            }
        });
    }
}


// Set the class on the background window just in case.
if (Utils.isBackgroundPage(window) && !window.hasOwnProperty(EP)) {
    window[EP] = EventPage;
}


// export.
export default EventPage;
