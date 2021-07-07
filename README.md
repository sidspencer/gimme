# gimme gimme gimme
A WebExtension for downloading media from webpages, especially tuned downloading image galleries with thumbnails that point to detail pages with large versions of the image on them. It also supports downloading the media shown on a page, and digging galleries of galleries. You'll find code for experimental features for downloading audio and for downloading video (the buttons are just hidden), but the gallery digging is always priority #1.

Two terms are used for the automatic media-finding: Dig and Scrape. Dig is for galleries, and galleries of galleries -- sites where one must dig into the detail pages to find the original media. Scrape is for getting media that is directly on the page. 

As mentioned before, code is there to download video and audio files as well, but is not currently exposed and has not been tested much. Feel free to un-hide the extra buttons in popup/style.css to download the other media types. The event handlers and back-end are all set up, just the buttons are hidden.

This extension works with Chrome, Firefox, and Edge -- it can be found in all three extension stores in addition to in this repo.


# v0.4.13
Bugfixes were plentiful. Lots of valid images were being discarded for nitpicky ivory-tower-only reasons. Upgraded npm packages too.

Updated options/preferences page to work again.

# v0.4.14 
Glaring problems that plagued v0.4.13 have been tracked-down and fixed!! The v0.4.14 branch was finally created and dedicated to making GimmeGimmeGimme a better product. That's the priority, getting you the media desired repeatably and faster. Those TypeScript and gallery-def "ML" bits will wait. (See "The Future" below.)
-Lazy-loaded thumbnails for a gallery always resulted in only one media match, as all the thumbUris point to the same thumbnail image file at the same at the time of the gallery
scraping. Now, when dupe thumb uri values are found, they are salted in their querystring with an extra param. This fixes about 80% of the times Gimme would fail miserably and only
return one zoom-item! Now, with the salting, the map structures are resiliant in the face of these lazy, tricky galleries, and the full-sized linked zoom-media gets correctly identified, harvested, and presented as options. The text for the options is already correct, but for clarity we need to add a built-in thumb image to semantically represent what's going on.
-TensorFlow classifications were getting their Promise resolves and rejections seriously messed-up. Some code paths failed to yield any type of resolution whatsoever, and that was why there were so many near-permanent hangs only recoverable via reloading the extension or quitting and restarting the browser. The bugs were deep and convoluted in our promise structures built for the TF classifications, and took a lot of teasing out. Now the damn thing works way more reliably, and doesn't waste your time by processing 90% of a huge gallery-gallery-dig only to stop dead and piss you off.
-Meanwhile: the webpack and babel usage has been further refined, libs have been pegged to specific versions, downloading has had its perf improved a bit, comments have been iterated on, some code naming issues are better, and it's on a more alright trajectory again.
-Other stuff and fixes etc la la la who fucking cares. The new mantra is RELIABILITY AND USABILITY. This is still just code-noodling at the end of the day, but it shouldn't make you want to pull your hair out from frustration.
-The best update so far is the "go back to the top" arrow in the popup. Oh, Totally.

# ...The Future (AKA needless pipe dreams)
I was trying to get this done for v0.4.14, but there are bug fixes that need to go out **now**, so it must wait. So the next feature emphasis will be on saving the "Gallery Definition" **selectors** that match the links and thumbnails and full-sized images for a website's types of galleries. For each element selector per element type that we find, that data goes into the Options/Preferences waiting for you to review it and save it just as if you had configured it completely manually. This way you can edit up each gallery definition to make discovering galleries and their assets lightning-fast the next time you run gimme against galleries on that site. Saving the discovered selectors automatically for your review might not be as sexy as real ML or AI, but it accelerates downloading from sites dramatically. Suddenly, instead of needing to run a significant set of heuristics and some ML to try to get the right data, now Gimme only needs to run a few calls to `querySelectorAll()` based on the site's Gallery Definition, seeming almost instantaneous. Sorry I didn't get this done for v0.4.13. Stay tuned!

# building
Execute "npm install" in the base "gimme" directory, then run "npm run pack" to build the bundle.js and bundle.js.map files. That's all! Then either zip it up and add it, or just load it as an unpacked extension from the repo root directory. Please note that the html components all reference the bundle.js files, arnd nothing will work if you try to run without having executed "npm run pack".
