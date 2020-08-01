# gimme gimme gimme
A WebExtension for downloading media from webpages, especially tuned downloading image galleries with thumbnails that point to detail pages with large versions of the image on them. It also supports downloading the media shown on a page, and digging galleries of galleries. You'll find code for experimental features for downloading audio and for downloading video (the buttons are just hidden), but the gallery digging is always priority #1.

Two terms are used for the automatic media-finding: Dig and Scrape. Dig is for galleries, and galleries of galleries -- sites where one must dig into the detail pages to find the original media. Scrape is for getting media that is directly on the page. 

As mentioned before, code is there to download video and audio files as well, but is not currently exposed and has not been tested much. Feel free to un-hide the extra buttons in popup/style.css to download the other media types. The event handlers and back-end are all set up, just the buttons are hidden.

This extension works with Chrome, Firefox, and Edge -- it can be found in all three extension stores in addition to in this repo.

# v0.4.10
This release has been focused around refactoring, extracting constants, and the long-planned feature of being able to _Stop_ long-running dig and scrape operations (such as in a 100-page gallery-gallery dig). The refactoring and extracting, updating to using ES6 features (right now with [babel](https://github.com/babel/) and [webpack](https://webpack.js.org/)), is letting the code evolve organically along with the greater features as they come available. Yet also, this process has been directly pointing out fundamental weaknesses of the codebase. 

One of these weaknesses was that I never implemented a _Stop_ button to end a long-running `dig` or `scrape` operation. I had planned to create one way before now, and had baked the notion of there being a _Stop_ button into the very first promise-chains. It doesn't work perfectly, or always quickly. However, it is there. Now if you really want that 500-gallery-gallery-dig to end its resource-plundering and give you control of your browser and network bandwidth back, you can have it with the _Stop_ button.

The download system also got light shined on its shortcomings, so I rearranged and fixed up the download queue. It had missed a link in the promise-chaining, which was causing all the download requests to be sent from gimme almost all-at-once to the browser, causing the whole browser to freeze and become unresponsive for even minutes until it had caught up (and usually aborted most of the requested downloads). This has been fixed, and now a steady stream of downloads gets sent to the browser, spaced by 10 concurrent promise-chains of download channels.

Options/Preferences got broken at some point, with Dominatrix no longer building subforms for object-type configuration values. Fixing that is also in the list of improvements.

# building
Execute "npm run pack" in the base directory to build the bundle.js and bundle.js.map files. That's all! Then either zip it up and add it, or just load it as an unpacked extension from the repo root directory. Please note that the html components all reference the bundle.js files only
