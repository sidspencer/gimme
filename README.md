# gimme gimme gimme
A [Browser Extension](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions) for downloading media from webpages, especially tuned for downloading image galleries with thumbnails that point to detail pages with large versions of the image on them. It also supports downloading the media shown on a page, and even digging galleries of galleries. You'll find code for experimental features for downloading audio and for downloading video (the buttons are just hidden), but the image gallery digging is always priority #1.

Two terms are used for the automatic media-finding: Dig and Scrape. Dig is for galleries, and galleries of galleries -- sites where one must dig into the detail pages to find the original media. Scrape is for getting media that is directly on the page.

As mentioned before, code is there to download video and audio files as well, but is not currently exposed and has not been tested much. Feel free to un-hide the extra buttons in popup/style.css to download the other media types. The event handlers and back-end are all set up, just the buttons are hidden.

This extension works with Chrome, Firefox, and Edge -- it can be found in all three extension stores in addition to in this repo.


## last time: v0.4.14
Glaring problems that plagued v0.4.13 and earlier were tracked-down and fixed. Most crashes, hangs, and times when it missed obvious matches are resolved. It even does better with lazy-loaded galleries. But the killer feature: there's a little "back to top" arrow on the popup list of files. (LOL, but seriously, it saves some time.)


## current effort: v0.4.15

### Planned Features:
- There will be more stability, increased heuristic accuracy, and better use of TF. (vague, puttering goals) 
-  Make the `[STOP]` button work. Properly cancel the promises, stop the XHRs in flight, stop all the digging... Plumbing is there, but it doesn't work.
- Properly handle gallery URI redirects off links around gallery-gallery thumbs. We currently fail to pick up the redirect, and just fail at finding the gallery. We need to do a `HEAD` request to each of the gallery-gallery links to catch any `request.redirectURL` values and use those.


### Bug Fixes:
- Added-in code to handle redirects at the zoom-img level. (`response.redirectURL`)
- Fixed a bug in the background-page iframe code in Utils that was not properly reject()-ing when removing iframe from the page. That increased the speed of digs.
- Enhanced the "stop" handler in Utils to be only **one event handler** that goes through all the XHRs, instead of adding a new "stop" handler for each XHR.


## ...The Future
oh so many things! 

### Punted Features.
- Storing each gallery structure we discover. The plumbing has been done for recording, but it will need to be exposed to the options page.
- The options page needs to get another section matching "messages", but for the structure of **gallery-galleries** specifically. (Currently we're using the same site "messages" entry for both gallery-gallery and img gallery. Confused Badness currently reigns.)

### Pipe-Dreams
- Machine Learning of gallery structures, applying previously known structures that have similar traits to the current gallery being inspected.
- `[STOP]` working 100% right.

## Building
Follow the instructions below. That's all! To run in your browser, either zip it up and add it, or load it as an unpacked extension (dev mode) from the repo root directory. (Please note that the html components all reference the bundle.js files, arnd nothing will work if you try to run without having run webpack.)

### Build instructions:

```
% # To get started the first time:
% npm install
% npm run wpack
%
% # To also clear out old bundle.js files and .map files:
% npm run build
```