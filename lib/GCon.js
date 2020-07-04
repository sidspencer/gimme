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
    static APP_CLASS = 'appClass';
    static DIGGER_CLASS = 'diggerClass';
    static SCRAPER_CLASS = 'scraperClass';
    static OUTPUT_INST = 'theOutput';
    static POPUP_INST = 'thePopup';
    static LOGICKER_ST = 'staticLogicker';
    static EVENTPAGE_ST = 'staticEventPage';
    static UTILS_ST = 'staticUtils';
    static OPTIONATOR_ST = 'staticOptionator';
    static DOMINATRIX_ST = 'staticDominatrix';
    static CONSTANCE_ST = 'staticConstance';
    static CONTENTPEEPER_INST = 'GimmeGimmeGimme_ContentPeeper';
}


/**
 * IDs for elements in the Popup HTML.
 */
class PopupElementId {
    static ACTION_HOLDER_ID = 'actionHolder';
    static BUTTON_HOLDER_ID = 'buttonHolder';
    static MAIN_BUTTONS_HOLDER_ID = 'mainButtonsHolder';
    static SCRAPING_BUTTONS_HOLDER_ID = 'scrapingButtonsHolder';
    static DIGGING_BUTTONS_HOLDER_ID = 'diggingButtonsHolder';
    static STOP_BUTTON_HOLDER_ID = 'stopButtonHolder';
    static FILES_DUG_ID = 'filesDug';
    static OUTPUT_ID = 'output';
    static GET_ALL_FILE_OPTS_ID = 'getAllFileOptsButton';
    static GET_ALL_JPG_OPTS_ID = 'getAllJpgOptsButton';
    static FILE_ENTRY_ID_PREFIX = 'fileEntry';
    static CB_ID_PREFIX = 'cbFile';
}


/**
 * State of a file entry. Usually corresponds to a Popup CSS Class.
 */
class FileEntryStateClass {
    static DOWNLOADING = 'downloading';
    static DUG = 'dug';
    static FAILED = 'failed';
    static FOUND = 'found';
}


/**
 * Action key-strings.
 */
class Action {
    static STOP = 'stop';
    static GET = 'GET';
    static POST = 'POST';
    static PEEPAROUND = 'peepAround';
    static DIG = 'dig';
    static SCRAPE = 'scrape';
    static DIG_GG = 'digGalleryGallery';
}


/**
 * Template strings.
 */
class TemplateStrings {
    static DOWNLOADS_DIR = 'Gimme-site_pagename-tmp';
}


/**
 * Mime-Types and response types.
 */
class MimeType {
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
    static HREF = 'href';
    static SRC = 'src';
    static SCOPE = ':scope';
}


/**
 * Canned selectors
 */
class DefaultSelector {
    static A_HREF = `a[${SelectorProperties.HREF}]`;
    static IMG_SRC = `img[${SelectorProperties.SRC}]`;
    static SC_IMG = `${SelectorProperties.SCOPE} img`;
    static CLICK_PROPS = [ 'onclick', 'href' ];
    static PROP_PATHS = [ 'src', 'href', 'currentSrc' ];
    static DEFAULT_SELECTOR = ':scope *';
    static ALL_JS_SELECTOR = ':scope *[onclick],*[onmouseover],*[onmouseout],*[onmouseenter],*[onchange],*[href^="javascript:"],script';    
}   


/**
 * Name of class/module to identify log entries.
 */
class LogSourceToken {
    static APP = '[App] ';
    static DIGGER = '[Digger] ';
    static EVENTPAGE = '[EventPage] ';
    static LOGICKER = '[Logicker] ';
    static OUTPUT = '[Output] ';
    static SCRAPER = '[Scraper] ';
    static UTILS = '[Utils] ';
    static VOYEUR = '[Voyeur] ';
    static POPUP = '[Popup] ';
    static OPTIONATOR = '[Optionator] ';
    static DOMINATRIX = '[Dominatrix] ';
}


