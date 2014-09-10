# Expletive Deleted

This is an experimental implementation of a video player with customizable audio and video filtering for "objectionable" or "indecent" content, using "bleeps" and a pixelation effect similar to broadcast TV censorship.

[Read the blog post](http://www.pbs.org/pov/blog/povdocs/2014/09/expletive-undeleted-real-time-bleeps-and-blurs-for-web-video/) for a full discussion of the motivation behind this project.

## Instructions

[View live demo](http://povdocs.github.io/expletive-deleted/)

You can customize the filter settings by toggling the options below the video player. Changes should be reflected in the video immediately. At the bottom of the form is a text input containing code for an iframe, which you can copy and paste to embed the video with the configuration you selected.

### Changing the video

You'll need to host your own video files and change the video sources to point to those files, for both MP4 and WebM so you can support all modern browsers. The URLs of the video source files are hard-coded into main.js, so you'll need to change them there. Due to a [bug](https://bugzilla.mozilla.org/show_bug.cgi?id=937718) in Firefox's implementation of the Web Audio API, it is necessary to have multiple versions of the WebM video: one for each likely audio sample rate. 48khz and 44.1khz should be sufficient to cover most devices.

It is advised to change the `FRAME_RATE` variable in `main.js` to the frame rate of your video so the time codes are parsed correctly. Unfortunately, browsers do not have a way to determine the frame rate of your video file on its own, so you have to specify it manually.

### Editing the data file

Data are stored in `data/words.json`. As there is no graphical editor, parameters for each filtered word or image must be edited manually. Filters can either "bleep" the audio or cover/pixelate a selected area, or both.

Each filterable word is described as an object that looks like this:

	{
		"word": "balderdash",
		"start": "2:13.5",
		"end": "2:13.82",
		"bleep": true,

		"cover": true,
		"x": 230,
		"width": 60,
		"y": 240,
		"height": 30,

		"note": "don't give me no balderdash about eating vegetables"
	},

`start` and `end` fields represent the starting and ending points in the video for that word. You can use SMTP time code to get the exact frame, provided you specify the frame rate as above, or you can use a floating point number representing the time in seconds.

`bleep` is a boolean that determines whether or not to mute the audio and replace it with a tone. This field is optional and is true by default. You can turn this off if you want to block part of an image that is unrelated to or timed differently from a section of audio.

`cover` is a boolean value that determines whether or not to block the given rectangle in the video. This will be done with a pixelation effect if WebGL is available. Otherwise, it will be covered by a black rectangle.

`x`, `y`, `width` and `height` represent the rectangle around the target area of the video to be filtered. These values are in pixels, relative to the pixel dimensions of the unscaled video.

The rectangle values can be keyframe-animated by defining each value as an object. Refer to the [Popcorn Base documentation](https://github.com/brianchirls/popcorn-base#animate-param-options) for instructions on how these values are specified. If possible, it is best to only animate `x` and `y`, while leaving `height` and `width` fixed, as this is better for performance.

The `note` field is ignored, but it is useful as an annotation to make reading the data easier. (The JSON format does not allow comments.) You can add any additional fields you want as annotations, and they will be ignored.

## Technology

This experiment makes use of the following tools and technology:
- HTML video - playing and manipulating video
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) - muting audio and generating "bleep" tone
- [Popcorn.js](https://github.com/mozilla/popcorn-js) - manage timing of the filter data
- [Popcorn Base Plugin](https://github.com/brianchirls/popcorn-base) - keyframe animation of shot parameters
- [Seriously.js](http://github.com/brianchirls/Seriously.js/) - run the pixelate effect

## Known Issues
This is an experimental prototype designed to test a concept, so it's not a fully fleshed out and tested piece of software.

- The video player is very basic. A fully functional embedded player would have a more complete API.
- Tested successfully in Chrome (mobile and desktop). Other browsers have bugs in Web Audio API that prevent it from working. With a little more work, it is possible to set the video volume directly without the Web Audio API, except on Mobile Safari, where that feature is disabled.
- The demo is broken in Firefox due to a bug where Web Audio API does not work with cross-origin content.

## License
- Original code is made avalable under [MIT License](http://www.opensource.org/licenses/mit-license.php), Copyright (c) 2014 American Documentary Inc.
- Video clip from "Where Soliders Come From" - Copyright 2011 Quincy Hill Films. All rights reserved.
- [Popcorn.js](https://github.com/mozilla/popcorn-js#license) and [Popcorn Base plugin](https://github.com/brianchirls/popcorn-base#license) are each distributed here under license from their respective authors

## Authors
- Code, concept and design by [Brian Chirls](https://github.com/brianchirls), [POV](http://www.pbs.org/pov/) Digital Technology Fellow
- Video clip from "Where Soliders Come From" by Heather Courtney (Copyright 2011 Quincy Hill Films)
