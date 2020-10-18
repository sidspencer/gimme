/****
 * This file contains commonly-used constants. All the object
 * classes are exported, the constants "Con" is the
 * default export.
 ****/


/*********************************************
 * Static Constant Classes -> set on "Con".
 *********************************************/


/**
 * Properties on the Window object. 
 * (all bg, popup, and opts windows'.)
 */
class WinProp {
    // For singleton class instances.
    static POPUP_INST = 'Gimme_Popup_Inst';
    static CONTENT_PEEPER_INST = 'GimmeGimmeGimme_ContentPeeper_Inst';
    static OUTPUT_INST = 'Gimme_Output_Inst';

    // For classes. Utils and logicker are static classes. 
    static EVENT_PAGE_CLASS = 'Gimme_EventPage';
    static APP_CLASS = 'Gimme_App';
    static VOYEUR_CLASS = 'Gimme_Voyeur';
    static DIGGER_CLASS = 'Gimme_Digger';
    static SCRAPER_CLASS = 'Gimme_Scraper';
    static LOGICKER_CLASS = 'Gimme_Logicker';
    static OUTPUT_CLASS = 'Gimme_Output';
    static UTILS_CLASS = 'Gimme_Utils';
    static OPTIONATOR_CLASS = 'Gimme_Optionator';
    static DOMINATRIX_CLASS = 'Gimme_Dominatrix';
}


/**
 * Object Keys, and prefixes or suffixes for object keys.
 */
class Key {
    static LISTENER_PREFIX = "listenerx-";
}


/**
 * IDs for elements in the Popup HTML.
 */
class PopupElementId {
    // Divs.
    static ACTION_HOLDER = 'actionHolder';
    static BUTTON_HOLDER = 'buttonHolder';
    static MAIN_BUTTONS_HOLDER = 'mainButtonsHolder';
    static SCRAPING_BUTTONS_HOLDER = 'scrapingButtonsHolder';
    static DIGGING_BUTTONS_HOLDER = 'diggingButtonsHolder';
    static STOP_BUTTON_HOLDER = 'stopButtonHolder';
    static FILES_DUG = 'filesDug';
    static OUTPUT = 'output';

    // Buttons
    static GET_ALL_FILE_OPTS = 'getAllFileOptsButton';
    static GET_ALL_JPG_OPTS = 'getAllJpgOptsButton';
    static TOGGLE_VOYEUR = 'toggleVoyeurButton'
    static DIG_GALLERY = 'digGalleryButton';
    static DIG_FILE_OPTIONS = 'digFileOptionsButton';
    static DIG_GALLERY_GALLERY = 'digGalleryGalleryButton';
    static SCRAPE_FILE_OPTIONS = 'scrapeFileOptionsButton';
    static STOP = 'stopButton';
    static RESUME = 'resumeButton';
    static DIG = 'digButton';
    static DIG_VIDEO_GALLERY = 'digVideoGalleryButton';
    static DIG_IMAGE_GALLERY = 'digImageGalleryButton';
    static SCRAPE = 'scrapeButton';
    static SCRAPE_VIDEOS = 'scrapeVideosButton';
    static SCRAPE_IMAGES = 'scrapeImagesButton';
    static CLEAR_FILE_LIST = 'clearFileListButton';

    // ID prefixes used programattically.
    static FE_PREFIX = 'fileEntry';
    static CB_PREFIX = 'cbFile';
}


/**
 * State of a file entry. Usually corresponds to a Popup CSS Class.
 */
class FileEntryStateClass {
    static DOWNLOADING = 'downloading';
    static DUG = 'dug';
    static FAILED = 'failed';
    static FOUND = 'found';
    static OPT = 'opt';
}


/**
 * Action key-strings.
 */
class Action {
    static STOP = 'stop';
    static RESUME = 'resume';
    static GET = 'GET';
    static POST = 'POST';
    static PEEPAROUND = 'peepAround';
    static DIG = 'dig';
    static SCRAPE = 'scrape';
    static DIG_GG = 'digGalleryGallery';
}


/**
 * Values used by the chrome.downloads system.
 */
class DownloadState {
    static INP = 'in_progress';
    static INT = 'interrupted';
    static CPT = 'complete';
}

class DownloadDeltaKey {
    static ID = 'id';
    static FINAL_URL = 'finalUrl';
    static FILENAME = 'filename';
    static DANGER = 'danger';
    static MIME = 'mime';
    static START_TIME = 'startTime';
    static END_TIME = 'endTime';
    static STATE = 'state';
    static CAN_RESUME = 'canResume';
    static PAUSED = 'paused';
    static ERROR = 'error';
    static TOTAL_BYTES = 'totalBytes';
    static FILE_SIZE = 'fileSize';
    static EXISTS = 'exists';
}


