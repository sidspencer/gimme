'use strict'


/**
 * Singleton which handles layout and serialization to and from the HTML5 form
 * for the options spec values.
 */
var Dominatrix = (function Dominatrix(doc) {
    var me = {};
    
    // Counters used in creating unique element ids.
    var entryCounter = 0;
    var subEntryCounter = 0;
    
    // Id prefixes for unique element ids, and classnames for entry holder <div>s. 
    var ENTRY_DIV_ID_PREFIX = 'entry_';
    var SUB_ENTRY_DIV_ID_PREFIX = 'subentry_';
    var VALUE_ID_PREFIX = 'value_';
    var ENTRY_CLASS = 'entry';
    var SUB_ENTRY_CLASS = 'subentry';

    // Enumeration of section holder <div>s that exist on the options form page.
    var SECTION = {
        CONFIG: doc.getElementById('config'),
        MESSAGES: doc.getElementById('messages'),
        PROCESSINGS: doc.getElementById('processings'),
        BLESSINGS: doc.getElementById('blessings'),
    }


    /**
     * Add one object entry of an options section to the HTML5 form.
     * 
     * @param {*} values Array of value objects which describe the entry.
     * @param {*} section Section of the options spec the entry belongs to.
     * @param {*} isSubEntry Flag used for recursion.
     */
    function addEntry(values, section, isSubEntry) {
        var div = doc.createElement('div');

        if (isSubEntry) {
            div.id = SUB_ENTRY_DIV_ID_PREFIX + (subEntryCounter++);
            div.className = SUB_ENTRY_CLASS;
        }
        else {
            div.id = ENTRY_DIV_ID_PREFIX + (entryCounter++);
            div.className = ENTRY_CLASS;
        }

        if (Array.isArray(values)) {
            for (var i = 0; i < values.length; i++) {
                var value = values[i];

                if (!value) {
                    continue;
                }

                var label = (!!value.label ? doc.createElement('label') : false);
                var valueId = div.id + '_' + VALUE_ID_PREFIX + i;

                // Create and append the label if we were told to label this.
                if (!!label) {
                    label.textContent = value.label;
                    label.for = valueId;
                    div.appendChild(label);
                }

                // Create the input that represents the value.
                var input = doc.createElement('input');
                input.id = valueId;
                input.name = valueId;
                input.dataset.key = value.key;

                var inputValue = '';
                
                // For array values, use the div id of the subEntry.
                if (('values' in value) && Array.isArray(value.values)) {
                    var subEntryId = addEntry(value.values, div, true);
                    input.type = 'hidden';                    
                    inputValue = subEntryId;               
                }
                // For scalar values, use value.text or the value itself.
                else {
                    input.type = 'text';                    
                    inputValue = (('text' in value) ? value.text : value.toString());;
                }
                input.value = inputValue;

                // appent the value's input element.
                div.appendChild(input);
            }
        }

        // Append the entry to the section, or to the end of the doc if no section
        // was given.
        if (!!section && !!section.appendChild) {
            section.appendChild(div);
        }
        else {
            doc.body.appendChild(div);
        }

        // return the new entry's id.
        return div.id;
    }


    /**
     * Add form fields for the config values.
     */
    me.insertConfigEntry = function insertConfigEntry(configEntry) {
        var entryId = addEntry(configEntry, SECTION.CONFIG);
        return entryId;
    };


    /**
     * Add form fields for a single message.
     */
    me.insertMessageEntry = function insertMessageEntry(messageEntry) {
        var entryId = addEntry(messageEntry, SECTION.MESSAGES);
        return entryId;
    };


    /**
     * Add populated form fields for a single processing.
     */
    me.insertProcessingEntry = function insertProcessingEntry(processingEntry) {
        var entryId = addEntry(processingEntry, SECTION.PROCESSINGS);
        return entryId;
    };


    /**
     * Add populated form fields for a single blessing.
     */
    me.insertBlessingEntry = function insertBlessingEntry(blessingEntry) {
        var entryId = addEntry(blessingEntry, SECTION.BLESSINGS);
        return entryId;
    };


    /**
     * Get a serialized object for a single options entry from a particular section
     * of the options form.
     * 
     * @param {*} root The root element for the section containing the entry.
     */
    function getEntry(root) {
        var entry = {};

        var textInputs = root.querySelectorAll(':scope > input[type="text"]');
        textInputs.forEach(function addToConfig(input) {
            if (input.dataset.key) {
                entry[input.dataset.key] = input.value;
            }
        });

        var hiddenInputs = root.querySelectorAll(':scope > input[type="hidden"]');
        hiddenInputs.forEach(function getSubEntry(input) {
            if (input.dataset.key) {
                if (!(input.dataset.key in entry)) {
                    entry[input.dataset.key] = [];
                }
                else if (!Array.isArray(entry[input.dataset.key])) {
                    entry[input.dataset.key] = [ entry[input.dataset.key] ];
                }

                var subEntry = root.querySelector('div#' + input.value);
                if (!!subEntry) {
                    entry[input.dataset.key].push(getEntry(subEntry));
                }
            }
        });

        return entry;
    }


    /**
     * Return a serialized array of entries in a section of the options form.
     * 
     * @param {*} section Spec section whose objects are being asked for.
     */
    function getEntries(section) {
        var entries = [];
        var divs = section.querySelectorAll(':scope div.' + ENTRY_CLASS);

        divs.forEach(function addEachEntry(div) {
            entries.push(getEntry(div));
        });

        return entries;
    }


    /**
     * Return the object representing the config section of the options form.
     */
    me.getConfig = function getConfig() {
        return getEntry(SECTION.CONFIG);
    };

    
    /**
     * Return the serialized array of messages from the options form.
     */
    me.getMessageEntries = function getMessageEntries() {
        return getEntries(SECTION.MESSAGES);
    };


    /**
     * Return the serialized array of processings from the options form.
     */
    me.getProcessingEntries = function getProcessingEntries() {
        return getEntries(SECTION.PROCESSINGS);
    };


    /**
     * Return the serialized array of blessings from the options form.
     */
    me.getBlessingEntries = function getBlessingEntries() {
        return getEntries(SECTION.BLESSINGS);
    };


    return me;
})(window.document);


