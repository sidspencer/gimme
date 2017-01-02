'use strict'

/**
 * Factory function for creating an output stream.
 */
var Output = (function Output(dokken) {
    var me = {};
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
        
        newLi.innerHTML = entry;
        newLi.id = 'fileEntry' + id;
        newLi.className = 'found';
        
        me.filesDug.appendChild(newLi);
    }



    // Return the object;
    return me;
});