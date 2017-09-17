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
    };
    me.doc = dokken;
    me.filesDug = me.doc.getElementById('filesDug');
    me.out = me.doc.getElementById('output');


    /**
     * Set the main message area's content.
     */
    me.toOut = function toOut(newContent) {
        me.out.innerHTML = newContent;
    };
    

    /**
     * Clear the filesDug <ul> of any child nodes.
     */
    me.clearFilesDug = function clearFilesDug() {        
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
     * Find an entry by it's id. Update its text to the found zoomUri
     */
    me.setEntryAsDug = function setEntryAsDug(id, entry) {        
       setEntryToState(id, entry, 'dug');
    };


    /**
     * Find an entry by it's id. Update its text, generally to '[failed]'
     */
    me.setEntryAsFailed = function setEntryAsFailed(id, entry) {        
        setEntryToState('failed');
    };


    /**
     * Create a new <li> for the entry, name it with the id, and append it to the filesDug <ul>.
     */
    me.addNewEntry = function addNewEntry(id, uri) {
        setTimeout(function asyncAddNewEntry() {        
            var newLi = me.doc.createElement('li');

            var newContent = document.createTextNode(uri);
            newLi.id = 'fileEntry' + id;
            newLi.className = 'found';
            newLi.dataset.initialUri = uri;
            newLi.appendChild(newContent);
            
            me.filesDug.appendChild(newLi);
        }, 1);
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
                fileOpt.onSelect(cb.value, cb.dataset.filePath);
                cb.dataset.filePath = '';
            }
        });
    };


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


    // return the instance
    return me;
});