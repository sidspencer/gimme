import { default as C } from '../lib/C.js';
import { FileEntry, Log } from '../lib/DataClasses.js';
import Utils from './Utils.js';


/**
 * Factory function for bridging the services with the UI.
 */
class Output {
    // static instance of Output.
    static instance = undefined;

    // instance members
    appIsDigging = false;
    appIsScraping = false;
    fileOptMap = {};
    failedUris = [];
    dugUris = [];
    checkedFileOptUris = [];
    enableHalfBakedFeatures = false;
    doc = undefined;
    filesDug = undefined;
    out = undefined;
    log = new Log(C.LOG_SRC.OUTPUT);

    /**
     * Set what document this Output is for, and get the #filesDug and #output elements on that document.
     * 
     * @param {Document} doc 
     */
    constructor(doc) {
        if (!!doc) {
            doc.addEventListener('DOMContentLoaded', () => {
                this.setDoc(doc)
            });
        }
        else {
            this.log.log('Constructor called with a non-existant document. Someone has to call Output.setDoc()')
        }

        Output.instance = this;
    }


    /**
     * Set the main message area's content.
     */
    toOut(newContent) {
        try {
            this.out = this.doc.getElementById(C.ELEMENT_ID.OUTPUT);
            this.out.textContent = newContent;
        }
        catch(error) {
            this.log.log('Could not write to doc, it may be a Dead Object.');
            this.log.log('tried to say: ' + newContent);
        }
    };


    /**
     * Update the document object Output is using for output.
     * In FF, every time the popup closes this.doc becomes a Dead Object.
     * @param {Document} dok
     */
    setDoc(dok) {
        this.doc = dok;
        
        try {
            this.filesDug = this.doc.getElementById(C.ELEMENT_ID.FILES_DUG);
            this.out = this.doc.getElementById(C.ELEMENT_ID.OUTPUT);
        }
        catch(err) {
            this.log.log('Could not get elements from doc, it may be a Dead Object.');
            this.toOut('Trouble initializing. Please refresh the page.');
        }
    }

    
    /**
     * Enable the use of the half-baked features.
     * @param {bool} enableThem 
     */
    setEnableHalfBakedFeatures(enableThem) {
        this.enableHalfBakedFeatures = enableThem;
    }


    /**
     * Clear the filesDug <ul> of any child nodes.
     */
    clearFilesDug() { 
        var childNodes = [];

        try {
            childNodes = this.filesDug.childNodes;
        }
        catch(err) {
            this.log.log('Cannot clear file entries, doc reference may be a Dead Object.');
            return;
        }

        while (childNodes.length > 0) {
            this.filesDug.removeChild(this.filesDug.firstChild);
        }
    };

    
    /*
     * Reset the output to blank file data.
     */
    resetFileData() {
        this.fileOptMap = {};
        this.dugUris.splice(0);
        this.failedUris.splice(0);
        this.checkedFileOptUris.splice(0);
    }


    /**
     * Set the corresponding <li> in the filesDug <ul> to the downloading class.
     */
    setEntryAsDownloading(idx) {   
        var entry = undefined;

        try {
            entry = this.doc.getElementById(C.ELEMENT_ID.FE_PREFIX + idx);
        }
        catch(error) {
            this.log.log('Cannot set entry as downloading. doc reference may be a Dead Object.');
            return;
        }
        
        if (entry) { 
            entry.className = C.FE_STATE.DOWNLOADING;
        }
    };


    /**
     * Find an entry, update its text and classnathis. 
     */
    setEntryToState(id, entry, state) {
        var fEntry = undefined;
        
        try {
            fEntry = this.doc.getElementById(C.ELEMENT_ID.FE_PREFIX + id);
        }
        catch(error) {
            this.log.log('Cannot change file entry state. doc ref may be a Dead Object.');
            return;
        }
        
        if (fEntry) {
            if (entry) { 
                fEntry.textContent = entry;
            }
            fEntry.className = state;
        }
    }

    /**
     * Find an entry by its id. Update its text to the found zoomUri
     */
    setEntryAsDug(id, entry) {
        this.dugUris.push(id+C.ST.E);
        this.setEntryToState(id, entry, C.FE_STATE.DUG);
    };


    /**
     * Find an entry by its id. Update its text, generally to '[failed]'
     */
    setEntryAsFailed(id, entry) {
        this.failedUris.push(id+C.ST.E);        
        this.setEntryToState(id, entry, C.FE_STATE.FAILED);
    };


