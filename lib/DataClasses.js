import { default as C } from './C.js';

/*********************************************
 * Data classes. They hold data.
 *********************************************/

 
 /**
  * Digging/Scraping opts, set by Logicker from the message options.
  */
 class DigOpts {
    doScrape = true;
    doDig = true;

    constructor(s, d) {
        this.doScrape = s;
        this.doDig = d;
    }
}


/**
 * LocDoc -- the locator and associated document.
 */
class LocDoc {
    loc = undefined;
    doc = undefined;

    constructor(l, d) {
        this.loc = l;
        this.doc = d;
    }
}


/**
 * Class for messages sent to the ContentPeeper.
 */
class ContentMessage {
    static GIMME_ID = 'gimmegimmegimmie';
    static CONTENTPEEPER = 'contentpeeper';

    command = C.ACTION.PEEPAROUND;
    linkSelector = C.DEF_SEL.A_HREF;
    linkHrefProp = C.SEL_PROP.HREF;
    thumbSubselector = C.DEF_SEL.SC_IMG;
    thumbSrcProp = C.SEL_PROP.SRC;
    useRawValues = false;

    constructor(com, lSel, lHrefProp, tSubSel, tSrcProp, raw) {
        if (arguments.length === 0) { return; };

        this.command = com;
        this.linkSelector = lSel;
        this.linkHrefProp = lHrefProp;
        this.thumbSubselector = tSubSel;
        this.thumbSrcProp = tSrcProp;
        this.useRawValues = raw;
    }
}


class Log {
    ls = C.LOG_SRC.APP;

    constructor(logSourceName) {
        this.ls = logSourceName;
    }

    log(message) {
        console.log(`${this.ls} ${message}`);
    }
}

/**
 * Class for messages sent FROM the ContentPeeper.
 */
class ContentPeeperMessage {
    content = undefined;
    uri = undefined;
    docOuterHtml = undefined;

    constructor(c, u, d) {
        this.content = c;
        this.uri = u;
        this.docOuterHtml = d;
    }
}

/**
 * Class for the tab-id + message sent to ContentPeeper.
 */
class TabMessage {
    tab = undefined;
    message = undefined;

    constructor(t, m) {
        this.tab = t;
        this.message = m;
    }
}


/**
 * Class for building the image-and-checkbox file options.
 */
class FileOption {
    id = undefined;
    uri = undefined;
    thumbUri = undefined;
    filePath = undefined;
    onSelect = undefined;

    constructor(i, u, t, f, o) {
        this.id = i;
        this.uri = u;
        this.thumbUri = t;
        this.filePath = f;
        this.onSelect = o;
    }
}


/**
 * Lightweight file entry.
 */
class FileEntry {
    id = undefined;
    uri = undefined;

    constructor(i, u) {
        this.id = i;
        this.uri = u;
    }
}

/**
 * The options object passed to Digger.digGallery(...)
 */
class GalleryOptions {
    doc = undefined;
    loc = undefined;
    digOpts = {};
    galleryMap = {};

    constructor(d, l, o, g) {
        this.doc = d;
        this.loc = l;
        this.digOpts = o;
        this.galleryMap = g;
    }
}


/**
 * The options passed to Scraper.scrape(...)
 */
class ScrapeOptions {
    node = undefined; 
    loc = undefined; 
    opts = {};

    constructor(n, l, o) {
        this.node = n;
        this.loc = l;
        this.opts = o;
    }
}


/**
 * Passed to Digger, Used by the event page
 */
class InspectionOptions {
    imgs = true;
    cssBgs = true;
    videos = true;
    js = true;
    audios = true;
    qs = true;

    constructor(i, c, v, j, a, q) {
        if (arguments.length === 0) { return; };

        var v = false;
        if (arguments.length === 1) { v = true; }

        this.imgs = i || v;
        this.cssBgs = c || v;
        this.videos = v || v;
        this.js = j || v;
        this.audios = a || v;
        this.qs = q || v;
    }
}


/**
 * Names of properties put in local and sync storage.
 */
class Storing {
    static PREV_URI_MAP = 'prevUriMap';
    
    static storePrevUriMap(m) {
        var obj = {};
        obj[Storing.PREV_URI_MAP] = m;

        return obj;
    }  
}


/**
 * For the Harvested Uri Pairs.
 */