/**
 * Singleton which handles getting, setting, and processing the options spec values
 * to/from storage.
 */
var Optionator = (function Optionator(doc, dmx) {
    // The returned object. Merely the tracking ids of the form elements.
    var me = {
        ids: {
            CONFIG: [],
            MESSAGES: [],
            PROCESSINGS: [],
            BLESSINGS: [],
        },
    };

    // Enumeration of the spec form sections.
    var SECTIONS = {
        CONFIG: 'CONFIG',
        MESSAGES: 'MESSAGES',
        PROCESSINGS: 'PROCESSINGS',
        BLESSINGS: 'BLESSINGS',
    };

    // Enumeration of the labels to use for the spec form elements.
    var LABELS = {
        CONFIG: {
            minZoomWidth: 'min zoom-item width',
            minZoomHeight: 'min zoom-item height',
            dlChannels: '# of download channels',
            dlBatchSize: '# of downloads per batch', 
        },
        MESSAGES: {
            match: 'uri-matcher',
            link: 'link selector',
            href: 'link uri property',
            thumb: 'thumbnail sub-selector',
            src: 'thumbnail uri property',
        },
        PROCESSINGS: {
            match: 'uri-matcher',
            actions: 'action',
            actions_noun: 'use property',
            actions_verb: 'what to do',
            actions_match: 'conditional matcher',
            actions_new: 'new value',
            dig: 'do digging?',
            scrape: 'do scraping?',
        },
        BLESSINGS: {
            match: 'uri-matcher',
            zoom: 'zoom-item selector',
            src: 'zoom-item uri prop',
        },
    };

    // Enumeration of the DOM insertion functions.
    var INSERT_FUNCS = {
        CONFIG: dmx.insertConfigEntry,
        MESSAGES: dmx.insertMessageEntry,
        PROCESSINGS: dmx.insertProcessingEntry,
        BLESSINGS: dmx.insertBlessingEntry,
    };
    
    // These are the default spec values.
    var cannedConfig = {
        minZoomWidth: '300',
        minZoomHeight: '300',
        dlChannels: '5',
        dlBatchSize: '5',
    };
    var cannedProcessings = [
        {
            match: '/greentextonblack\\.net\\//',
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
    var cannedMessages = [
        {
            match: '/greentextonblack\\.net\\//',
            link: 'a.link[href]',
            href: 'href',
            thumb: 'img.thumb[data-src]',
            src: 'dataset.src',
        }
    ];
    var cannedBlessings = [
        {
            match: '/greentextonblack\\.net\\//',
            zoom: 'img.zoomed',
            src: 'src',
        }
    ];

    // The default spec, used if there is nothing in storage yet.
    var DEFAULT_SPEC = {
        config: cannedConfig,
        messages: cannedMessages,
        processings: cannedProcessings,
        blessings: cannedBlessings,
    };


    /**
     * Get the options from storage, if they're there. Use the default spec
     * if nothing is in storage yet.
     */
    function getSpec() {
        chrome.storage.sync.get({
                spec: DEFAULT_SPEC
            }, 
            function storageRetrieved(store) {
                layoutConfig(store.spec.config);
                layoutMessages(store.spec.messages);
                layoutProcessings(store.spec.processings);
                layoutBlessings(store.spec.blessings);
            }
        );
    }


    /**
     * Set the values typed into the textarea. If it does not parse, then 
     * say so in the status and do not actually set.
     */
    function setSpec() {
        var spec = {};

        spec.config = dmx.getConfig();
        spec.messages = dmx.getMessageEntries();
        spec.processings = dmx.getProcessingEntries();
        spec.blessings = dmx.getBlessingEntries();

        console.log('Trying to set spec:');
        console.log(JSON.stringify(spec));
        console.log('\n');

        chrome.storage.sync.set({
                spec: spec,
            },
            function storageSet() {
                var statusDiv = doc.getElementById('status');
                statusDiv.style.display = 'block';
                statusDiv.textContent = 'spec set successfully.'

                setTimeout(function clearMessage() {
                    statusDiv.style.display = 'none';
                    statusDiv.textContent = '';
                }, 5000);
            }
        );
    }




    /**
     * Process the spec section's objects, and call Dominatrix to lay them out
     * on the form.
     * 
     * @param {*} section Section of the spec, using SECTIONS enum
     * @param {*} objects Objects existing in that spec section
     */
    function layoutSpecSection(section, objects) {
        // For each of the section objects, process and lay it out.
        objects.forEach(function createObjectEntry(obj) {
            var objEntry = [];            

            // For each key/value pair in the section object, add it to the objEntry.
            Object.keys(obj).forEach(function processObjectValue(key) {
                // Some values are arrays of objects. Process them into arrays of label,
                // text, key sets. 
                if (Array.isArray(obj[key])) {
                    // For each of the subarray objects, process it.
                    obj[key].forEach(function addSubObjectValue(subObj) {
                        var subValues = [];
                        
                        // Similarly to the main forEach(), process each subobject key/value pair.
                        // (Could probably be recursive here.)
                        Object.keys(subObj).forEach(function processSubObjValue(subKey) {
                            var subLabel = (LABELS[section][key + '_' + subKey] || '');
                            var subText = (subObj[subKey] || '');

                            subValues.push({
                                label: subLabel,
                                text: subText,
                                key: subKey,
                            });
                        });

                        // Add the values array to the object entry.
                        objEntry.push({
                            label: LABELS[section][key],
                            values: subValues,
                            key: key,
                        });
                    });
                }
                // Scalar values are simpler. Just process out their label, text, and key. 
                // Then put them in the object entry.
                else {
                    var label = (LABELS[section][key] || '');
                    var text = (obj[key] || '');

                    objEntry.push({
                        label: label,
                        text: text,
                        key: key,
                    });
                }
            });

            // Call the proper Dominatrix layout function, and add the id to our tracking object.
            var entryId = INSERT_FUNCS[section](objEntry);
            me.ids[section].push(entryId);
        });
    }


    /**
     * Create and populate the fields for spec.config. This is a single object
     * full of one-off configuration properties.
     */
    function layoutConfig(config) {
        layoutSpecSection(SECTIONS.CONFIG, [config]);
    }


    /**
     * Create and populate the fields for spec.messages. This is an array of objects,
     * each of which contains keys for how the content-script can identify thumb, src,
     * link, and href values for a gallery item on a page that matches the "match" key's
     * regular expression.
     */
    function layoutMessages(messages) {
        layoutSpecSection(SECTIONS.MESSAGES, messages);
    }


    /**
     * Create and populate the fields for spec.processings. This is an array of objects,
     * each of which contains keys for how the Logicker should do post-processing on 
     * the content-script's galleryMap. Each holds a "match" regexp for the uri, "doDig", 
     * "doScrape", and array of "actions" of varying types.
     */
    function layoutProcessings(processings) {
        layoutSpecSection(SECTIONS.PROCESSINGS, processings);
    }


    /**
     * Create and populate the fields for spec.blessings. This is an array of objects, each
     * of which contains keys for how the Logicker can identify a zoom-item on a zoom-page for
     * a gallery item. Each holds a "match" regexp for the uri, and a css selector "zoom" for
     * the zoom item, and a "src" prop for the direct link to the resource.
     */
    function layoutBlessings(blessings) {
        layoutSpecSection(SECTIONS.BLESSINGS, blessings);
    }


    // Hook up the event handlers.
    doc.addEventListener('DOMContentLoaded', getSpec);
    doc.getElementById('set').addEventListener('click', setSpec);


    return me;
})(window.document, Dominatrix);