import { default as Scraper } from './Scraper.js';
import { default as Digger } from './Digger.js';
import { default as Output } from './Output.js';
import { default as Logicker } from './Logicker.js';
import { default as Utils } from './Utils.js';
import { default as Voyeur } from './Voyeur.js';
import { default as App } from './App.js';
import { default as C } from '../lib/C.js';
import { InspectionOptions, Log, ResumeEvent } from '../lib/DataClasses.js';


const EP = C.WIN_PROP.EVENT_PAGE_CLASS; 

class EventPage {
    // The definitively active EventPage's app instance, stored statically.
    static app = undefined;

    
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
}


// Set the class on the background window just in case.
if (Utils.isBackgroundPage(window) && !window.hasOwnProperty(EP)) {
    window[EP] = EventPage;
}


// export.
export default EventPage;