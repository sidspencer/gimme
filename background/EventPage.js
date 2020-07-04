import { default as Scraper } from './Scraper.js';
import { default as Digger } from './Digger.js';
import { default as Output } from './Output.js';
import { default as Logicker } from './Logicker.js';
import { default as Utils } from './Utils.js';
import { default as Voyeur } from './Voyeur.js';
import { default as App } from './App.js';
import { default as GCon } from '../lib/GCon.js';
import { InspectionOptions } from '../lib/DataClasses.js';



class EventPage {
    // The active EventPage.app instance, stored statically.
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
        var inspectionOptions = new InspectionOptions(true, true, true, true, false, false);
        var out = window[GCon.WIN_PROP.OUTPUT_INST];

        out.setDoc(parentDocument);
        out.resetFileData();
        

        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);

        EventPage.app.digGallery()
            .finally(EventPage.undefineApp);
    }


    /**
     * Fire up the EventPage.app, dig for all known media in the parameters that we can scrape outta that mutha. 
     *  - Image galleries (Thumb, Zoom)
     *  - CSS background-images
     *  - mucks through javascript (musta been green programmers)
     */
    static goDigFileOptions(parentDocument) {
        var inspectionOptions = new InspectionOptions(true, true, true, true, false, false);

        var out = window[GCon.WIN_PROP.OUTPUT_INST];
        out.setDoc(parentDocument);
        out.resetFileData();
        
        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);
        
        EventPage.app.digFileOptions()
            .finally(EventPage.undefineApp);
    }


    /**
     * Fire up the EventPage.app, dig only for image galleries.
     * This includes css Background Images for bastards like FB.
     */
    static goDigImageGallery(parentDocument) {
        var inspectionOptions = new InspectionOptions(true, true, false, true, false, false);

        var out = window[GCon.WIN_PROP.OUTPUT_INST];
        out.setDoc(parentDocument);
        out.resetFileData();

        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);


        EventPage.app.digGallery()
            .finally(EventPage.undefineApp);
    }


    /**
     * Fire up the EventPage.app, dig only for video galleries.
     */
    static goDigVideoGallery(parentDocument) {
        var inspectionOptions = new InspectionOptions(false, false, true, true, false, false);
    
        var out = window[GCon.WIN_PROP.OUTPUT_INST];
        out.setDoc(parentDocument);
        out.resetFileData();

        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);

        EventPage.app.digGallery()
            .finally(EventPage.undefineApp);
    }


    /**
     * Go dig multiple galleries from a page of gallery of galleries.
     */
    static goDigGalleryGallery(parentDocument) {
        var inspectionOptions = new InspectionOptions(true, true, true, true, false, false); 
        
        var out = window[GCon.WIN_PROP.OUTPUT_INST];
        out.setDoc(parentDocument);
        out.resetFileData();

        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);

        EventPage.app.digGalleryGallery()
            .finally(EventPage.undefineApp);
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
        var inspectionOptions = new InspectionOptions(true); 
    
        var out = window[GCon.WIN_PROP.OUTPUT_INST];
        out.setDoc(parentDocument);
        out.resetFileData();

        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);

        EventPage.app.scrape(inspectionOptions)
            .finally(EventPage.undefineApp);
    }


    /**
     * Scrape the current page for all included <img>s, style.background-images, 
     * videos, any urls inside of the <script> tags, and any urls in the 
     * query-string. Then present options for the user to choose to download or not.
     */
    static goScrapeFileOptions(parentDocument) {
        var inspectionOptions = new InspectionOptions(true);

        var out = window[GCon.WIN_PROP.OUTPUT_INST];
        out.setDoc(parentDocument);
        out.resetFileData();

        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);


        EventPage.app.scrapeFileOptions(inspectionOptions)
            .finally(EventPage.undefineApp);
    }


    /**
     * Scrape the current page for <img>s.
     */
    static goScrapeImages(parentDocument) {
        var inspectionOptions = new InspectionOptions(true, true, false, true, false, true);
        
        var out = window[GCon.WIN_PROP.OUTPUT_INST];
        out.setDoc(parentDocument);
        out.resetFileData();

        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);


        EventPage.app.scrape(inspectionOptions)
            .finally(EventPage.undefineApp);
    }


    /**
     * Scrape the current page for <video>s.
     */
    static goScrapeVideos(parentDocument) {
        var inspectionOptions = new InspectionOptions(false, false, true, true, false, true);

        var out = window[GCon.WIN_PROP.OUTPUT_INST];
        out.setDoc(parentDocument);
        out.resetFileData();

        var scraper = new Scraper();
        var digger = new Digger(scraper, inspectionOptions);
        EventPage.app = new App(digger, scraper);
        

        EventPage.app.scrape(inspectionOptions)
            .finally(EventPage.undefineApp);
    }


    /**
     * Set the EventPage.app back to undefined on process completion.
     */
    static undefineApp() {
        EventPage.app = undefined;
    }


    /**
     * For the stop button. EventPage has the closure variable "EventPage.app" always
     * set to the currently running instance of App.
     */
    static stopHarvesting(parentDocument) {
        var out = window[GCon.WIN_PROP.OUTPUT_INST];
        out.setDoc(parentDocument);

        if (!!EventPage.app) {   
            out.hideStopButton();
            out.toOut('Stopping...');
            EventPage.app.stopHarvesting();
        }
        else {
            out.toOut('No digging or scraping in progress. There is nothing to stop.');
        }
    }
}

window[GCon.WIN_PROP.EVENTPAGE_ST] = EventPage;

export default EventPage;