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

    static logBare(message) {
        console.log(`[gimme3] ${message}`);
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
    optCount = 0;
    searchDefault = true;

    // Individual type settings. Do or do not allow as zoom-media?
    imgs = this.searchDefault;
    cssBgs = this.searchDefault;
    videos = this.searchDefault;
    js = this.searchDefault;
    audios = this.searchDefault;
    qs = this.searchDefault;

    constructor(i, c, v, j, a, q) {
        // Empty args means use the defaults -- true for all!
        if (arguments.length === 0) { return; };

        // Only set the values we get. The rest stay at default val.
        this.optCount = arguments.length;
        if (this.optCount > 0) { this.imgs = i; }
        if (this.optCount > 1) { this.cssBgs = c; }
        if (this.optCount > 2) { this.videos = v; }
        if (this.optCount > 3) { this.js = j; }
        if (this.optCount > 4) { this.audios = a; }
        if (this.optCount > 5) { this.qs = q; }
    }

    /**
     * Set the search/don't-search pref for any search type
     * not explicitly set in the constructor.
     */
    overrideSearchDefault(df) {
        this.searchDefault = !!df;

        // Only override options we didn't get. That is why we store
        // the arg count the constructor got.
        if (this.optCount === 6) { return; }
        if (this.optCount < 6) { this.qs = this.searchDefault; }
        if (this.optCount < 5) { this.audios = this.searchDefault; }
        if (this.optCount < 4) { this.js = this.searchDefault; }
        if (this.optCount < 3) { this.videos = this.searchDefault; }
        if (this.optCount < 2) { this.cssBgs = this.searchDefault; }
        if (this.optCount < 1) { this.imgs = this.searchDefault; }
    }
}


/**
 * Names of properties put in local and sync storage.
 */
class Storing {
    static PREV_URI_MAP = 'prevUriMap';
    static SPEC = 'spec';
    static GALLERY_DEFS = 'galleryDefs';
    

    /**
     * Build the stored object form of the prevUriMap.
     * @param {}
     */
    static buildPrevUriMapStoreObj(m) {
        var obj = {};
        obj[Storing.PREV_URI_MAP] = m;
        return obj;
    }  


    /**
     * Build an object formed to save the galleryDefs in chrome.storage.
     * If passed a bad gDefs, we return an empty object.
     * 
     * @param {Array<GalleryDef>} gDefs 
     */
    static buildGalleryDefsStoreObj(gDefs) {
        var obj = {};
        obj[Storing.GALLERY_DEFS] = gDefs;
        return obj;
    }


    /**
     * Wrap the "spec" key for storage.
     * 
     * @param {ConfigSpec} configSpec 
     */
    static buildConfigSpecStoreObj(configSpec) {
        var obj = {};
        obj[Storing.SPEC] = configSpec;
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
 * For the Logicker, a match score added to the pair.
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
 * For storing discovered gallery structure.
 */
class GalleryDef {
    galleryUri = C.ST.E;
    thumbSel = C.ST.E;
    thumbSrcProp = 'src';
    linkSel = C.ST.E;
    linkHrefProp = 'href';

    constructor(gu, ts, tsp, ls, lsp) {
        this.galleryUri = gu;
        this.thumbSel = ts;
        this.thumbSrcProp = tsp;
        this.linkSel = ls;
        this.linkHrefProp = lsp;
    }


    /**
     * Static initializer that takes a duck-typed gallery def, and
     * returns a built gallery def.
     * @param {*} o 
     */
    static fromStorage(o) {
        return new GalleryDef(
            o.galleryUri, 
            o.thumbSel, 
            o.thumbSrcProp, 
            o.linkSel, 
            o.linkHrefProp
        );
    }


    /**
     * These two objects need to merge.
     * In the meantime...
     */
    toSpecMessage() {
        return new SpecMessage(
            this.galleryUri,
            this.linkSel,
            this.linkHrefProp,
            this.thumbSel,
            this.thumbSrcProp
        );
    }
}


/**
 * Per-site gallery definition configuration. For the "spec.messages" 
 * stored array value.
 */
class SpecMessage {
    match = C.ST.E;
    link = C.ST.E;
    href = 'href';
    thumb = C.ST.E;
    src = 'src';

    constructor(m, l, h, t, s) {
        this.match = m;
        this.link = l;
        this.href = h;
        this.thumb = t;
        this.src = s;
    }


    /**
     * These two objects need to merge.
     * In the meantime...
     */
    static toGalleryDef() {
        return new GalleryDef(
            this.match,
            this.thumb,
            this.src,
            this.link,
            this.href
        );
    }
}


/**
 * Per-URL manipulation procedure to turn thumbSrc or linkHref into 
 * the zoom URI. Currently the only supported verb is "replace".
 * This class is used for SpecProcessing.actions. 
 */
class SpecProcessingAction {
    static VERB_REPLACE = 'replace';

    noun = C.ST.E;
    verb = SpecProcessingAction.VERB_REPLACE;
    match = C.ST.E;
    new = C.ST.E;

    constructor(n, v, m, n2) {
        this.noun = n;
        this.verb = v;
        this.match = m;
        this.new = n2;
    }
}


/**
 * Per-site manipulation procedures that have "actions" to 
 * calculate zoom URIs. For the "spec.processings" stored array value.
 */
class SpecProcessing {
    match = C.ST.E;
    actions = []; // an Array<SpecProcessingAction>
    dig = true;
    scrape = true;

    constructor(m, a, d, s) {
        this.match = m;
        this.actions = (Array.isArray(a) ? a : []);
        this.dig = d;
        this.scrape = s;
    }
}


/**
 * Per-URL regex match for one site's zoom image pages (match), along with the
 * selector to the zoom image (zoom), and element prop to get full-sized URL from (src). 
 */
class SpecBlessing {
    match = C.ST.E;
    zoom = C.SEL_PROP.IMG;
    src = C.SEL_PROP.SRC;

    constructor(m, z, s) {
        this.match = m;
        this.zoom = z;
        this.src = s;
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
 * The type for the "config" member of the ConfigSpec object.
 */
class SpecGeneralConfig {
    concurrentDls = '10';
    minZoomWidth = '0';
    minZoomHeight = '0';
    dlChannels = '5';
    dlBatchSize = '5';
    knownBadImgRegex = /^fake_fake_fake$/;
    enableHalfBakedFeatures = '0'; // '-1' enables them.

    constructor(cd, mzw, mzh, dlc, dlbs, kbir, ehbf) {
        this.concurrentDls = cd;
        this.minZoomWidth = mzw;
        this.minZoomHeight = mzh;
        this.dlChannels = dlc;
        this.dlBatchSize = dlbs;
        this.knownBadImgRegex = kbir;
        this.enableHalfBakedFeatures = ehbf;
    }
}


/**
 * The type for the "spec" chrome.storage key.
 */
class ConfigSpec {
    config = {};       // SpecGeneralConfig instance
    messages = [];     // Array<SpecMessage>
    processings = [];  // Array<SpecProcessing>
    blessings = [];    // Array<SpecBlessing>

    constructor(c, m, p, b) {
        this.config = c;
        this.messages = m;
        this.processings = p;
        this.blessings = b;
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
    GalleryDef,
};
