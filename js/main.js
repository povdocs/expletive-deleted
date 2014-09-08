(function (window) {
	/*
	There are numerous attempts at hacks to make iOS work, but it's pointless because:
	a) iOS blocks controlling of volume on the media element and
	b) Web Audio API gain node doesn't work in any Safari when the source is a media element
	So there's no way to silence the audio track.
	*/
	var VIDEO_PATH = 'video/', // http://pov-tc.pbs.org/pov/flv/2014/
		FRAME_RATE = 30, // specific to video file, needs to be hard-coded
		popcorn,
		video,
		vjs,
		//container = document.getElementById('container'),

		iOS = navigator.userAgent.match(/(iPad|iPhone|iPod)/g),
		AudioContext = window.AudioContext || window.webkitAudioContext,

		words = {},
		hashes = {},
		allOccurrences = [],
		coverEnabled = true,
		wordsLoaded = false;

	//djb2
	function hash(str) {
		var out = 5381,
			char;

		for (i = 0; i < str.length; i++) {
			char = str.charCodeAt(i);
			out = ((out << 5) + out) + char; /* out * 33 + c */
		}
		return out;
	}

	function initMedia() {
		var tempCtx,
			target,
			seriously;

		function resize() {
			var windowAspect,
				videoAspect,
				canvas,
				height,
				width;

			vjs.width(window.innerWidth);
			vjs.height(window.innerHeight);

			if (target && video.videoWidth) {
				windowAspect = window.innerWidth / window.innerHeight;
				videoAspect = video.videoWidth / video.videoHeight;

				if (windowAspect < videoAspect) {
					width = window.innerWidth;
					height = window.innerWidth / videoAspect;
				} else {
					width = window.innerHeight * videoAspect;
					height = window.innerHeight;
				}
				canvas = target.original;
				canvas.style.width = width + 'px';
				canvas.style.height = height + 'px';
				canvas.style.left = (window.innerWidth - width) / 2 + 'px';
				canvas.style.top = (window.innerHeight - height) / 2 + 'px';
			}
		}

		/*
		need different files at different sample rates for this bug:
		https://bugzilla.mozilla.org/show_bug.cgi?id=937718
		*/
		video = document.getElementById('video');
		if (!iOS) {
			video.innerHTML = '';
			video.removeAttribute('preload');
		}
		// only worry about webm because Firefox
		if (AudioContext && video.canPlayType('video/webm')) {
			tempCtx = new AudioContext();
			if (tempCtx.sampleRate === 44100) {
				video.src = VIDEO_PATH + 'wscf44k.webm';
			} else {
				video.src = VIDEO_PATH + 'wscf48k.webm';
			}
		} else if (!iOS) { // horrible hacking to get around iOS weirdness
			video.src = VIDEO_PATH + 'wscf.mp4';
		}

		/*
		Use Video.js for controls, but place Seriously.js canvas within it
		instead of the actual video element...if WebGL is supported

		videojs screws up video events in iOS so just skip it
		*/
		vjs = videojs('video', {
			controls: true
		}, function () {
			//todo: check internet explorer for WebGL video support (or integrate latest Seriously.js patch)
			if (!Seriously.incompatible()) {
				seriously = new Seriously();
				target = seriously.target(document.createElement('canvas'));
				video.addEventListener('loadedmetadata', function () {
					target.width = video.videoWidth;
					target.height = video.videoHeight;
				});
				video.parentNode.insertBefore(target.original, video.nextSibling);
				video.style.display = 'none';
				target.source = video;
				seriously.go();
			}
		});


		/*
		Need to hide controls on iOS when starting so it can register a touch event
		*/
		if (iOS) {
			video.controls = false;
			video.addEventListener('touchstart', function start() {
				popcorn.play();
				video.controls = true;
				video.removeEventListener('touchstart', start, false);
			}, false);
		}

		popcorn = Popcorn(video, {
			frameAnimation: true,
			framerate: FRAME_RATE,
			seriously: seriously,
			target: target
		});

		/*
		Caution: frameAnimation is not really reliable in cases where the page is not visible.
		Ideally, we'd hook into Web Audio API for finer-grained timing for driving audio events. We use
		the timeupdate to force update as a backup for requestAnimationFrame. It's less accurate, but
		better than nothing.
		*/
		popcorn.on('timeupdate', popcorn.timeUpdate);

		window.addEventListener('resize', resize, false);
		popcorn.on('loadedmetadata', resize);
		resize();
	}

	function enableOccurrence(wordRef, occurrence) {
		var options;

		if (occurrence.popcornId) {
			// already loaded
			return;
		}

		options = {
			start: Popcorn.util.toSeconds(occurrence.start, FRAME_RATE),
			end: occurrence.end && Popcorn.util.toSeconds(occurrence.end, FRAME_RATE),
			bleep: occurrence.bleep
		};

		options.cover = coverEnabled && !!occurrence.cover;
		['x', 'y', 'width', 'height'].forEach(function (field) {
			var val = occurrence[field],
				keyframes;

			if (typeof val === 'object') {
				keyframes = {};
				Popcorn.forEach(val, function (val, time) {
					if (/[;:]/.test(time)) {
						time = Popcorn.util.toSeconds(time, FRAME_RATE);
						time = (time - options.start) / (options.end - options.start);
					}
					keyframes[time] = val;
				});
				options[field] = keyframes;
			} else if (val !== undefined) {
				options[field] = val;
			}
		});

		popcorn.nsfw(options);
		occurrence.popcornId = popcorn.getLastTrackEventId();
	}

	function initializeWord(word) {
		var ref = words[word];
		if (ref) {
			return ref;
		}

		ref = words[word] = {
			enabled: true,
			occurrences: []
		};

		hashes[hash(word)] = word;

		return ref;
	}

	function enableWords(list) {
		if (!Array.isArray(list)) {
			list = [list];
		}

		list.forEach(function (word) {
			var ref = initializeWord(word);
			if (wordsLoaded) {
				ref.occurrences.forEach(enableOccurrence.bind(null, ref));
			}
		});
	}

	function disableWords(list) {
		if (!Array.isArray(list)) {
			list = [list];
		}

		list.forEach(function (word) {
			var ref = initializeWord(word);

			ref.enabled = false;

			if (wordsLoaded) {
				ref.occurrences.forEach(function (occurrence) {
					var id = occurrence.popcornId;
					if (id) {
						popcorn.removeTrackEvent(id);
						occurrence.popcornId = null;
					}
				});
			}
		});
	}

	// Load censorship occurrences from JSON file on the server
	function loadEvents() {
		var xhr = new XMLHttpRequest();
		xhr.onload = function () {
			var response;

			response = JSON.parse(xhr.responseText);
			response.forEach(function (occurrence) {
				var wordRef;

				if (!occurrence.word) {
					occurrence.word = ''; // could be used for just pixelating
				}

				wordRef = initializeWord(occurrence.word);
				wordRef.occurrences.push(occurrence);
				allOccurrences.push(occurrence);
				if (wordRef.enabled) {
					enableOccurrence(wordRef, occurrence);
				}
			});

			wordsLoaded = true;

			// get words configuration from URL query
			query = window.location.search.replace(/^\?/,'').split('&');
			query.forEach(function (term) {
				var param = term.split('=').map(function (s) {
						return s.trim();
					}),
					word;

				if (!param[0]) {
					return;
				}

				if (param[0] === 'cover') {
					coverEnabled = !(param[1] === '0' || param[1] && param[1].toLowerCase() === 'false');
					return;
				}

				word = hashes[parseInt(param[0], 10)];
				if (param.length === 1 || param[1] === '0' || param[1] && param[1].toLowerCase() === 'false') {
					disableWords(word);
				}
			});
		};
		xhr.open('GET', 'data/words.json');
		xhr.send();
	}

	function initialize() {
		var query;

		initMedia();
		loadEvents();

		window.addEventListener('keydown', function(evt) {
			if (popcorn.paused()) {
				if (evt.which === 37) {
					popcorn.currentTime(popcorn.currentTime() - 1 / FRAME_RATE);
				} else if (evt.which === 39) {
					popcorn.currentTime(popcorn.currentTime() + 1 / FRAME_RATE);
				} else if (evt.which === 32) { // space
					popcorn.play();
				}
			} else if (evt.which === 32) { // space
				popcorn.pause();
			}
		}, true);

		//receive postMessages from parent window
		window.addEventListener('message', function (evt) {
			if (evt.data.action === 'updateWord') {
				if (evt.data.censored) {
					enableWords(evt.data.word);
				} else {
					disableWords(evt.data.word);
				}
			} else if (evt.data.action === 'setCover') {
				coverEnabled = !!evt.data.cover;
				allOccurrences.forEach(function (occurrence) {
					if (occurrence.popcornId && occurrence.bleep !== false && occurrence.cover) {
						popcorn.nsfw(occurrence.popcornId, {
							cover: occurrence.cover && coverEnabled
						});
					}
				});
			}
			//todo: toggle blur
		});
	}

	initialize();
}(this));