/**
 * Values to use as defaults when the real object is blank.
 */
class StringToken {
    static E = '';
    static D = '.';
    static WHACK = '/';
    static W = StringToken.WHACK;
    static WW = StringToken.W + StringToken.W;
    static COL = ':';
    static CWW = StringToken.COL + StringToken.WW;
    static DASH = '-';
    static BANG = '!';
    static Q_MK = '?';
    static START_P = '(';
    static END_P = ')';
    static URL = 'url';
    static URL_P = StringToken.URL + StringToken.START_P;
    static TICK = '\'';
    static QUOTE = '"';
    static HASH = '#';
    static STOP_BANG = '<STOP>' + StringToken.BANG;
}


/**
 * Used whenever someone refers to the access method of the file.
 */
class AccessWay {
    // Bare protocol names.
    static HTTP = 'http';
    static HTTPS = 'https';
    static E = 'extension';
    static CH_E = `chrome-${AccessWay.E}`;
    static MZ_E = `moz-${AccessWay.E}`;
    static ED_E = `${AccessWay.E}`;
    static FILE = 'file';
    static FTP ='ftp';

    // The colon and two whacks.
    static CWW = StringToken.CWW;

    // The protocol names with '://' on them.
    static HTTP_CWW = AccessWay.HTTP + AccessWay.CWW;
    static HTTPS_CWW = AccessWay.HTTPS + AccessWay.CWW;
    static E_CWW = AccessWay.E + AccessWay.CWW;
    static CH_E_CWW = AccessWay.CH_E + AccessWay.CWW;
    static MZ_E_CWW = AccessWay.MZ_E + AccessWay.CWW;
    static ED_E_CWW = AccessWay.ED_E + AccessWay.CWW;
    static FILE_CWW = AccessWay.FILE + AccessWay.CWW;
    static FTP_CWW = AccessWay.FTP + AccessWay.CWW;   
}


/**
 * Names of Events. For setting up handlers.
 */
class EventName {
    static LOAD = 'load';
    static RSC = 'readystatechange';
    static COMPLETE = 'complete';
    static CLICK = 'click';
    static STOP = 'stop';
    static RESUME = 'resume';
}


/**
 * Mime-Types and response types.
 */
class DocType {
    static HTML = 'text/html';
    static JSON = 'application/json';
    static DOC = 'document';
    static BLOB = 'blob';
    static DATA = 'data'
}


/**
 * Oft-used selector properties.
 */
class SelectorProperties {
    // Selector Props
    static SCOPE = ':scope';
    static HREF = 'href';
    static SRC = 'src';
    static FOR = 'for';
    static STYLE = 'style';
    
    // Tag Names
    static IMG = 'img';
    static A = 'a';
    static DIV = 'div';
    static CB = 'checkbox';
    static INPUT = 'input';
    static LI = 'li';
    static IMG = 'img';
    static LABEL = 'label';
    static IFRAME = 'iframe';

    // For special properties.
    static R = 'response';
    static R_XML = 'responseXML';
}  


/**
 * Canned selectors
 */
class DefaultSelector {
    static A_HREF = `a[${SelectorProperties.HREF}]`;
    static IMG_SRC = `img[${SelectorProperties.SRC}]`;
    static SC_IMG = `${SelectorProperties.SCOPE} img`;
    static CLICK_PROPS = [ 'onclick', 'href' ];
    static PROP_PATHS = [ 'src', 'currentSrc', 'dataset.src' ];
    static DEFAULT_SELECTOR = ':scope *';
    static ALL_JS_SELECTOR = ':scope *[onclick],*[onmouseover],*[onmouseout],*[onmouseenter],*[onchange],*[href^="javascript:"],script';    
}  


/**
 * Constnt for CSS class names.
 */
class CssClassName {
    static OPT = 'opt';
    static PHOTO = 'photo';
}


class CssValue {
    static DISPLAY = {
        NONE: 'none',
        BLOCK: 'block',
        IL_BLOCK: 'inline-block',
    };
}


/**
 * Name of class/module to identify log entries.
 */
class LogSourceToken {
    static APP = '[App]';
    static DIGGER = '[Digger]';
    static EVENTPAGE = '[EventPage]';
    static LOGICKER = '[Logicker]';
    static OUTPUT = '[Output]';
    static SCRAPER = '[Scraper]';
    static UTILS = '[Utils]';
    static VOYEUR = '[Voyeur]';
    static POPUP = '[Popup]';
    static OPTIONATOR = '[Optionator]'; 
    static DOMINATRIX = '[Dominatrix]';
    static CONTENT_PEEPER = '[ContentPeeper]';
    static DEFAULT = '[Gimme*3]';
}


