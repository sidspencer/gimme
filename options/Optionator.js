'use strict'


/**
 * Const generic object for holding the shared constants. 
 */
const Constance = {
     // Enumeration of the spec form sections.
    SECTIONS: {
        CONFIG: 'CONFIG',
        MESSAGES: 'MESSAGES',
        PROCESSINGS: 'PROCESSINGS',
        BLESSINGS: 'BLESSINGS',
    },

    // Enumeration of the labels to use for the spec form elements.
    LABELS: {
        CONFIG: {
            minZoomWidth: 'min full-sized image width',
            minZoomHeight: 'minimum full-sized image height',
            dlChannels: 'number of download channels for gallery-gallery-digs',
            dlBatchSize: 'number of downloads in a batch for gallery-gallery-digs',
            knownBadImgRegex: 'regex to match image uris that are never what we are looking for',
            enableHalfBakedFeatures: 'enable all the half-baked features with a "3.14159" in this box', 
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
    },
    
    // These are the default spec values.
    cannedConfig: {
        minZoomWidth: '300',
        minZoomHeight: '300',
        dlChannels: '5',
        dlBatchSize: '5',
        knownBadImgRegex: '/\\/(logo\\.|loading|header\\.jpg|premium_|preview\\.png|holder-trailer-home\\.jpg|logo-mobile-w\\.svg|logo\\.svg|logo-desktop-w\\.svg|user\\.svg|speech\\.svg|folder\\.svg|layers\\.svg|tag\\.svg|video\\.svg|favorites\\.svg|spinner\\.svg|preview\\.jpg)/i',
        enableHalfBakedFeatures: '0',
    },

    cannedProcessings: [
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
    ],
    
    cannedMessages: [
        {
            match: 'fakeexample.fake',
            link: 'a.link[href]',
            href: 'href',
            thumb: 'img.thumb[data-src]',
            src: 'dataset.src',
        }
    ],

    cannedBlessings: [
        {
            match: 'fakeexample.fake',
            zoom: 'img.zoomed',
            src: 'src',
        }
    ],
 }

// The default spec, used if there is nothing in storage yet.
const DEFAULT_SPEC = {
    config: Constance.cannedConfig,
    messages: Constance.cannedMessages,
    processings: Constance.cannedProcessings,
    blessings: Constance.cannedBlessings,
};


// Constants for Dominatrix. Id prefixes for unique element ids, 
// classnames for entry holder <div>s, keys for objects.
const ENTRY_DIV_ID_PREFIX = 'entry_';
const SUB_ENTRY_DIV_ID_PREFIX = 'subentry_';
const VALUE_ID_PREFIX = 'value_';
const ADD_SUB_ENTRY_ID_PREFIX = 'addsubentry_';
const ENTRY_CLASS = 'entry';
const SUB_ENTRY_CLASS = 'subentry';
const DELETE_BUTTON_CLASS = 'delete';
const ADD_SUB_ENTRY_CLASS = 'addSubentry';
const DELETE_BUTTON_TEXT = 'X';


/*
 * Singleton which handles layout and serialization to and from the HTML5 form
 * for the options spec values.
 */
class Dominatrix {    
    // Counters used in creating unique element ids.
    static entryCounter = 0;
    static subEntryCounter = 0;

    // Enumeration of section holder <div>s that exist on the options form page.
    static SectionElements = {
        CONFIG: document.getElementById(Constance.SECTIONS.CONFIG),
        MESSAGES: document.getElementById(Constance.SECTIONS.MESSAGES),
        PROCESSINGS: document.getElementById(Constance.SECTIONS.PROCESSINGS),
        BLESSINGS: document.getElementById(Constance.SECTIONS.BLESSINGS),
    };


    /**
     * Add one object entry of an options section to the HTML5 form.
     * 
     * @param {*} values Array of value objects which describe the entry.
     * @param {*} section Section of the options spec the entry belongs to.
     * @param {*} isSubEntry Flag used for recursion.
     * @param {*} insertionRefNode DOM node before which to insert the entry.
     */
    static addEntry(values, section, isSubEntry, insertionRefNodeId) {
        var div = document.createElement('div');

        if (isSubEntry) {
            div.id = SUB_ENTRY_DIV_ID_PREFIX + (Dominatrix.subEntryCounter++);
            div.className = SUB_ENTRY_CLASS;
        }
        else {
            div.id = ENTRY_DIV_ID_PREFIX + (Dominatrix.entryCounter++);
            div.className = ENTRY_CLASS;
        }

        if (Array.isArray(values)) {
            for (var i = 0; i < values.length; i++) {
                var value = values[i];

                if (!value) {
                    continue;
                }

                var label = (!!value.label ? document.createElement('label') : false);
                var valueId = div.id + '_' + VALUE_ID_PREFIX + i;

                // Create and append the label if we were told to label this.
                if (!!label) {
                    label.textContent = value.label;
                    label.for = valueId;
                    div.appendChild(label);
                }

                // Create the input that represents the value.
                var input = document.createElement('input');
                input.id = valueId;
                input.name = valueId;
                input.dataset.key = value.key;
                div.appendChild(input);                

                var inputValue = '';
                
                // For array values, use the div id of the subentry.
                if (('values' in value) && Array.isArray(value.values)) {
                    // Now recurse to add the subentry values.
                    var subEntryId = Dominatrix.addEntry(value.values, div, true);
                    input.type = 'hidden';                    
                    inputValue = subEntryId;
                    
                    // Hook up the addSubEntry button to add new subentries. Only place the
                    // button after the last subentry value in the array. 
                    if ((i+1) === values.length || values[i+1].key !== value.key) {
                        Dominatrix.buildAddSubEntryButton(i, div, value, subEntryId);
                        i++;
                    }
                }
                // For scalar values, use value.text or the value itself.
                else {
                    input.type = 'text';                    
                    inputValue = (('text' in value) ? value.text.toString() : value.toString());;
                }
                input.value = inputValue;
            }

            // Create a delete button for the entry/subentry. If we're dealing with the first
            // subentry of a list of subentries, do not create a delete button for it.
            var deleteButton = document.createElement('button');
            deleteButton.textContent = DELETE_BUTTON_TEXT;
            deleteButton.className = DELETE_BUTTON_CLASS;
            deleteButton.addEventListener('click', () => {
                // Remove the subentry title (like 'actions'), then the hidden input
                // for the subentry, then the subentry itself.
                if (div.previousSibling.value === div.id) {
                    div.previousSibling.previousSibling.remove();
                    div.previousElementSibling.remove();
                }
                div.remove();

                // If there is only 1 subentry left, find it and hide its delete button.
                // otherwise, show all the subentries' delete buttons.
                var remainingSubentries = section.querySelectorAll(':scope div.' + SUB_ENTRY_CLASS);
                if (remainingSubentries.length === 1) {
                    var deleteButton = remainingSubentries[0].querySelector(':scope button.' + DELETE_BUTTON_CLASS);
                    deleteButton.style.display = 'none';
                }
            });
            
            // append the delete button.
            div.appendChild(deleteButton);
        }

        // Add the new entry to the section, optionally before a reference node, or 
        // just add it to the end of the doc if no section was given.
        if (!!section) {
            if (!!insertionRefNodeId) {
                section.insertBefore(div, document.getElementById(insertionRefNodeId));
            }
            else {
                section.appendChild(div);
            }
        }
        else {
            document.body.appendChild(div);
        }

        // return the new entry's id.
        return div.id;
    }


    /**
     * Create button on page to add a sub entry to a config secion on the options page.\
     * 
     * @param {Node} rootNode - Element holding node for this section
     * @param {object} val - object descriptor, key-value label->values pair.
     * @param {string} refEntryId - 
     */
    static buildAddSubEntryButton(idx, rootNode, val, refEntryId) {  
        var refNode = document.getElementById(refEntryId);

        // Build the 'add subentry' button, and insert it into the <div>.
        var addSubEntry = document.createElement('button');
        addSubEntry.id = ADD_SUB_ENTRY_ID_PREFIX + idx;
        addSubEntry.className = ADD_SUB_ENTRY_CLASS;
        addSubEntry.textContent = 'add subentry';
        rootNode.insertBefore(addSubEntry, refNode);                                                

        // Create the 'add subentry' click handler. It creates a new label for the 
        // subentry section, adds the subentry by copying an existing subentry's values,
        // and creates the needed hidden element that points to it.
        addSubEntry.addEventListener('click', () => {
            // Create the label.
            var newLabel = (!!val.label ? document.createElement('label') : false);
            var newValueId = div.id + '_' + VALUE_ID_PREFIX + (idx + 1);
            if (!!newLabel) {
                newLabel.id = 'label_' + newValueId
                newLabel.textContent = val.label;
                newLabel.for = newValueId;
                rootNode.insertBefore(newLabel, addSubEntry); 
            }

            // Create the hidden input that points to this subentry.
            var newInput = document.createElement('input');
            newInput.id = newValueId;
            newInput.type = 'hidden';
            newInput.name = newValueId;
            newInput.dataset.key = val.key;
            rootNode.insertBefore(newInput, addSubEntry);
            
            // Add the subentry to the <div>.
            var addedSubentryId = this.addEntry(val.values, rootNode, true, newValueId);
            newInput.value = addedSubentryId;

            // Unhide all the subentries' delete buttons in the section.
            var deleteButtons = div.parentNode.querySelectorAll(':scope button.' + DELETE_BUTTON_CLASS);
            deleteButtons.forEach((dButton) => {
                if (dButton.parentNode.className === SUB_ENTRY_CLASS) {
                    dButton.style.display = '';
                }
            });
        });
    }


    /**
     * Add form fields for the config values.
     */
    static insertConfigEntry(configEntry) {
        var entryId = Dominatrix.addEntry(configEntry, Dominatrix.SectionElements.CONFIG);
        return entryId;
    }


    /**
     * Add form fields for a single message.
     */
    static insertMessageEntry(messageEntry) {
        var entryId = Dominatrix.addEntry(messageEntry, Dominatrix.SectionElements.MESSAGES);
        return entryId;
    }


    /**
     * Add populated form fields for a single processing.
     */
    static insertProcessingEntry(processingEntry) {
        var entryId = Dominatrix.addEntry(processingEntry, Dominatrix.SectionElements.PROCESSINGS);
        return entryId;
    }


    /**
     * Add populated form fields for a single blessing.
     */
    static insertBlessingEntry(blessingEntry) {
        var entryId = Dominatrix.addEntry(blessingEntry, Dominatrix.SectionElements.BLESSINGS);
        return entryId;
    }


    /**
     * Get a serialized object for a single options entry from a particular section
     * of the options form.
     * 
     * @param {*} root The root element for the section containing the entry.
     */
    static getEntry(root) {
        var entry = {};
        var textInputs = [];
        var hiddenInputs = [];

        // Sort out the text inputs and hidden inputs.
        root.childNodes.forEach((child) => {
            if (child.nodeName === 'INPUT') {
                if (child.type === 'text') {
                    textInputs.push(child);
                }
                else if (child.type === 'hidden') {
                    hiddenInputs.push(child);
                }
            }
        });

        textInputs.forEach((input) => {
            if (input.dataset.key) {
                entry[input.dataset.key] = input.value;
            }
        });

        hiddenInputs.forEach((input) => {
            if (input.dataset.key) {
                if (!(input.dataset.key in entry)) {
                    entry[input.dataset.key] = [];
                }
                else if (!Array.isArray(entry[input.dataset.key])) {
                    entry[input.dataset.key] = [ entry[input.dataset.key] ];
                }

                var subEntry = input.nextSibling;
                if (!!subEntry && subEntry.className === SUB_ENTRY_CLASS) {
                    entry[input.dataset.key].push(Dominatrix.getEntry(subEntry));
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
    static getEntries(section) {
        var entries = [];
        var divs = [];
        
        // Get all of the div.ENTRY_CLASS dom nodes.
        section.childNodes.forEach((child) => {
            if (child.nodeName === 'DIV' && child.className === ENTRY_CLASS) {
                divs.push(child);
            }
        });

        // Add each entry.
        divs.forEach((div) => {
            entries.push(Dominatrix.getEntry(div));
        });

        return entries;
    }


    /**
     * Return the object representing the config section of the options form.
     * Before 0.4.9, the "lastElementChild" was missing, so we never saved
     * config options. :(
     */
    static getConfig() {
        return Dominatrix.getEntry(Dominatrix.SectionElements.CONFIG.lastElementChild);
    };

    
    /**
     * Return the serialized array of messages from the options form.
     */
    static getMessageEntries() {
        return Dominatrix.getEntries(Dominatrix.SectionElements.MESSAGES);
    };


    /**
     * Return the serialized array of processings from the options form.
     */
    static getProcessingEntries() {
        return Dominatrix.getEntries(Dominatrix.SectionElements.PROCESSINGS);
    };


    /**
     * Return the serialized array of blessings from the options form.
     */
    static getBlessingEntries() {
        return Dominatrix.getEntries(Dominatrix.SectionElements.BLESSINGS);
    };
}


/**
 * Static class which handles getting, setting, and processing the options spec values
 * to/from storage.
 */
class Optionator {
    // id properties of the elements in the configuration sections
    static ids = {
        CONFIG: [],
        MESSAGES: [],
        PROCESSINGS: [],
        BLESSINGS: [],
    };

    // Enumeration of the DOM insertion functions.
    static InsertionFunctions = {
        CONFIG: Dominatrix.insertConfigEntry,
        MESSAGES: Dominatrix.insertMessageEntry,
        PROCESSINGS: Dominatrix.insertProcessingEntry,
        BLESSINGS: Dominatrix.insertBlessingEntry,
    };


    /**
     * Get the options from storage, if they're there. Use the default spec
     * if nothing is in storage yet.
     */
    static getSpec() {
        var loadingDiv = document.getElementById('loading');
        loadingDiv.style.display = 'block';

        chrome.storage.sync.get({
                spec: DEFAULT_SPEC
            }, 
            (store) => {
                Optionator.layoutConfig(store.spec.config);
                Optionator.layoutMessages(store.spec.messages);
                Optionator.layoutProcessings(store.spec.processings);
                Optionator.layoutBlessings(store.spec.blessings);

                loadingDiv.style.display = 'none';
            }
        );
    }


    /**
     * Set the values typed into the textarea. If it does not parse, then 
     * say so in the status and do not actually set.
     */
    static setSpec() {
        var spec = {};

        spec.config = Dominatrix.getConfig();
        spec.messages = Dominatrix.getMessageEntries();
        spec.processings = Dominatrix.getProcessingEntries();
        spec.blessings = Dominatrix.getBlessingEntries();

        console.log('Trying to set spec:');
        console.log(JSON.stringify(spec));
        console.log('\n');

        chrome.storage.sync.set({
                spec: spec,
            },
            () => {
                var statusDiv = document.getElementById('status');
                statusDiv.style.display = 'block';

                setTimeout(() => {
                    statusDiv.style.display = 'none';
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
    static layoutSpecSection(section, objects) {
        // For each of the section objects, process and lay it out.
        objects.forEach((obj) => {
            var objEntry = [];

            // For each key/value pair in the section object, add it to the objEntry.
            Object.keys(obj).forEach((key) => {
                // Some values are arrays of objects. Process them into arrays of label,
                // text, key sets. 
                if (Array.isArray(obj[key])) {
                    // For each of the subarray objects, process it.
                    obj[key].forEach((subObj) => {
                        var subValues = [];
                        
                        // Similarly to the main forEach(), process each subobject key/value pair.
                        // (Could probably be recursive here.)
                        Object.keys(subObj).forEach((subKey) => {
                            var subLabel = (Constance.LABELS[section][key + '_' + subKey] || '');
                            var subText = (subObj[subKey] || '');

                            subValues.push({
                                label: subLabel,
                                text: subText,
                                key: subKey,
                            });
                        });

                        // Add the values array to the object entry.
                        objEntry.push({
                            label: Constance.LABELS[section][key],
                            values: subValues,
                            key: key,
                        });
                    });
                }
                // Scalar values are simpler. Just process out their label, text, and key. 
                // Then put them in the object entry.
                else {
                    var label = (Constance.LABELS[section][key] || '');
                    var text = (obj[key] || '');

                    var valueObj = {
                        label: label,
                        text: text,
                        key: key,
                    };

                    if (key === 'match') {
                        objEntry.splice(0,0,valueObj);
                    }
                    else {
                        objEntry.splice(-2,0,valueObj);
                    }
                }
            });

            // Call the proper Dominatrix layout function, and add the id to our tracking object.
            var entryId = this.InsertionFunctions[section](objEntry);
            this.ids[section].push(entryId);
        });
    }


    /**
     * Create and populate the fields for spec.config. This is a single object
     * full of one-off configuration properties.
     */
    static layoutConfig(config) {
        Optionator.layoutSpecSection(Constance.SECTIONS.CONFIG, [config]);
    }


    /**
     * Create and populate the fields for spec.messages. This is an array of objects,
     * each of which contains keys for how the content-script can identify thumb, src,
     * link, and href values for a gallery item on a page that matches the "match" key's
     * regular expression.
     */
    static layoutMessages(messages) {
        Optionator.layoutSpecSection(Constance.SECTIONS.MESSAGES, messages);
    }


    /**
     * Create and populate the fields for spec.processings. This is an array of objects,
     * each of which contains keys for how the Logicker should do post-processing on 
     * the content-script's galleryMap. Each holds a "match" regexp for the uri, "doDig", 
     * "doScrape", and array of "actions" of varying types.
     */
    static layoutProcessings(processings) {
        Optionator.layoutSpecSection(Constance.SECTIONS.PROCESSINGS, processings);
    }


    /**
     * Create and populate the fields for spec.blessings. This is an array of objects, each
     * of which contains keys for how the Logicker can identify a zoom-item on a zoom-page for
     * a gallery item. Each holds a "match" regexp for the uri, and a css selector "zoom" for
     * the zoom item, and a "src" prop for the direct link to the resource.
     */
    static layoutBlessings(blessings) {
        Optionator.layoutSpecSection(Constance.SECTIONS.BLESSINGS, blessings);
    }


    /**
     * Set up the event listener which kicks off building the Options page on
     * 'DOMContentLoaded'.
     */
    static setupOptionsPageOnLoad() {
        // Do setup on DOMContentLoaded.
        document.addEventListener('DOMContentLoaded', () => {
            // Load the spec from storage, and trigger the layout.
            Optionator.getSpec();

            // Hook up the event handlers for each section's "Add" button on DOMContentLoaded.
            document.querySelectorAll('button.addEntry').forEach((button) => {
                button.addEventListener('click', () => {
                    var section = button.parentElement.id;
                    Optionator.layoutSpecSection(
                        Constance.SECTIONS[section], 
                        DEFAULT_SPEC[section.toLowerCase()]
                    );
                });
            });

            // Hook up the "set" button.
            document.getElementById('set').addEventListener('click', () => { 
                this.setSpec(); 
            });
        });
    }      
}
Optionator.setupOptionsPageOnLoad();

export default Optionator;