    /**
     * Create a new <li> for the entry, name it with the id, and append it to the filesDug <ul>.
     */
    addNewEntry(id, uri) {
        this.fileOptMap[id+C.ST.E] = uri;
        
        return new Promise((resolve, reject) => { 
            setTimeout(() => {
                var newLi = undefined;
                try {
                    newLi = this.doc.createElement(C.SEL_PROP.LI);
                }
                catch(error) {
                    this.log.log('Could not create new file entry. doc reference might be a Dead Object.');
                    resolve({
                        id: (id + C.ST.E),
                        uri: uri,
                    });
                }

                var newContent = this.doc.createTextNode(uri);
                newLi.id = C.ELEMENT_ID.FE_PREFIX + id;
                newLi.className = C.FE_STATE.FOUND;
                newLi.dataset.initialUri = uri;
                newLi.appendChild(newContent);
                
                this.filesDug.appendChild(newLi);

                resolve(new FileEntry((id + C.ST.E), uri));
            }, 1);
        });
    };


    /**
     * Delete a previously created file entry in the UI.
     */
    deleteEntry(id) {    
        var fileLi = undefined;
        
        try {
            fileLi = this.doc.querySelector(`#${C.ELEMENT_ID.FE_PREFIX + id}`);
        }
        catch(error) {
            this.log.log('Could not delete entry. doc reference may be a Dead Object.');
            return;
        }

        if (fileLi) {
            this.filesDug.removeChild(fileLi);
        }
    };


    /**
     * Add a checkbox-label pair to the list. The checkbox is clickable to download the uri listed
     * in the label. 
     */
    addFileOption(fileOpt) {
        var checkbox = undefined;
        
        try {
            checkbox = this.doc.createElement(C.SEL_PROP.INPUT);
        }
        catch(error) {
            this.log.log('Could not create file option checkbox. doc reference may be a Dead Object.');
            return;
        }
        
        
        checkbox.type = C.SEL_PROP.CB;
        checkbox.name = C.ELEMENT_ID.CB_PREFIX + fileOpt.id;
        checkbox.id = checkbox.name;
        checkbox.value = fileOpt.uri;
        checkbox.dataset.filePath = fileOpt.filePath;
        
        var thumbHolder = this.doc.createElement(C.SEL_PROP.DIV);

        var thumbImg = this.doc.createElement(C.SEL_PROP.IMG);
        thumbImg.src = fileOpt.thumbUri;
        thumbHolder.appendChild(thumbImg);

        var nameLabel = this.doc.createElement(C.SEL_PROP.LABEL);
        nameLabel.setAttribute(C.SEL_PROP.FOR, checkbox.name);
        var fileName = fileOpt.filePath.substring(fileOpt.filePath.lastIndexOf(C.ST.WHACK) + 1);

        if (fileName.trim() === C.ST.E) {
            fileName = C.F_NAMING.DEFAULT_FN;
        }

        var nameContent = this.doc.createTextNode(fileName);
        nameLabel.appendChild(nameContent);

        var newLi = this.doc.createElement(C.SEL_PROP.LI);
        newLi.appendChild(checkbox);
        newLi.appendChild(thumbHolder);
        newLi.appendChild(nameLabel);
        newLi.id = C.ELEMENT_ID.FE_PREFIX + fileOpt.id;
        newLi.className = C.CSS_CN.OPT;
        
        this.filesDug.appendChild(newLi);

        this.doc.getElementById(checkbox.id).addEventListener(C.EVT.CLICK, (event) => {
            var cb = event.currentTarget;
            cb.checked = true;
            cb.disabled = true;

            if (!!cb.dataset.filePath) {
                var p = fileOpt.onSelect(cb.value, cb.dataset.filePath+C.ST.E, this);
                
                if (!!p && !!p.then) {
                    p.then(() => {
                        return this.setFileOptUriChecked(cb.value);
                    });
                }
            }
            else {
                this.setFileOptUriChecked(cb.value);
            }
        });
    };


    /**
     * Track which file options have been checked.
     */
    setFileOptUriChecked(uri) {
        if (this.checkedFileOptUris.indexOf(uri) === -1) {
            this.checkedFileOptUris.push(uri);
        }
    }


    /**
     * hide the digging/scraping buttons.
     */
    hideDigScrapeButtons() {
        try {
            this.doc.getElementById(C.ELEMENT_ID.BUTTON_HOLDER).style.display = C.CSS_V.DISPLAY.NONE;
        }
        catch(error) {
            this.log.log('Could not hide dig/scrape buttons. doc ref may be a Dead Object.');
        }
    };


    /**
     * hide the downloading buttons.
     */
    hideActionButtons() {
        try {
            this.doc.getElementById(C.ELEMENT_ID.ACTION_HOLDER).style.display = C.CSS_V.DISPLAY.NONE;       
        }
        catch(error) {
            this.log.log('Could not hide action buttons. doc ref may be a Dead Object.');
        } 
    };