/**
 * Colors used for the badge.
 */
class Color {
    static AVAILABLE_FOPTS = { color:  [247, 81, 158, 255] };
    static NEW_FOPTS = { color: '#4444ff' };
    static NEWLY_DUG = { color: '#111111' };
    static SCRAPED = { color: '#9999FF' };
    static DOWNLOADING = { color: '#009900' };
}


/**
 * The kinds of scraping digger might do.
 */
class DiggerScrapeKey {
    static IMGS = 'imgs';
    static CSS_BGS = 'cssBgs';
    static VIDEOS = 'videos';
    static JS = 'js';
    static AUDIOS = 'audios';
    static QS = 'qs';
};


/**
 * The depth of search digger should do.
 */
class SearchDepth {
    static SKIM =  1;
    static LARGEST_IMAGE =  2;
    static INSPECT =  3;
    static TF_MATCH =  4;
    static DIG_DEEPER =  5;
};


/**
 * Default values from our prefs/options page for Digger.
 */
class DiggerConfiguration {
    static BATCH_SIZE = 3;
    static CHANNELS = 11;
}


/**
 * Default values from our prefs/options page for Logicker.
 */
class LogickerConfiguration {
    static IMAGE_SIZE = 224;
    static CLASSIFICATIONS = 20;
    static SCORE_CUTOFF = 0.1;
    static URL_EXTRACTING_REGEX = new RegExp(
        `(url\\()?('|")?(http|https|data|blob|file|-${AccessWay.E})\\:.+?\\)?('|")?\\)?`, 
        'i'
    );
    static MIN_ZOOM_HEIGHT = 250;
    static MIN_ZOOM_WIDTH = 250;
    static ANONYMOUS = 'anonymous';
}


/**
 * Default values from our prefs/options page for Utils.
 */
class UtilsConfiguration {
    static LISTENER_TIMED_OUT = 'Listener timed out';
    static LISTENER_TIMEOUT = 7000;
    static CONCURRENT_DOWNLOADS = '10';
    static DEFAULT_IFRAME = 'background_iframe';
    static DL_SPACING_MS = 777;
}


/**
 * Default filename if we get a URI with a very bad filename.
 */
class FileNamingConstants {
    static DEFAULT_FN = 'g_img.jpg';
    static W_BACKGROUND_W = '/background/';
    static PREVIEWS_W = 'previews/';
    static W_PREVIEWS_W = `/${FileNamingConstants.PREVIEWS_W}`;
    static DOWNLOADS_DIR = 'Gimme-site_pagename-tmp';
}


/**
 * Verbs allowed for the Logicker's post-processing of galleryMaps.
 */
class PostProcessingVerb {
    static REPLACE = 'replace';
}


/**
 * Static class for holding the constants regarding options. The
 * whole options page is driven off of these values
 */
class OptionsConfiguration {
    // Special value to enable alllllll the buttons. Even the ones that barely work.
    static HALF_BAKED_VAL = "-1";

     // Enumeration of the spec form sections.
    static SECTIONS = {
        CONFIG: 'CONFIG',
        MESSAGES: 'MESSAGES',
        PROCESSINGS: 'PROCESSINGS',
        BLESSINGS: 'BLESSINGS',
    };

    // The top-level storage key for gallery definitions. For now, keep separate from the "spec" obj.
    // TODO: figure out how to merge galleryDefs and messages.
    static GALLERY_DEFS = 'galleryDefs';

    // Enumeration of the labels to use for the spec form elements.
    static LABELS = {
        CONFIG: {
            concurrentDls: 'number of allowed concurrent downloads',
            minZoomWidth: 'min full-sized image width',
            minZoomHeight: 'minimum full-sized image height',
            dlChannels: 'number of download channels for gallery-gallery-digs',
            dlBatchSize: 'number of downloads in a batch for gallery-gallery-digs',
            knownBadImgRegex: 'regex to match image uris that are never what we are looking for',
            enableHalfBakedFeatures: `enable all the half-baked features with a "${OptionsConfiguration.HALF_BAKED_VAL}" in this box`, 
        },
        MESSAGES: {
            match: 'regex to match the site uri',
            link: 'css selector for getting the link element pointing to the full-sized image page',
            href: 'javascript property path for getting the proper link uri from the link element',
            thumb: 'css scoped sub-selector of the thumbnail image element relative to the link element',
            src: 'javascript property path for getting the proper thumbnail source uri from the thumbnail element',
        },
        PROCESSINGS: {
            match: 'regex to match the site uri',
            actions: 'list of transformations to do on the matched uri',
            actions_noun: 'do matching on the thumbnail image uri (src), or the link uri (href)',
            actions_verb: 'the type of uri transformation to do (ie "replace")',
            actions_match: 'regex for what text in the selected src/href to replace/transform',
            actions_new: 'new text for replacing/transforming the matched text of the uri',
            dig: 'force always use dig-engine discovery of full-sized images',
            scrape: 'force always use scrape-engine discovery of thumbnail images',
        },
        BLESSINGS: {
            match: 'regex to match the site uri of detail pages containing the full-sized image',
            zoom: 'css selector for the full-sized image element on the page',
            src: 'javascript property path for getting the full-sized image source uri from the image element',
        },
    };
    
