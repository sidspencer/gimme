# gimme gimme gimme
A [Browser Extension](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions) for downloading media from webpages, especially tuned for downloading image galleries with thumbnails that point to detail pages with large versions of the image on them. It also supports downloading the media shown on a page, and even digging galleries of galleries. You'll find code for experimental features for downloading audio and for downloading video (the buttons are just hidden), but the image gallery digging is always priority #1.

Two terms are used for the automatic media-finding: Dig and Scrape. Dig is for galleries, and galleries of galleries -- sites where one must dig into the detail pages to find the original media. Scrape is for getting media that is directly on the page.

As mentioned before, code is there to download video and audio files as well, but is not currently exposed and has not been tested much. Feel free to un-hide the extra buttons in popup/style.css to download the other media types. The event handlers and back-end are all set up, just the buttons are hidden.

This extension works with Chrome, Firefox, and Edge -- it can be found in all three extension stores in addition to in this repo.


## last time: v0.4.14
Glaring problems that plagued v0.4.13 and earlier were tracked-down and fixed. Most crashes, hangs, and times when it missed obvious matches are resolved. It even does better with lazy-loaded galleries. But the killer feature: there's a little "back to top" arrow on the popup list of files. (LOL, but seriously, it saves some time.)


## current effort: v0.4.15, manifest v3
So no one is allowed to upload manifest v2 extensions to the Chrome store as of last month. I missed the memo, but I'm on it now. Also there are some major bugs crippling the Options page and I finally got the stop button working way better, so v.4.15 will likely end up being released very soon as a bugfix release. All the bugs I've found are bug fixes that should go out **now**. Sadly, I had to remove the TensorFlow AI from the extension's toolkit because the not-so-great matches weren't worth the horrible slowdowns and browser-crashing memory usage. (I hope to be able to replace its image-matching-AI soon with either a lighter library, or with a service.) Yeah, bugs slightly better.



# ...The Future (AKA needless pipe dreams) v0.4.15 - v 0.4.18 Roadmap
Y'all know there are some pet features I keep wanting to work on, but they keep shuffling. I kicked the tires on other downloaders that include gallery download support, but the gallery structure must be in their own definitions file, and that's just silly. But it made me realize that I could add lots of value by improving the Options page (especially in my namings), and being able to import and export flat files of the gallery definitions would be very useful. At the very least, you could set up other accounts with your gallery definition overrides easily, and I might even get in the business of publishing static maps to match the other downloaders. I want this to go out with the storing of the program's discovered structures for galleries too (which is being tracked and recorded, but not yet available in Options). I just need to do it with good descriptions and better UI. It'll get users.

### v0.4.17 
This will probably end up as a bug-fix release for the ambitious stuff I have planned for v0.4.16!

### v0.4.18
Extensions must migrate to manifest v3 using webworkers before 2022 to stay compatible with Chrome. I don't know how easy it will be to port to
a webworker way of background processing -- it depends on async and Promise behavior -- but it **must** be done.


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
