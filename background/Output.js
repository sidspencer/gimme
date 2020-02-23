'use strict'

/**
 * Factory function for bridging the services with the UI.
 */
var Output = (function Output(dokken) {
    // instance
    var me = {
        ACTION_HOLDER_ID: 'actionHolder',
        BUTTON_HOLDER_ID: 'buttonHolder',
        MAIN_BUTTONS_HOLDER_ID: 'mainButtonsHolder',
        SCRAPING_BUTTONS_HOLDER_ID: 'scrapingButtonsHolder',
        DIGGING_BUTTONS_HOLDER_ID: 'diggingButtonsHolder',
        FILES_DUG_ID: 'filesDug',
        GET_ALL_FILE_OPTS_ID: 'getAllFileOptsButton',
        GET_ALL_JPG_OPTS_ID: 'getAllJpgOptsButton',
        appIsDigging: false,
        appIsScraping: false,
        fileOptMap: {},
        failedUris: [],
        dugUris: [],
        checkedFileOptUris: [],
    };

    me.doc = dokken;
    me.filesDug = me.doc.getElementById('filesDug');
    me.out = me.doc.getElementById('output');


    /**
     * Set the main message area's content.
     */
    me.toOut = function toOut(newContent) {
        try {
            me.out = me.doc.getElementById('output');
            me.out.innerHTML = newContent;
        }
        catch(error) {
            console.log('[Output] Could not write to doc, it is a Dead Object.');
            console.log('[Output] tried to say: ' + newContent);
        }
    };


    /**
     * Update the document object Output is using for output.
     * In FF, every time the popup closes me.doc becomes a Dead Object.
     */
    me.setDoc = function setDoc(dok) {
        me.doc = dok;
        me.filesDug = me.doc.getElementById('filesDug');
        me.out = me.doc.getElementById('output');
    }
    

    /**
     * Clear the filesDug <ul> of any child nodes.
     */
    me.clearFilesDug = function clearFilesDug() { 
        var childNodes = [];

        try {
            childNodes = me.filesDug.childNodes;
        }
        catch(err) {
            console.log('[Output] Cannot clear file entries, doc reference is a Dead Object.');
            return;
        }

        while (childNodes.length > 0) {
            me.filesDug.removeChild(me.filesDug.firstChild);
        }
    };

    
    /*
     * Reset the output to blank file data.
     */
    me.resetFileData = function resetFileData() {
        me.fileOptMap = {};
        me.dugUris.splice(0);
        me.failedUris.splice(0);
        me.checkedFileOptUris.splice(0);
    }


    /**
     * Set the corresponding <li> in the filesDug <ul> to the downloading class.
     */
    me.setEntryAsDownloading = function setEntryAsDownloading(idx) {   
        var entry = undefined;

        try {
            entry = me.doc.getElementById('fileEntry' + idx);
        }
        catch(error) {
            console.log('[Output] Cannot set entry as downloading. doc reference is a Dead Object.');
        }
        
        if (entry) { 
            entry.className = 'downloading';
        }
    };


    /**
     * Find an entry, update its text and classname. 
     */
    function setEntryToState(id, entry, state) {
        var fEntry = undefined;
        
        try {
            fEntry = me.doc.getElementById('fileEntry' + id);
        }
        catch(error) {
            console.log('[Output] Cannot change file entry state. doc ref is a Dead Object.');
        }
        
        if (fEntry) {
            if (entry) { 
                fEntry.innerHTML = entry;
            }
            fEntry.className = state;
        }
    }

    /**
     * Find an entry by its id. Update its text to the found zoomUri
     */
    me.setEntryAsDug = function setEntryAsDug(id, entry) {
        me.dugUris.push(id+'');
        setEntryToState(id, entry, 'dug');
    };


    /**
     * Find an entry by its id. Update its text, generally to '[failed]'
     */
    me.setEntryAsFailed = function setEntryAsFailed(id, entry) {
        me.failedUris.push(id+'');        
        setEntryToState(id, entry, 'failed');
    };


    /**
     * Create a new <li> for the entry, name it with the id, and append it to the filesDug <ul>.
     */
    me.addNewEntry = function addNewEntry(id, uri) {
        me.fileOptMap[id+''] = uri;
        
        return new Promise(function(resolve, reject) { 
            setTimeout(function asyncAddNewEntry() {
                var newLi = undefined; 
                
                try {
                    newLi = me.doc.createElement('li');
                }
                catch(error) {
                    console.log('[Output] Could not create new file entry. doc reference is a Dead Object.');
                    resolve({
                        id: id+'',
                        uri: uri,
                    });
                    return;
                }

                var newContent = me.doc.createTextNode(uri);
                newLi.id = 'fileEntry' + id;
                newLi.className = 'found';
                newLi.dataset.initialUri = uri;
                newLi.appendChild(newContent);
                
                me.filesDug.appendChild(newLi);

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
    me.deleteEntry = function deleteEntry(id) {    
        var fileLi = undefined;
        
        try {
            fileLi = me.doc.querySelector('#fileEntry' + id);
        }
        catch(error) {
            console.log('[Output] Could not delete entry. doc reference is a Dead Object.');
        }

        if (fileLi) {
            me.filesDug.removeChild(fileLi);
        }
    };


    /**
     * Add a checkbox-label pair to the list. The checkbox is clickable to download the uri listed
     * in the label. 
     */
    me.addFileOption = function addFileOption(fileOpt) {
        var checkbox = undefined;
        
        try {
            checkbox = me.doc.createElement('input');
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
        
        var thumbHolder = me.doc.createElement('div');

        var thumbImg = me.doc.createElement('img');
        thumbImg.src = fileOpt.thumbUri;
        thumbHolder.appendChild(thumbImg);

        var nameLabel = me.doc.createElement('label');
        nameLabel.setAttribute('for', checkbox.name);
        var fileName = fileOpt.filePath.substring(fileOpt.filePath.lastIndexOf('/') + 1);

        if (fileName.trim() === '') {
            fileName = 'g_img.jpg';
        }

        var nameContent = me.doc.createTextNode(fileName);
        nameLabel.appendChild(nameContent);

        var newLi = me.doc.createElement('li');
        newLi.appendChild(checkbox);
        newLi.appendChild(thumbHolder);
        newLi.appendChild(nameLabel);
        newLi.id = 'fileEntry' + fileOpt.id;
        newLi.className = 'opt';
        
        me.filesDug.appendChild(newLi);

        me.doc.getElementById(checkbox.id).addEventListener('click', function whenFileOptClicked(event) {
            var cb = event.currentTarget;
            cb.checked = true;
            cb.disabled = true;

            if (!!cb.dataset.filePath) {
                var p = fileOpt.onSelect(cb.value, cb.dataset.filePath+'', me);
                
                if (!!p && !!p.then) {
                    p.then(function() {
                        setFileOptUriChecked(cb.value);
                    });
                }
            }
            else {
                setFileOptUriChecked(cb.value);
            }
        });
    };


    /**
     * Track which file options have been checked.
     */
    function setFileOptUriChecked(uri) {
        if (me.checkedFileOptUris.indexOf(uri) === -1) {
            me.checkedFileOptUris.push(uri);
        }
    }


    /**
     * hide the digging/scraping buttons.
     */
    me.hideDigScrapeButtons = function hideDigScrapeButtons() {
        try {
            me.doc.getElementById(me.BUTTON_HOLDER_ID).style.display = 'none';
        }
        catch(error) {
            console.log('[Output] Could not hide dig/scrape buttons. doc ref is a Dead Object.');
        }
    };


    /**
     * hide the downloading buttons.
     */
    me.hideActionButtons = function hideActionButtons() {
        try {
            me.doc.getElementById(me.ACTION_HOLDER_ID).style.display = 'none';       
        }
        catch(error) {
            console.log('[Output] Could not hide action buttons. doc ref is a Dead Object.');
        } 
    };


    /**
     * Unhide the digging/scraping buttons.
     */
    me.showDigScrapeButtons = function showDigScrapeButtons() {
        me.hideActionButtons();

        try {
            me.doc.getElementById(me.BUTTON_HOLDER_ID).style.display = 'block';
            me.doc.getElementById(me.MAIN_BUTTONS_HOLDER_ID).style.display = 'block';
        }
        catch(error) {
            console.log('[Output] Could not show dig/scrape buttons. doc ref is a Dead Object.');
        }        
    };

    /**
     * Unhide the downloading buttons.
     */
    me.showActionButtons = function showActionButtons() {
        me.hideDigScrapeButtons();

        try {
            me.doc.getElementById(me.ACTION_HOLDER_ID).style.display = 'block';
            me.doc.getElementById(me.GET_ALL_JPG_OPTS_ID).focus();
        }
        catch(error) {
            console.log('[Output] Could not show action buttons. doc ref is a Dead Object.');
        }
    };


    /**
     * Set flag letting the Output know digging is going on.
     */
    me.setIsDigging = function setIsDigging(isDigging) {
        me.appIsDigging = isDigging;
    };


    /**
     * Set flag letting the Output know scraping is going on.
     */
    me.setIsScraping = function setIsScraping(isScraping) {
        me.appIsScraping = isScraping;
    };


    /**
     * Restore file list on the popup when we are digging/scraping still.
     */
    me.restoreFileList = function restoreFileList() {
        console.log('[Output] restoreFileList was called.');

        if (me.appIsDigging || me.appIsScraping) {
            console.log('[Output] detected digging/scraping going on.');

            var pChain = Promise.resolve(true);

            for (var k in me.fileOptMap) {
                var func = buildEntryAdder(k, me.fileOptMap[k]);
                pChain = pChain.then(func).then(restoreEntryStatus);
            }

            console.log('[Output] set up the restore-file-list promise chaining.');
        }
    };

    
    /**
     * Helper to avoid unintentional closures.
     */
    function buildEntryAdder(id, uri) {
        return (
            function() {
                return me.addNewEntry(id, uri);
            }
        );
    }


    /**
     * Set the state of entries in the file list. Used by the popup to restore screen data.
     */
    function restoreEntryStatus(entryObj) {
        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                if (me.dugUris.indexOf(entryObj.id) !== -1) {
                    me.setEntryAsDug(entryObj.id, entryObj.uri);
                }
                else if (me.failedUris.indexOf(entryObj.id) !== -1) {
                    me.setEntryAsFailed(entryObj.id, entryObj.uri);
                }
                resolve(true);
            }, 1);
        });
    }

    // return the instance
    return me;
});