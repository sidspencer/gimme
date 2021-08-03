# gimme gimme gimme
A [Browser Extension](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions) for downloading media from webpages, especially tuned for downloading image galleries with thumbnails that point to detail pages with large versions of the image on them. It also supports downloading the media shown on a page, and even digging galleries of galleries. You'll find code for experimental features for downloading audio and for downloading video (the buttons are just hidden), but the image gallery digging is always priority #1.

Two terms are used for the automatic media-finding: Dig and Scrape. Dig is for galleries, and galleries of galleries -- sites where one must dig into the detail pages to find the original media. Scrape is for getting media that is directly on the page.

As mentioned before, code is there to download video and audio files as well, but is not currently exposed and has not been tested much. Feel free to un-hide the extra buttons in popup/style.css to download the other media types. The event handlers and back-end are all set up, just the buttons are hidden.

This extension works with Chrome, Firefox, and Edge -- it can be found in all three extension stores in addition to in this repo.


## last time: v0.4.14
Glaring problems that plagued v0.4.13 and earlier were tracked-down and fixed. Most crashes, hangs, and times when it missed obvious matches are resolved. It even does better with lazy-loaded galleries. But the killer feature: there's a little "back to top" arrow on the popup list of files. (LOL, but seriously, it saves some time.)


## current effort: v0.4.15

### Planned Features:
- There will be more stability, increased heuristic accuracy, better use of TF, and (hopefully) a working [STOP] button.
- Handle gallery URIs that return a redirect. A lot of sites are doing this, and we need to handle it.
- The plumbing has been done for recording each gallery structure, so that will be exposed to the options page.
- The options page will get another section matching "messages", but for the structure of gallery-galleries specifically. (Currently we're using the same site "messages" entry for both gallery-gallery and img gallery. Confused Badness. Not everything is recursive.)

### Bug Fixes:
- Added-in code to handle redirects at the zoom-img level. (`response.redirectURL`)
- Fixed a bug in the background-page iframe code in Utils that was not properly reject()-ing when removing iframe from the page.
- Enhanced the "stop" handler in Utils to be only **one event handler** that goes through all the XHRs, instead of adding a new "stop" handler for each XHR.


## ...The Future (AKA needless pipe dreams)
oh so many things!


## building
Execute `npm install` in the base `gimme` directory, then run `npm run wpack` to build the `bundle.js` and `bundle.js.map` files. That's all! Then either zip it up and add it, or just load it as an unpacked extension from the repo root directory. (Please note that the html components all reference the bundle.js files, arnd nothing will work if you try to run without having run webpack.)

### Build instructions:

```
% # To get started the first time:
% npm install
% npm run wpack
%
% # To also clear out old bundle.js files and .map files:
% npm run build
```