class UriPair {
    thumbUri = undefined;
    zoomUri = undefined;

    constructor(t, z) {
        this.thumbUri = t;
        this.zoomUri = z;
    }
}


/**
 * 
 */
class ScoredUriPair {
    thumbUri = undefined;
    zoomUri = undefined;
    score = 0.0;

    constructor(t, z, s) {
        this.thumbUri = t;
        this.zoomUri = z;
        this.score = s;
    }
}


/**
 * Logicker processing instructions.
 */
class ProcessingInstructions {
    doDig = true;
    doScrape = true;
    processedMap = {};

    constructor(dig, scrape, map) {
        this.doDig = dig;
        this.doScrape = scrape;
        this.processedMap = map;
    }
}


/**
 * Definition of a Scrape procedure.
 */
class ScrapeDefinition {
    root = undefined;
    loc = undefined;
    selector = undefined;
    propPaths = [];

    constructor (r, l, s, p) {
        this.root = r;
        this.loc = l;
        this.selector = s;
        this.propPaths = p;
    }
}


/**
 * Definition of a download
 */
class DownloadSig {
    id = undefined;
    uri = undefined;
    fileName = undefined;

    constructor(i, u, f) {
        this.id = i;
        this.uri = u;
        this.fileName = f;
    }
}


/**
 * The last location. Can "duck-type" as a Location obj.
 */
class LastLoc {
    // The two that are generally used
    hostname = undefined;
    pathname = undefined;

    // Other Location properties.
    href = undefined;
    protocol = undefined;
    host = undefined;
    port = undefined;
    search = undefined;
    hash = undefined;
    origin = undefined;


    /**
     * Constructor of LastLoc. 
     * host and path params are always expected.
     * The other 4 params are at your discretion.
     */
    constructor(host, path, protocol, port, search, hash) {
        // The "LastLoc core" properties.
        this.hostname = host;
        this.pathname = path;
        
        // The required Location "duck-type" properties.
        this.protocol = protocol;
        this.port = port;
        this.search = search;
        this.hash = hash;

        // Calculate host, origin, and href.
        this.host = this.hostname + (!!this.port ? (C.ST.COL + this.port) : C.ST.E);
        this.origin = this.protocol + C.ST.WW + this.host;
        this.href = this.origin + this.pathname + this.search + this.hash;
    }
}


/**
 * An config option shown on the Options page.
 */
class OptionEntry {
    label = undefined;
    text = undefined;
    key = undefined;

    constructor(l, t, k) {
        this.label = l;
        this.text = t;
        this.key = k;
    }
}


/**
 * height/width descriptor. Used for Images by Logicker.
 */
class Dimensions {
    height = 0;
    width = 0;

    constructor(h, w) {
        this.height = h;
        this.width = w;
    }
}


/**
 * An event type for STOP
 */
class StopEvent extends Event {
    constructor() {
       // Make a map to pass to the Event constructor.
        var obj = {};
        obj['timestamp'] = Date.now();
        obj[C.ACTION.STOP] = C.ACTION.STOP;
        obj[C.ACTION.STOP.toLowerCase()] = C.ACTION.STOP.toLowerCase();

        // Call super to set us all up.
        super(C.ACTION.STOP, obj);
    }
}


/**
 * An event type for the not-yet-implemented RESUME (after a stop)
 */
class ResumeEvent extends Event {
    constructor() {
       // Make a map to pass to the Event constructor.
        var obj = {};
        obj['timestamp'] = Date.now();
        obj[C.ACTION.RESUME] = C.ACTION.RESUME;
        obj[C.ACTION.RESUME.toLowerCase()] = C.ACTION.RESUME.toLowerCase();

        // Call super to set us all up.
        super(C.ACTION.RESUME, obj);
    }
}



// Export all these data classes.
export {
    Log,
    DigOpts, 
    ContentMessage,
    ContentPeeperMessage,
    TabMessage,
    LocDoc,
    FileOption,
    FileEntry,
    GalleryOptions,
    ScrapeOptions,
    Storing,
    InspectionOptions,
    UriPair,
    ScoredUriPair,
    ProcessingInstructions,
    ScrapeDefinition,
    DownloadSig,
    LastLoc,
    OptionEntry,
    Dimensions,
    StopEvent,
    ResumeEvent,
};