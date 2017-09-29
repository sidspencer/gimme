'use strict'

var Optionator = (function Optionator(doc) {
    // The default spec, used mainly as a guide.
    var defaultSpec = {
        messages: [
            {
                match: '/greentextonblack\.net\//',
                thumb: 'img.thumb[data-src]',
                src: 'dataset.src',
                link: 'a.link[href]',
                href: 'href'
            }
        ],
        processings: [
            {
                match: '/greentextonblack\.net\//',
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
                        match: '/\/fakeout\//',
                        new: '/realpath/'
                    }
                ],
                dig: true,
                scrape: false
            }
        ],
        blessings: [
            {
                match: '/greentextonblack\.net\//',
                zoom: 'img.zoomed'
            }
        ]
    };

    // Store the elements.
    var specInput = doc.getElementById('spec');
    var statusDiv = doc.getElementById('status');
    var setButton = doc.getElementById('set');

    /**
     * Get the options from storage. By default give dummy values defined
     * above.
     */
    function getSpec() {
        chrome.storage.sync.get({
                spec: defaultSpec
            }, 
            function storageRetrieved(storage) {
                specInput.value = JSON.stringify(storage.spec).
                    replace(/\,/g, ',\n').
                    replace(/\"(\w+)\"\:/g, '$1:').                
                    replace(/\{/g, '\n{\n').
                    replace(/\}/g, '\n}\n');
                    //replace(/\[/g, '\n[\n').
                    //replace(/\]/g, '\n]\n');
            }
        );
    }


    /**
     * Set the values typed into the textarea. If it does not parse, then 
     * say so in the status and do not actually set.
     */
    function setSpec() {
        var parsedSpec = {};
        try {
            parsedSpec = stringToJson(specInput.value);
        }
        catch (e) {
            console.log('[Options] Error: ' + JSON.stringify(e));

            statusDiv.style.display = 'block';
            statusDiv.textContent = "bad spec notation. please check it and try again.";
            
            return;
        }

        chrome.storage.sync.set({
                spec: parsedSpec
            },
            function storageSet() {
                statusDiv.style.display = 'block';
                statusDiv.textContent = 'spec set successfully.'

                setTimeout(function clearMessage() {
                    statusDiv.style.display = 'none';
                    statusDiv.textContent = '';
                }, 750);
            }
        );
    }


    /**
     * Take an object string, and insert the proper quotes to make it JSON.
     */
    function stringToJson(str) {
        var jankyJson = str;
        
        // Remove all newlines. Unquote keys that are quoted. 
        jankyJson = jankyJson.
            replace(/\n/g, '').
            replace(/\'(\w+)\'\:/g, '$1:');

        // Quote all the keys.
        jankyJson = jankyJson.replace(/(\w+)\:/g, '"$1":');

        // Double all the backslashes.
        jankyJson = jankyJson.replace(/\\/g, '\\');

        return JSON.parse(jankyJson);
    }


    // Hook up the event handlers.
    doc.addEventListener('DOMContentLoaded', getSpec);
    doc.getElementById('set').addEventListener('click', setSpec);
})(document);