/**
 * Colors used for the badge.
 */
class BadgeColor {
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
    static URL_EXTRACTING_REGEX = /(url\()?('|")?(https?|data|blob|file)\:.+?\)?('|")?\)?/i;
    static MIN_ZOOM_HEIGHT = 250;
    static MIN_ZOOM_WIDTH = 250;
}


/**
 * Default values from our prefs/options page for Utils.
 */
class UtilsConfiguration {
    static LISTENER_TIMED_OUT = 'Listener timed out';
    static DL_CHAIN_COUNT = 10;
    static DEFAULT_IFRAME_ID = 'background_iframe';
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

    // Enumeration of the labels to use for the spec form elements.
    static LABELS = {
        CONFIG: {
            minZoomWidth: 'min full-sized image width',
            minZoomHeight: 'minimum full-sized image height',
            dlChannels: 'number of download channels for gallery-gallery-digs',
            dlBatchSize: 'number of downloads in a batch for gallery-gallery-digs',
            knownBadImgRegex: 'regex to match image uris that are never what we are looking for',
            enableHalfBakedFeatures: 'enable all the half-baked features with a "' + OptionsConfiguration.HALF_BAKED_VAL + '" in this box', 
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
            actions_verb: 'the type of uri treansformation to do (ie "replace")',
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
    
    // These are the default spec values.
    static CANNED_CONFIG = {
        minZoomWidth: '300',
        minZoomHeight: '300',
        dlChannels: '5',
        dlBatchSize: '5',
        knownBadImgRegex: '/\\/(logo\\.|loading|header\\.jpg|premium_|preview\\.png|holder-trailer-home\\.jpg|logo-mobile-w\\.svg|logo\\.svg|logo-desktop-w\\.svg|user\\.svg|speech\\.svg|folder\\.svg|layers\\.svg|tag\\.svg|video\\.svg|favorites\\.svg|spinner\\.svg|preview\\.jpg)/i',
        enableHalfBakedFeatures: '0',
    };

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
    
    static CANNED_MESSAGES = [
        {
            match: 'fakeexample.fake',
            link: 'a.link[href]',
            href: 'href',
            thumb: 'img.thumb[data-src]',
            src: 'dataset.src',
        }
    ];

    static CANNED_BLESSINGS = [
        {
            match: 'fakeexample.fake',
            zoom: 'img.zoomed',
            src: 'src',
        }
    ];

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
    static ENTRY_DIV_ID_PREFIX = 'entry_';
    static SUB_ENTRY_DIV_ID_PREFIX = 'subentry_';
    static VALUE_ID_PREFIX = 'value_';
    static ADD_SUB_ENTRY_ID_PREFIX = 'addsubentry_';
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
 * Values to use as defaults when the real object is blank.
 */
class BlankValue {
    static LOC = new URL('http://localhost/');
}


/**
 * The exported Static Constants class.
 */
class GCon {
    static WIN_PROP = WinProp;
    static ACTION = Action;
    static TPL_STR = TemplateStrings;
    static MIME_TYPE = MimeType;
    static DEF_SEL = DefaultSelector;
    static SEL_PROP = SelectorProperties;
    static LOG_ID = LogSourceToken;
    static B_COLOR = BadgeColor;
    static POP_EL_ID = PopupElementId;
    static FE_STATE = FileEntryStateClass;
    static DS_KEY = DiggerScrapeKey;
    static SEARCH_DEPTH = SearchDepth;
    static BLANK_VAL = BlankValue;
    static RECOG_RGX = RecognizingRegex;
    static DIG_CONF = DiggerConfiguration;
    static LOGICK_CONF = LogickerConfiguration;
    static UTILS_CONF = UtilsConfiguration;
    static OPT_CONF = OptionsConfiguration;
    static DOMX_CONF = DominatrixConfiguration;
}


// Exporting the Constants holder class.
export default GCon; 