import { default as C } from './C.js';


/**
 * Our "string table" for oft-used strings. (Not really for one-offs.)
 */
class MessageStrings {
    static STOP_SIGNAL = `${C.ST.STOP_BANG}`;
    static STOPPING_DDD = 'Stopping...';
    static STORING_URIMAP = 'Set prevUriMap in storage';
    static PLEASE_REFRESH = 'There was an internal error. Please try refreshing the page.';
    static SETTING_PURIMAP = 'Setting prevUriMap';
    static HARVEST_START = '--- harvest is of count -> ';
    static HARVEST_END = ' ------';
}

export default MessageStrings;