    // These are the default spec.config reference values.
    // (SpecGeneralConfig is the duck-type class used here.)
    static CANNED_CONFIG = {
        concurrentDls: '10',
        minZoomWidth: '300',
        minZoomHeight: '300',
        dlChannels: '5',
        dlBatchSize: '5',
        knownBadImgRegex: '/\\/(logo\\.|loading|header\\.jpg|premium_|preview\\.png|holder-trailer-home\\.jpg|logo-mobile-w\\.svg|logo\\.svg|logo-desktop-w\\.svg|user\\.svg|speech\\.svg|folder\\.svg|layers\\.svg|tag\\.svg|video\\.svg|favorites\\.svg|spinner\\.svg|preview\\.jpg)/i',
        enableHalfBakedFeatures: '0',
    };

    // The default spec.processings example reference values.
    // (SpecProcessing and SpecProcessingAction are the duck-type classes used here.)
    static CANNED_PROCESSINGS = [
        {
            match: 'fakeexample.fake',
            actions: [
                {
                    noun: 'src',
                    verb: 'replace',
                    match: '/^t-/',
                    new: 'big-'
                },
                {
                    noun: 'href',
                    verb: 'replace',
                    match: '/\\/fakeout\\//',
                    new: '/realpath/'
                }
            ],
            dig: true,
            scrape: false,
        }
    ];
    
    // The default spec.messages example gallery-defining reference values.
    // (SpecMessage is the duck-type class used here.)
    static CANNED_MESSAGES = [
        {
            match: 'fakeexample.fake',
            link: 'a.link[href]',
            href: 'href',
            thumb: 'img.thumb[data-src]',
            src: 'dataset.src',
        }
    ];

    // The default spec.blessings example reference value.
    // (SpecBlessing is the duck-type class used here.)
    static CANNED_BLESSINGS = [
        {
            match: 'fakeexample.fake',
            zoom: 'img.zoomed',
            src: 'src',
        }
    ];

    // This is the default value for the chrome.storage key "spec".
    // (ConfigSpec is the duck-type class used here.)
    static DEFAULT_SPEC = {
        config: OptionsConfiguration.CANNED_CONFIG,
        messages: OptionsConfiguration.CANNED_MESSAGES,
        processings: OptionsConfiguration.CANNED_PROCESSINGS,
        blessings: OptionsConfiguration.CANNED_BLESSINGS,
    };
};


/**
 * Configuration constants for Dominatrix on the options page.
 */
class DominatrixConfiguration {
    static ENTRY_DIV_PREFIX = 'entry_';
    static SUB_ENTRY_DIV_PREFIX = 'subentry_';
    static VALUE_PREFIX = 'value_';
    static ADD_SUB_ENTRY_PREFIX = 'addsubentry_';
    static ENTRY_CLASS = 'entry';
    static SUB_ENTRY_CLASS = 'subentry';
    static DELETE_BUTTON_CLASS = 'delete';
    static ADD_SUB_ENTRY_CLASS = 'addSubentry';
    static DELETE_BUTTON_TEXT = 'X';
 }



/**
 * Regexes used to recognize types of files off their name.
 */
