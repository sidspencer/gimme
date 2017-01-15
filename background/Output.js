'use strict'

/**
 * Factory function for creating an output stream.
 */
var Output = (function Output(dokken) {
    var me = {
        ACTION_HOLDER_ID: 'actionHolder',
        FILES_DUG_ID: 'filesDug',
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
    }


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
     * Find an entry by it's id. Update its text
     */
    me.setEntryAsDug = function setEntryAsDug(id, entry) {
        var fEntry = me.doc.getElementById('fileEntry' + id);
        
        if (fEntry) {
            if (entry) { 
                fEntry.innerHTML = entry;
            }
            fEntry.className = 'dug';
        }
    }


    /**
     * Create a new <li> for the entry, name it with the id, and append it to the filesDug <ul>.
     */
    me.addNewEntry = function addNewEntry(id, entry) {
        var newLi = me.doc.createElement('li');
        
        var newContent = document.createTextNode(entry);
        newLi.id = 'fileEntry' + id;
        newLi.className = 'found';
        newLi.appendChild(newContent);
        
        me.filesDug.appendChild(newLi);
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

        var nameLabel = me.doc.createElement('label');
        nameLabel.setAttribute('for', checkbox.name);
        var nameContent = document.createTextNode(fileOpt.filePath);
        nameLabel.appendChild(nameContent);

        var newLi = me.doc.createElement('li');
        newLi.appendChild(checkbox);
        newLi.appendChild(nameLabel);
        newLi.id = 'fileEntry' + fileOpt.id;
        newLi.className = 'found';
        
        me.filesDug.appendChild(newLi);

        me.doc.getElementById(checkbox.id).addEventListener('click', function whenFileOptClicked(event) {
            var cb = event.currentTarget;
            console.log('WhenClicked! ' + event.currentTarget.id + '');

            if (!!cb.dataset.filePath) {
                event.currentTarget.disabled = true;
                fileOpt.onSelect(cb.value, cb.dataset.filePath);
                cb.dataset.filePath = '';
            }
        });
    };


    /**
     * Should we show the "action" buttons for the file option list?
     */
    me.showActionButtons = function showActionButtons() {
        me.doc.getElementById(me.ACTION_HOLDER_ID).style.display = 'block';
    };



    // Return the object;
    return me;
});