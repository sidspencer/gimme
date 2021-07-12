# gimme gimme gimme
A WebExtension for downloading media from webpages, especially tuned downloading image galleries with thumbnails that point to detail pages with large versions of the image on them. It also supports downloading the media shown on a page, and digging galleries of galleries. You'll find code for experimental features for downloading audio and for downloading video (the buttons are just hidden), but the gallery digging is always priority #1.

Two terms are used for the automatic media-finding: Dig and Scrape. Dig is for galleries, and galleries of galleries -- sites where one must dig into the detail pages to find the original media. Scrape is for getting media that is directly on the page. 

As mentioned before, code is there to download video and audio files as well, but is not currently exposed and has not been tested much. Feel free to un-hide the extra buttons in popup/style.css to download the other media types. The event handlers and back-end are all set up, just the buttons are hidden.

This extension works with Chrome, Firefox, and Edge -- it can be found in all three extension stores in addition to in this repo.


# last time: v0.4.14 
Glaring problems that plagued v0.4.13 and earlier were tracked-down and fixed. Most crashes, hangs, and times when it missed obvious matches are resolved. It even does better with lazy-loaded galleries. But the killer feature: there's a little "back to top" arrow on the popup list of files.


# current effort: v0.4.15
There will be more stability, increased heuristic accuracy, better use of TF, and (hopefully) a working [STOP] button. The plumbing has been done for recording each gallery structure, so that will be exposed to the options page. The options page will also get a new section for the structure of gallery-galleries (as the gallery-gallery's structure may not match the individual gallery structures) so that you can nail down exactly what gets dug.


# ...The Future (AKA needless pipe dreams)
oh so many things!


# building
Execute "npm install" in the base "gimme" directory, then run "npm run wpack" to build the bundle.js and bundle.js.map files. That's all! Then either zip it up and add it, or just load it as an unpacked extension from the repo root directory. Please note that the html components all reference the bundle.js files, arnd nothing will work if you try to run without having executed "npm run wpack" (or "npm run build" after the first packing time)..