class RecognizingRegex {
    static ALL_MEDIA = /(\'|\").+?\.(jpg|png|gif|mp4|flv|wmv|webm|mov)\.[\?].+?(\'|\")/g;
    static AUDIO = /(mp3|m4a|aac|wav|ogg|aiff|aif|flac)/i;
    static VIDEO = /(mp4|flv|f4v|m4v|mpg|mpeg|wmv|mov|avi|divx|webm)/i;
    static IMAGE = /(jpg|jpeg|gif|png|tiff|tif|pdf)/i; 
    static PROTOCOL =  /^(http|https|data|blob|chrome|chrome-extension)\:/;
    static SUPPORTED = /\.(jpg|jpeg|png|gif|tiff|mpg|mp4|flv|avi|zip|tar|gz|mp3|ogg|aac|m4a)$/i;
}


/**
 * Regexes to match mime types. 
 * (It's sub-optimal)
 */
class MimeTypeRegex {
    static DOCUMENT = {
        'PDF': /application\/pdf/,
        'HTML': /text\/html/,
    };
    static VIDEO = {
        'MP4': /(video|audio|application)\/mp4/,
    };
    static AUDIO = {
        'MP3': /audio\/mpeg/,
        'AAC': /audio\/x-aac/,
        'OC_ST': /application\/octet-stream/,
    };
    static IMAGE = {
        'JPG': /image\/jpeg/,
        'PNG': /image\/png/,
        'GIF': /image\/gif/,
        'TIFF': /image\/tiff/,
    }
    static ALLMEDIA = /(image|application|audio|video)\/(jpg|jpeg|png|gif|tiff|mpg|mp4|flv|avi|zip|tar|gz|mp3|ogg|aac|m4a)/;
    static ALLSUPPORTED = /(image|application|audio|video|text)\/(jpg|jpeg|png|gif|tiff|mpg|mp4|flv|avi|zip|tar|gz|mp3|ogg|aac|m4a|html|xhtml|rtf|pdf|octet-stream)/;
}


/**
 * class for default values, sundry extensions.
 */
class BlankValue {
    static LOCALHOST = 'localhost';
    static LOC = { 
        protocol: AccessWay.HTTP,
        hostname: BlankValue.LOCALHOST,
        port: 80,
        pathname: BlankValue.GALLERY,
        search: StringToken.Q_MK + 'q=text',
        hash: StringToken.HASH + 'section1',        
        host: this.hostname + (!!this.port ? (StringToken.COL + this.port) : StringToken.E),
        origin: this.protocol + StringToken.WW + this.host,
        href: this.origin + this.pathname + this.search + this.hash,
    };
    static GALLERY = '/gallery';
    static PR_RJ = false;
    static PR_RS = true;
    static MAP = {};
    static ARR = [];
}


/**
 * Static class for the values of our page names.
 */
class PageName {
    static POPUP = 'popup.html';
    static OPTIONS = 'options.html';
    static BACKGROUND = 'background.html';
}


/**
 * Common, tiny functions. E (empty) will be used the most. It formally takes ten parameters,
 * but this is JS so you needn't pass any! Muhahahaha! 
 */
class CannedFunctions {
    static E = ( () => undefined );
    static PR_RJ = ( (payloadIn, outVal) => Promise.reject((!!outVal ? outVal : BlankValue.PR_RJ)) ); 
    static PR_RS = ( (payloadIn, outVal) => Promise.resolve((!!outVal ? outVal : BlankValue.PR_RJ)) );
    static PR_RJ_STOP = ( () => Promise.reject(Action.STOP) );
    static PR_RS_STOP = ( () => Promise.resolve(Action.STOP) );
    static PR_RJ_DEF = ( () => Promise.reject(BlankValue.PR_RJ) );
    static PR_RS_DEF = ( () => Promise.resolve(BlankValue.PR_RS) );
}


/**
 * The exported Static Constants class.
 */
class C {
    static WIN_PROP = WinProp;
    static ACTION = Action;
    static DOC_TYPE = DocType;
    static WAY = AccessWay;
    static EVT = EventName;
    static DEF_SEL = DefaultSelector;
    static SEL_PROP = SelectorProperties;
    static LOG_SRC = LogSourceToken;
    static COLOR = Color;
    static ELEMENT_ID = PopupElementId;
    static FE_STATE = FileEntryStateClass;
    static DS_KEY = DiggerScrapeKey;
    static SEARCH_DEPTH = SearchDepth;
    static BLANK = BlankValue;
    static RECOG_RGX = RecognizingRegex;
    static MIMETYPE_RGX = MimeTypeRegex;
    static DIG_CONF = DiggerConfiguration;
    static L_CONF = LogickerConfiguration;
    static UTILS_CONF = UtilsConfiguration;
    static OPT_CONF = OptionsConfiguration;
    static DOMX_CONF = DominatrixConfiguration;
    static ST = StringToken;
    static CSS_CN = CssClassName;
    static CSS_V = CssValue;
    static F_NAMING = FileNamingConstants;
    static PP_VERB = PostProcessingVerb;
    static PAGE = PageName;
    static CAN_FN = CannedFunctions;
    static KEY = Key;
    static DLS = DownloadState;
    static DLDK = DownloadDeltaKey;
}


// Exporting the Constants holder class.
export default C; 
