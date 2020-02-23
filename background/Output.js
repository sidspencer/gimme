'use strict'

/**
 * Factory function for bridging the services with the UI.
 */
var Output = (function Output(dokken) {
    // instance
    var me = {
        ACTION_HOLDER_ID: 'actionHolder',
        BUTTON_HOLDER_ID: 'buttonHolder',
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

    if (Array.isArray(me.doc.checkedFileOptUris)) {
        me.checkedFileOptUris = me.doc.checkedFileOptUris;
    }
    else {
        me.doc.checkedFileOptUris = me.checkedFileOptUris;
    }
    

    /**
     * Set the main message area's content.
     */
    me.toOut = function toOut(newContent) {
        me.out.innerHTML = newContent;
    };


    /**
     * 
     */
    me.setDoc = function setDoc(dok) {
        me.doc = dok;
        me.filesDug = me.doc.getElementById('filesDug');
        me.out = me.doc.getElementById('output');

        if (Array.isArray(dok.checkedFileOptUris)) {
            me.checkedFileOptUris = dok.checkedFileOptUris;
        }
        else {
            dok.checkedFileOptUris = me.checkedFileOptUris;
        }
    }
    

    /**
     * Clear the filesDug <ul> of any child nodes.
     */
    me.clearFilesDug = function clearFilesDug() { 
        me.fileOptMap = {};
        me.dugUris = [];
        me.failedUris = [];

        while (me.filesDug.childNodes.length > 0) {
            me.filesDug.removeChild(me.filesDug.firstChild);
        }
    };


    /**
     * Set the corresponding <li> in the filesDug <ul> to the downloading class.
     */
    me.setEntryAsDownloading = function setEntryAsDownloading(idx) {        
        var entry = me.doc.getElementById('fileEntry' + idx);
        
        if (entry) { 
            entry.className = 'downloading';
        }
    };


    /**
     * Find an entry, update its text and classname. 
     */
    function setEntryToState(id, entry, state) {
        var fEntry = me.doc.getElementById('fileEntry' + id);
        
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
                var newLi = me.doc.createElement('li');

                var newContent = document.createTextNode(uri);
                newLi.id = 'fileEntry' + id;
                newLi.className = 'found';
                newLi.dataset.initialUri = uri;
                newLi.appendChild(newContent);
                
                me.filesDug.appendChild(newLi);

                resolve({ 
                    id: id+'', 
                    uri: uri 
                });
            }, 1);
        });
    };


    /**
     * Delete a previously created file entry in the UI.
     */
    me.deleteEntry = function deleteEntry(id) {    
        var fileLi = me.doc.querySelector('#fileEntry' + id);

        if (fileLi) {
            me.filesDug.removeChild(fileLi);
        }
    };


    /**
     * Add a checkbox-label pair to the list. The checkbox is clickable to download the uri listed
     * in the label. 
     */
    me.addFileOption = function addFileOption(fileOpt) {
        var checkbox = me.doc.createElement('input');
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

        var nameContent = document.createTextNode(fileName);
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

            if (!!cb.dataset.filePath) {
                event.currentTarget.disabled = true;
                var ret = fileOpt.onSelect(cb.value, cb.dataset.filePath, me);
                
                if (!!ret && !!ret.then) {
                    ret.then(function(uri) {
                        cb.dataset.filePath = '';
                        cb.ownerDocument.checkedFileOptUris.push(cb.value);
                        setFileOptUriChecked(cb.value);
                    });
                }
                else {
                    cb.dataset.filePath = '';
                    cb.ownerDocument.checkedFileOptUris.push(cb.value);
                    setFileOptUriChecked(cb.value);
                }
            }
        });
    };


    function setFileOptUriChecked(uri) {
        me.checkedFileOptUris.push(uri);
    }


    /**
     * hide the digging/scraping buttons.
     */
    me.hideDigScrapeButtons = function hideDigScrapeButtons() {
        me.doc.getElementById(me.BUTTON_HOLDER_ID).style.display = 'none';
    };


    /**
     * hide the downloading buttons.
     */
    me.hideActionButtons = function hideActionButtons() {
        me.doc.getElementById(me.ACTION_HOLDER_ID).style.display = 'none';        
    };


    /**
     * Unhide the digging/scraping buttons.
     */
    me.showDigScrapeButtons = function showDigScrapeButtons() {
        me.hideActionButtons();
        me.doc.getElementById(me.BUTTON_HOLDER_ID).style.display = 'block';        
    };

    /**
     * Unhide the downloading buttons.
     */
    me.showActionButtons = function showActionButtons() {
        me.hideDigScrapeButtons();
        me.doc.getElementById(me.ACTION_HOLDER_ID).style.display = 'block';
        me.doc.getElementById(me.GET_ALL_JPG_OPTS_ID).focus();
    };


    /**
     * 
     */
    me.setIsDigging = function setIsDigging(isDigging) {
        me.appIsDigging = isDigging;
    };


    /**
     * 
     */
    me.setIsScraping = function setIsScraping(isScraping) {
        me.appIsScraping = isScraping;
    };


    /**
     * 
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

            console.log('[Output] set up the promise chaining.');
        }
    };

    
    function buildEntryAdder(id, uri) {
        return (
            function() {
                return me.addNewEntry(id, uri);
            }
        );
    }


    function restoreEntryStatus(entryObj) {
        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                console.log('[Output] restoring entry status.');

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