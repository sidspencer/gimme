# gimme gimme gimme
A WebExtension for downloading media from webpages, especially tuned downloading image galleries with thumbnails that point to detail pages with large versions of the image on them. It also supports downloading the media shown on a page, and digging galleries of galleries. You'll find code for experimental features for downloading audio and for downloading video (the buttons are just hidden), but the gallery digging is always priority #1.

Two terms are used for the automatic media-finding: Dig and Scrape. Dig is for galleries, and galleries of galleries -- sites where one must dig into the detail pages to find the original media. Scrape is for getting media that is directly on the page. 

As mentioned before, code is there to download video and audio files as well, but is not currently exposed and has not been tested much. Feel free to un-hide the extra buttons in popup/style.css to download the other media types. The event handlers and back-end are all set up, just the buttons are hidden.

This extension works with Chrome, Firefox, and Edge -- it can be found in all three extension stores in addition to in this repo.


# v0.4.13
Bugfixes were plentiful. Lots of valid images were being discarded for nitpicky ivory-tower-only reasons. Upgraded npm packages too.

Updated options/preferences page to work again.

# v0.4.14... The Future
I was trying to get this done for v0.4.13, but there are bug fixes that need to go out **now**, so it must wait. So the next feature emphasis will be on saving the "Gallery Definition" **selectors** that match the links and thumbnails and full-sized images for a website's types of galleries. For each element selector per element type that we find, that data goes into the Options/Preferences waiting for you to review it and save it just as if you had configured it completely manually. This way you can edit up each gallery definition to make discovering galleries and their assets lightning-fast the next time you run gimme against galleries on that site. Saving the discovered selectors automatically for your review might not be as sexy as real ML or AI, but it accelerates downloading from sites dramatically. Suddenly, instead of needing to run a significant set of heuristics and some ML to try to get the right data, now Gimme only needs to run a few calls to `querySelectorAll()` based on the site's Gallery Definition, seeming almost instantaneous. Sorry I didn't get this done for v0.4.13. Stay tuned!

# building
Execute "npm install" in the base "gimme" directory, then run "npm run pack" to build the bundle.js and bundle.js.map files. That's all! Then either zip it up and add it, or just load it as an unpacked extension from the repo root directory. Please note that the html components all reference the bundle.js files, arnd nothing will work if you try to run without having executed "npm run pack".
