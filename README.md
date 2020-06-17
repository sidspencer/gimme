# gimme gimme gimme
A WebExtension for downloading media from webpages, especially tuned for downloading image galleries with thumbnails that point to detail pages with large versions of the image on them. It also supports downloading the media shown on a page, and digging galleries of galleries. You'll find code for experimental features for downloading audio and for downloading video (the buttons are just hidden), but the gallery digging is always priority #1.

Two terms are used for the automatic media-finding: Dig and Scrape. Dig is for galleries, and galleries of galleries -- sites where one must dig into the detail pages to find the original media. Scrape is for getting media that is directly on the page. 

As mentioned before, code is there to download video and audio files as well, but is not currently exposed and has not been tested much. Feel free to un-hide the extra buttons in popup/style.css to download the other media types. The event handlers and back-end are all set up, just the buttons are hidden.

This extension works with Chrome, Firefox, and Edge but are not on the extension/add-on stores currently due to using some banned APIs. I'm working on fixing that.

# v0.4.7
This release contains JS code modernization, and most importantly image matching with TensorFlow's pre-trained Mobilenet model at the second-to-last search depth (4) for Digging a gallery. Being at search depth 4 means that the TF matching will only execute after the configured and built-in heuristics fail to find anything good, but before using the very heavyweight method of loading zoom pages in hidden iframes and attempting to wait for the zoom page's onload JS to be done.

# building
Execute "npm run pack" in the base directory to build the bundle.js and bundle.js.map files. That's all! Then either zip it up and add it, or just load it as an unpacked extension from the repo root directory. Please note that the html components all reference the bundle.js files only
