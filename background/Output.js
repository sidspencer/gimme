'use strict'


const ACTION_HOLDER_ID = 'actionHolder';
const BUTTON_HOLDER_ID = 'buttonHolder';
const MAIN_BUTTONS_HOLDER_ID = 'mainButtonsHolder';
const SCRAPING_BUTTONS_HOLDER_ID = 'scrapingButtonsHolder';
const DIGGING_BUTTONS_HOLDER_ID = 'diggingButtonsHolder';
const FILES_DUG_ID = 'filesDug';
const OUTPUT_ID = 'output';
const GET_ALL_FILE_OPTS_ID = 'getAllFileOptsButton';
const GET_ALL_JPG_OPTS_ID = 'getAllJpgOptsButton';


/**
 * Factory function for bridging the services with the UI.
 */
class Output {
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


    /**
     * Set what document this Output is for, and get the #filesDug and #output elements on that document.
     * 
     * @param {Document} dokken 
     */
    constructor(dokken) {
        this.doc = dokken;

        try {
            this.filesDug = this.doc.getElementById(FILES_DUG_ID);
            this.out = this.doc.getElementById(OUTPUT_ID);
        }
        catch(err) {
            console.log('[Output] Could not get elements from doc, it is a Dead Object.');
        }
    }


    /**
     * Set the main message area's content.
     */
    toOut(newContent) {
        try {
            this.out = this.doc.getElementById(OUTPUT_ID);
            this.out.textContent = newContent;
        }
        catch(error) {
            console.log('[Output] Could not write to doc, it is a Dead Object.');
            console.log('[Output] tried to say: ' + newContent);
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
            this.filesDug = this.doc.getElementById(FILES_DUG_ID);
            this.out = this.doc.getElementById(OUTPUT_ID);
        }
        catch(err) {
            console.log('[Output] Could not get elements from doc, it is a Dead Object.');
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
            console.log('[Output] Cannot clear file entries, doc reference is a Dead Object.');
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
            entry = this.doc.getElementById('fileEntry' + idx);
        }
        catch(error) {
            console.log('[Output] Cannot set entry as downloading. doc reference is a Dead Object.');
            return;
        }
        
        if (entry) { 
            entry.className = 'downloading';
        }
    };


