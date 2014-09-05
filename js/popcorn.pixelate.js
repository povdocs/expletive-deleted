(function (Popcorn) {

	'use strict';

	var iOS = navigator.userAgent.match(/(iPad|iPhone|iPod)/g),
		isSafari = (function () {
			var regex = /(Version)\/(\d+)\.(\d+)(?:\.(\d+))?.*Safari/,
				match = regex.exec(navigator.userAgent);

			// match Safari version 7 and lower (hopefully v8 will fix the bug)
			// https://bugs.webkit.org/show_bug.cgi?id=125031
			return !!match && parseFloat(match[2]) < 8;
		}()),
		AudioContext = window.AudioContext || window.webkitAudioContext,

		popcorns = {},

		audioCtx,
		oscillator,
		audioInitialized = false,

		resizeTimeout,
		lastResize = 0,

		windowWidth = 0,
		windowHeight = 0,

		RESIZE_THROTTLE = 30,
		BLEEP_GAIN = 0.05,
		FREQUENCY = 493.883; //"B4" note

	function setUpPopcorn(obj) {
		if (!obj.gainNode) {
			// main volume gain node
			obj.gainNode = audioCtx.createGain();
			obj.gainNode.connect(audioCtx.destination);

			if (isSafari) {
				obj.volumeCallback = function () {
					if (!obj.active) {
						obj.volume = obj.popcorn.volume();
					}
				};
			} else {
				obj.source = audioCtx.createMediaElementSource(obj.popcorn.media);

				// video mute gain node
				// (things get weird if the video source is not connected)
				obj.videoGainNode = audioCtx.createGain();
				obj.videoGainNode.connect(obj.gainNode);
				obj.source.connect(obj.videoGainNode);

				obj.volumeCallback = function () {
					if (!obj.active) {
						obj.gainNode.gain.value = obj.popcorn.muted() ? 0 : obj.popcorn.volume();
					}
				};
			}

			// bleep is too loud to plug straight in
			obj.bleepGainNode = audioCtx.createGain();
			obj.bleepGainNode.connect(obj.gainNode);
			obj.bleepGainNode.gain.value = 0;
			oscillator.connect(obj.bleepGainNode);

			obj.popcorn.on('volumechange', obj.volumeCallback);
			if (obj.active) {
				obj.bleepGainNode.gain.value = BLEEP_GAIN;
				if (isSafari) {
					obj.popcorn.volume(0);
				} else {
					obj.videoGainNode.gain.value = 0;
				}
			}
			obj.volumeCallback();
		}
	}

	function initializeAudio() {
		var n,
			obj;

		if (audioInitialized || !AudioContext) {
			return;
		}

		audioCtx = new AudioContext();
		oscillator = audioCtx.createOscillator();
		oscillator.frequency.value = 800;
		oscillator.start(0);

		for (n in popcorns) {
			if (popcorns.hasOwnProperty(n)) {
				setUpPopcorn(popcorns[n]);
			}
		}

		audioInitialized = true;
	}

	function addBleep(frequency, popcornId) {
		var obj;

		obj = popcorns[popcornId];
		if (!obj) {
			obj = popcorns[popcornId] = {
				active: 0,
				events: 0,
				popcorn: Popcorn.byId(popcornId)
			};
			if (audioInitialized) {
				setUpPopcorn(obj);
			}
		}
		obj.events++;
	}

	function removeBleep(frequency, popcornId) {
		var obj;

		obj = popcorns[popcornId];
		if (obj) {
			obj.events--;
			if (!obj.events) {
				if (false && obj.source) {
					//todo: maybe leave these intact so we don't lose all volume on the video?
					obj.source.disconnect(obj.gainNode);
					//obj.gainNode.disconnect(audioCtx.destination);
					obj.popcorn.off('volumechange', obj.volumeCallback);
				}
				delete popcorns[popcornId];
			}
		}
	}

	function startBleep(frequency, popcornId) {
		var obj;

		obj = popcorns[popcornId];
		if (obj) {
			obj.active++;
			if (audioInitialized) {
				console.log('bleep!');
				obj.bleepGainNode.gain.value = BLEEP_GAIN;
				if (isSafari) {
					obj.popcorn.volume(0);
				} else {
					obj.videoGainNode.gain.value = 0;
				}
			}
		}
	}

	function endBleep(frequency, popcornId) {
		var obj;

		obj = popcorns[popcornId];
		if (obj) {
			obj.active--;
			if (!obj.active && audioInitialized) {
				console.log('bleep off');
				obj.bleepGainNode.gain.value = 0;
				if (isSafari) {
					obj.popcorn.volume(obj.volume);
				} else {
					obj.videoGainNode.gain.value = 1;
				}
			}
		}
	}

	/*
	function resize(popcorn) {
		var instance = instances[popcorn.id],
			list,
			videoAspect,
			windowAspect,
			options,
			video,

			videoWidth,
			videoHeight,

			i;

		if (!instance) {
			return;
		}

		list = instance.events;
		video = popcorn.media;

		videoWidth = video.videoWidth;
		videoHeight = video.videoHeight;
		videoAspect = videoWidth / videoHeight;
		windowAspect = windowWidth / windowHeight;
	}

	function resizeAll() {
		lastResize = Date.now();
		if (windowHeight === window.innerHeight &&
				windowWidth === window.innerWidth) {

			return;
		}

		windowHeight = window.innerHeight;
		windowWidth = window.innerWidth;

		Popcorn.instances.forEach(resize);
	}

	function resizeWindow() {
		if (Date.now() - lastResize < RESIZE_THROTTLE) {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(resizeTimeout, RESIZE_THROTTLE);
		} else {
			resizeAll();
		}
	}

	function sortEvents(a, b) {
		if (a.minAspect !== b.minAspect) {
			return (b.minAspect || 0) - (a.minAspect || 0);
		}

		if (a.maxAspect !== b.maxAspect) {
			return (a.maxAspect || Infinity) - (b.maxAspect || Infinity);
		}

		//prioritize whichever one is shorter
		return (a.end - a.start) - (b.end - b.start);
	}

	function addEvent(popcorn, event) {
		var instance = instances[popcorn.id];
		if (!instance) {
			instance = instances[popcorn.id] = {
				events: [],
				x: -1,
				y: -1
			};
			popcorn.on('loadedmetadata', function () {
				resize(popcorn);
			});
		}

		if (instance.events.indexOf(event) < 0) {
			instance.events.push(event);
			instance.events.sort(sortEvents);
			resize(popcorn);
		}
		return instance;
	}

	function removeEvent(popcorn, event) {
		var instance = instances[popcorn.id],
			list = instance && instance.events,
			index;

		if (list) {
			index = list.indexOf(event);
			if (index >= 0) {
				list.splice(index, 1);
				resize(popcorn);
			}
		}
	}
	*/

	/*
	todo: only attach these if there is at least one event,
	detach when the last event is destroyed
	*/
	//window.addEventListener('resize', resizeWindow, false);
	//window.addEventListener('orientationchange', resizeAll, false);
	//resizeAll();

	Popcorn.basePlugin('pixelate', function (options, base) {
		var popcorn = base.popcorn,
			active = false,
			frequency = options.frequency || 1000,

			seriously,
			target,
			cover;

		function loadedMetadata() {
			initializeAudio();
		}

		function pause() {
			if (active && options.bleep !== false) {
				endBleep(frequency, popcorn.id);
			}
		}

		function play() {
			if (active && options.bleep !== false) {
				startBleep(frequency, popcorn.id);
			}
		}

		function setUpCover() {
			if (options.cover) {
				if (!cover) {
					if (seriously) {
					} else {
						cover = document.createElement('div');
						cover.className = 'nsfw-cover';
						cover.style.left = options.x + 'px';
						cover.style.top = options.y + 'px';
						cover.style.width = options.width + 'px';
						cover.style.height = options.height + 'px';
						if (popcorn.media.parentNode) {
							popcorn.media.parentNode.appendChild(cover);
						}
					}
				}
				return;
			}

			//todo: tear down cover
			if (cover) {
				if (seriously) {
					cover.destroy();
					//todo: destroy blend node
				} else if (cover.parentNode) {
					cover.parentNode.removeChild(cover);
				}
				cover = null;
			}
		}

		function startCover() {
			if (seriously) {
			} else {
				cover.classList.add('active');
			}
		}

		function endCover() {
			if (seriously) {
			} else {
				cover.classList.remove('active');
			}
		}

		/*
		For iPad browser, do not set up until after media starts loading
		*/
		if (iOS) {
			document.body.addEventListener('touchstart', function () {
				console.log('touchstart!');
				initializeAudio();
			}, true);
		} else {
			initializeAudio();
		}

		popcorn.on('pause', pause);
		popcorn.on('waiting', pause);
		popcorn.on('playing', play);

		seriously = popcorn.options.seriously;
		target = popcorn.options.target;
		if (!seriously || seriously.incompatible() || !target) {
			seriously = null;
			target = null;
		}
		setUpCover();

		base.animate('x', function (val) {
			if (cover && cover.style) {
				cover.style.left = val + 'px';
			}
		});
		base.animate('y', function (val) {
			if (cover && cover.style) {
				cover.style.top = val + 'px';
			}
		});
		base.animate('width', function (val) {
			if (cover && cover.style) {
				cover.style.width = val + 'px';
			}
		});
		base.animate('height', function (val) {
			if (cover && cover.style) {
				cover.style.height = val + 'px';
			}
		});

		if (options.bleep !== false) {
			addBleep(frequency, popcorn.id);
		}

		return {
			start: function() {
				//addEvent(popcorn, base.options);
				active = true;
				if (!popcorn.media.paused && options.bleep !== false) {
					startBleep(frequency, popcorn.id);
				}
				if (cover) {
					startCover();
				}
			},
			end: function() {
				//removeEvent(popcorn, base.options);
				active = false;
				if (!popcorn.media.paused && options.bleep !== false) {
					endBleep(frequency, popcorn.id);
				}
				if (cover) {
					endCover();
				}
			},
			_update: function (trackEvent, changes) {
				//todo: copy changes over
				//todo: if active, stop
				//todo: remove old req, add new one
				//todo: if active endBleep
			},
			_teardown: function () {
				if (options.bleep !== false) {
					removeBleep(frequency);
				}
				popcorn.off('loadedmetadata', loadedMetadata);
				popcorn.off('pause', pause);
				popcorn.off('play', play);
			}
		};
	}, {
		about: {
			name: 'Popcorn Censorship Plugin',
			version: '0.1',
			author: 'Brian Chirls, @bchirls',
			website: 'http://github.com/brianchirls'
		}
	});
}(window.Popcorn));