    /**
     * Unhide (show) the digging/scraping buttons.
     */
    showDigScrapeButtons() {
        this.hideActionButtons();
        this.hideStopButton();

        try {
            this.doc.getElementById(C.ELEMENT_ID.BUTTON_HOLDER).style.display = C.CSS_V.DISPLAY.BLOCK;
            this.doc.getElementById(C.ELEMENT_ID.MAIN_BUTTONS_HOLDER).style.display = C.CSS_V.DISPLAY.BLOCK;

            if (this.enableHalfBakedFeatures) {
                this.doc.getElementById(C.ELEMENT_ID.DIGGING_BUTTONS_HOLDER).style.display = C.CSS_V.DISPLAY.IL_BLOCK;;
                this.doc.getElementById(C.ELEMENT_ID.SCRAPING_BUTTONS_HOLDER).style.display = C.CSS_V.DISPLAY.IL_BLOCK;
            }
        }
        catch(error) {
            this.log.log('Could not show dig/scrape buttons. doc ref may be a Dead Object.');
        }        
    };


    /**
     * Unhide the downloading buttons.
     */
    showActionButtons() {
        this.hideDigScrapeButtons();
        this.hideStopButton();

        try {
            this.doc.getElementById(C.ELEMENT_ID.ACTION_HOLDER).style.display = C.CSS_V.DISPLAY.BLOCK;
            this.doc.getElementById(C.ELEMENT_ID.GET_ALL_JPG_OPTS).focus();
        }
        catch(error) {
            this.log.log('Could not show action buttons. doc maybe is a Dead Object.');
        }
    };


    /**
     * Show the stop button. It is shown when the scrape/dig is in progress.
     */
    showStopButton() {
        this.hideDigScrapeButtons();
        this.hideActionButtons();

        try {
            this.doc.getElementById(C.ELEMENT_ID.STOP_BUTTON_HOLDER).style.display = C.CSS_V.DISPLAY.BLOCK;
        }
        catch(error) {
            this.log.log('Could not show stop button. doc ref may be a Dead Object.')
        }
    };


    /**
     * Hide the stop button.
     */
    hideStopButton() {
        try {
            this.doc.getElementById(C.ELEMENT_ID.STOP_BUTTON_HOLDER).style.display = C.CSS_V.DISPLAY.NONE;
        }
        catch(error) {
            this.log.log('Could not hide stop button. doc ref may be a Dead Object.')
        }
    };


    /**
     * Set flag letting the Output know digging is going on.
     */
    setIsDigging(isDigging) {
        this.appIsDigging = isDigging;
    };


    /**
     * Set flag letting the Output know scraping is going on.
     */
    setIsScraping(isScraping) {
        this.appIsScraping = isScraping;
    };


    /**
     * Restore file list on the popup when we are digging/scraping still.
     */
    restoreFileList() {
        //log.log('restoreFileList was called.');
        if (this.appIsDigging || this.appIsScraping) {
            //log.log('detected digging/scraping going on.');

            var pChain = Promise.resolve(true);

            for (var k in this.fileOptMap) {
                pChain = pChain.then(() => {
                    return this.addNewEntry(k, this.fileOptMap[k]);
                })
                .then((entryObj) => {
                    return this.restoreEntryStatus(entryObj);
                });
            }

            this.log.log('restoreFileList() is setting up the promise chaining.');
        }
    };


    /**
     * Set the state of entries in the file list. Used by the popup to restore screen data.
     * It returns a promise around a setTimeout, the likes of which are just to make it asynchronous
     * and return a promise. 
     */
    restoreEntryStatus(entryObj) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (this.dugUris.indexOf(entryObj.id) !== -1) {
                    this.setEntryAsDug(entryObj.id, entryObj.uri);
                }
                else if (this.failedUris.indexOf(entryObj.id) !== -1) {
                    this.setEntryAsFailed(entryObj.id, entryObj.uri);
                }
                
                resolve(true);
            }, 1);
        });
    }


    /**
     * There should only be one instance of output, always pointed at the popup.html doc.
     */
    static getInstance() {
        if (!!Output.instance) {
            return Output.instance;
        }
        else {
            window[C.WIN_PROP.OUTPUT_INST] = new Output(window.document);
            return Output.instance;
        }
    }


    /**
     * Get the instance, but set the doc it is to use first.
     * 
     * @param {Document} dok 
     */
    static getInstanceSetToDoc(dok) {
        if (!!Output.instance) {
            Output.instance.setDoc(dok);
        }
        else {
            Output.instance = new Output(dok);
            window[C.WIN_PROP.OUTPUT_INST] = Output.instance;
        }

        return Output.instance;
    }
}


// Set the class on every window object we're exposed to.
if (!window.hasOwnProperty(C.WIN_PROP.OUTPUT_CLASS)) {
    window[C.WIN_PROP.OUTPUT_CLASS] = Output;
}

// Set the instance on the Background page -- though we never want its document really.
if (!window.hasOwnProperty(C.WIN_PROP.OUTPUT_INST) && Utils.isBackgroundPage(window)) {
    window[C.WIN_PROP.OUTPUT_INST] = new Output(window.document);
}

// Set the instance on the Popup page.
if (!window.hasOwnProperty(C.WIN_PROP.OUTPUT_INST) && Utils.isPopupPage(window)) {
    window[C.WIN_PROP.OUTPUT_INST] = new Output(window.document);
}


// Exports.
export default Output;