    /**
     * Find an entry, update its text and classnathis. 
     */
    setEntryToState(id, entry, state) {
        var fEntry = undefined;
        
        try {
            fEntry = this.doc.getElementById('fileEntry' + id);
        }
        catch(error) {
            console.log('[Output] Cannot change file entry state. doc ref is a Dead Object.');
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
        this.dugUris.push(id+'');
        this.setEntryToState(id, entry, 'dug');
    };


    /**
     * Find an entry by its id. Update its text, generally to '[failed]'
     */
    setEntryAsFailed(id, entry) {
        this.failedUris.push(id+'');        
        this.setEntryToState(id, entry, 'failed');
    };


    /**
     * Create a new <li> for the entry, name it with the id, and append it to the filesDug <ul>.
     */
    addNewEntry(id, uri) {
        this.fileOptMap[id+''] = uri;
        
        return new Promise((resolve, reject) => { 
            setTimeout(() => {
                var newLi = undefined; 
                
                try {
                    newLi = this.doc.createElement('li');
                }
                catch(error) {
                    console.log('[Output] Could not create new file entry. doc reference is a Dead Object.');
                    resolve({
                        id: id+'',
                        uri: uri,
                    });
                    return;
                }

                var newContent = this.doc.createTextNode(uri);
                newLi.id = 'fileEntry' + id;
                newLi.className = 'found';
                newLi.dataset.initialUri = uri;
                newLi.appendChild(newContent);
                
                this.filesDug.appendChild(newLi);

                resolve({ 
                    id: id+'', 
                    uri: uri, 
                });
            }, 1);
        });
    };


    /**
     * Delete a previously created file entry in the UI.
     */
    deleteEntry(id) {    
        var fileLi = undefined;
        
        try {
            fileLi = this.doc.querySelector('#fileEntry' + id);
        }
        catch(error) {
            console.log('[Output] Could not delete entry. doc reference is a Dead Object.');
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
            checkbox = this.doc.createElement('input');
        }
        catch(error) {
            console.log('[Output] Could not create file option checkbox. doc reference is a Dead Object.');
            return;
        }
        
        
        checkbox.type = 'checkbox';
        checkbox.name = 'cbFile' + fileOpt.id;
        checkbox.id = checkbox.name;
        checkbox.value = fileOpt.uri;
        checkbox.dataset.filePath = fileOpt.filePath;
        
        var thumbHolder = this.doc.createElement('div');

        var thumbImg = this.doc.createElement('img');
        thumbImg.src = fileOpt.thumbUri;
        thumbHolder.appendChild(thumbImg);

        var nameLabel = this.doc.createElement('label');
        nameLabel.setAttribute('for', checkbox.name);
        var fileName = fileOpt.filePath.substring(fileOpt.filePath.lastIndexOf('/') + 1);

        if (fileName.trim() === '') {
            fileName = 'g_img.jpg';
        }

        var nameContent = this.doc.createTextNode(fileName);
        nameLabel.appendChild(nameContent);

        var newLi = this.doc.createElement('li');
        newLi.appendChild(checkbox);
        newLi.appendChild(thumbHolder);
        newLi.appendChild(nameLabel);
        newLi.id = 'fileEntry' + fileOpt.id;
        newLi.className = 'opt';
        
        this.filesDug.appendChild(newLi);

        this.doc.getElementById(checkbox.id).addEventListener('click', (event) => {
            var cb = event.currentTarget;
            cb.checked = true;
            cb.disabled = true;

            if (!!cb.dataset.filePath) {
                var p = fileOpt.onSelect(cb.value, cb.dataset.filePath+'', this);
                
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
            this.doc.getElementById(BUTTON_HOLDER_ID).style.display = 'none';
        }
        catch(error) {
            console.log('[Output] Could not hide dig/scrape buttons. doc ref is a Dead Object.');
        }
    };


    /**
     * hide the downloading buttons.
     */
    hideActionButtons() {
        try {
            this.doc.getElementById(ACTION_HOLDER_ID).style.display = 'none';       
        }
        catch(error) {
            console.log('[Output] Could not hide action buttons. doc ref is a Dead Object.');
        } 
    };


    /**
     * Unhide (show) the digging/scraping buttons.
     */
    showDigScrapeButtons() {
        this.hideActionButtons();

        try {
            this.doc.getElementById(BUTTON_HOLDER_ID).style.display = 'block';
            this.doc.getElementById(MAIN_BUTTONS_HOLDER_ID).style.display = 'block';

            if (this.enableHalfBakedFeatures) {
                this.doc.getElementById(DIGGING_BUTTONS_HOLDER_ID).style.display = 'inline-block';
                this.doc.getElementById(SCRAPING_BUTTONS_HOLDER_ID).style.display = 'inline-block';
            }
        }
        catch(error) {
            console.log('[Output] Could not show dig/scrape buttons. doc ref is a Dead Object.');
        }        
    };


    /**
     * Unhide the downloading buttons.
     */
    showActionButtons() {
        this.hideDigScrapeButtons();

        try {
            this.doc.getElementById(ACTION_HOLDER_ID).style.display = 'block';
            this.doc.getElementById(GET_ALL_JPG_OPTS_ID).focus();
        }
        catch(error) {
            console.log('[Output] Could not show action buttons. doc ref is a Dead Object.');
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
        console.log('[Output] restoreFileList was called.');

        if (this.appIsDigging || this.appIsScraping) {
            console.log('[Output] detected digging/scraping going on.');

            var pChain = Promise.resolve(true);

            for (var k in this.fileOptMap) {
                pChain = pChain.then(() => {
                    return this.addNewEntry(k, this.fileOptMap[k]);
                })
                .then((entryObj) => {
                    return this.restoreEntryStatus(entryObj);
                });
            }

            console.log('[Output] set up the restore-file-list promise chaining.');
        }
    };


    /**
     * Set the state of entries in the file list. Used by the popup to restore screen data.
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
}

window['theOutput'] = new Output(window.document);

export default Output;