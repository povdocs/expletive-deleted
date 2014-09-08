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
		allCovers = [],

		audioCtx,
		oscillator,
		audioInitialized = false,

		resizeTimeout,
		lastResize = 0,

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

	function addBleep(popcornId) {
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

	function removeBleep(popcornId) {
		var obj;

		obj = popcorns[popcornId];
		if (obj) {
			obj.events--;
			/*
			if (!obj.events) {
				delete popcorns[popcornId];
			}
			*/
		}
	}

	function startBleep(popcornId) {
		var obj;

		obj = popcorns[popcornId];
		if (obj) {
			obj.active++;
			if (audioInitialized) {
				obj.bleepGainNode.gain.value = BLEEP_GAIN;
				if (isSafari) {
					obj.popcorn.volume(0);
				} else {
					obj.videoGainNode.gain.value = 0;
				}
			}
		}
	}

	function endBleep(popcornId) {
		var obj;

		obj = popcorns[popcornId];
		if (obj) {
			obj.active--;
			if (!obj.active && audioInitialized) {
				obj.bleepGainNode.gain.value = 0;
				if (isSafari) {
					obj.popcorn.volume(obj.volume);
				} else {
					obj.videoGainNode.gain.value = 1;
				}
			}
		}
	}

	Popcorn.basePlugin('nsfw', function (options, base) {
		var popcorn = base.popcorn,
			active = false,
			bleeping = false,

			seriously,
			target,
			blend,
			crop,
			cover;

		function loadedMetadata() {
			initializeAudio();
		}

		function resize() {
			if (cover && cover.crop) {
				cover.crop.left = base.options.x;
				cover.crop.top = base.options.y;
				cover.crop.right = popcorn.media.videoWidth - base.options.width - base.options.x;
				cover.crop.bottom = popcorn.media.videoHeight - base.options.height - base.options.y;
				cover.pixelate.pixelSize = popcorn.media.videoWidth / 60;

				// crop node is centered in canvas by default
				cover.position.translateX = (cover.crop.left - cover.crop.right) / 2;
				cover.position.translateY = -(cover.crop.top - cover.crop.bottom) / 2;
			}
		}

		function pause(evt) {
			if (active && options.bleep !== false && bleeping) {
				endBleep(popcorn.id);
				bleeping = false;
			}
		}

		function play(evt) {
			if (active && options.bleep !== false && !bleeping) {
				startBleep(popcorn.id);
				bleeping = true;
			}
		}

		function teardownCover() {
			if (cover) {
				endCover();
				if (seriously) {
					cover.source.off('resize', resize);
					delete cover.source;
					Object.keys(cover).forEach(function (key) {
						var node = cover[key];
						node.destroy();
						cover[key] = null;
					});
				} else if (cover.parentNode) {
					cover.parentNode.removeChild(cover);
				}
				cover = null;
			}
		}

		//only run this when options change
		function setUpCover() {
			teardownCover();
			if (options.cover) {
				if (!cover) {
					if (seriously) {
						cover = {
							source: seriously.source(popcorn.media),
							crop: seriously.effect('crop'),
							blend: seriously.effect('blend'),
							pixelate: seriously.effect('pixelate'),
							position: seriously.transform('2d'),
						};

						resize();

						cover.crop.source = cover.source;
						cover.pixelate.source = cover.crop;
						cover.position.source = cover.pixelate;
						cover.blend.top = cover.position;
						cover.blend.sizeMode ='bottom';

						cover.source.on('resize', resize);
						if (active) {
							startCover();
						}
					} else {
						cover = document.createElement('div');
						cover.className = 'nsfw-cover';
						cover.style.left = base.options.x + 'px';
						cover.style.top = base.options.y + 'px';
						cover.style.width = base.options.width + 'px';
						cover.style.height = base.options.height + 'px';
						if (popcorn.media.parentNode) {
							popcorn.media.parentNode.appendChild(cover);
						}
					}
				}
			}
		}

		function startCover() {
			var previous, i;
			if (seriously) {
				i = allCovers.indexOf(cover.blend);
				if (i >= 0) {
					return;
				}

				if (allCovers.length) {
					previous = allCovers[allCovers.length - 1];
				} else {
					previous = popcorn.media;
				}
				target.source = cover.blend;
				cover.blend.bottom = previous;
				allCovers.push(cover.blend);
			} else {
				cover.classList.add('active');
			}
		}

		function endCover() {
			var previous,
				next,
				i;

			if (seriously) {
				i = allCovers.indexOf(cover.blend);
				if (i < 0) {
					return;
				}

				if (i === 0) {
					previous = popcorn.media;
				} else {
					previous = allCovers[i - 1];
				}
				allCovers.splice(i, 1);
				next = allCovers[i] || target;

				next.source = previous;
			} else {
				cover.classList.remove('active');
			}
		}

		//annoying popcorn bug
		if (options._id) {
			return;
		}

		/*
		For iPad browser, do not set up until after media starts loading
		*/
		if (iOS) {
			document.body.addEventListener('touchstart', function () {
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

		//bug fix/workaround
		['x', 'y', 'width', 'height'].forEach(function (field) {
			var val = base.options[field];
			if (typeof val === 'object') {
				base.options[field] = val.from;
			}
		});

		setUpCover();

		/*
		make animation happen, at least with x and y
		*/

		base.animate('x', function (val) {
			if (cover) {
				if (cover.crop) {
					//resize();
				} else if (cover.style) {
					cover.style.left = val + 'px';
				}
			}
		});
		base.animate('y', function (val) {
			if (cover) {
				if (cover.crop) {
					//resize();
				} else if (cover.style) {
					cover.style.top = val + 'px';
				}
			}
		});
		base.animate('width', function (val) {
			if (cover) {
				if (cover.crop) {
					//resize();
				} else if (cover.style) {
					cover.style.width = val + 'px';
				}
			}
		});
		base.animate('height', function (val) {
			if (cover) {
				if (cover.crop) {
					//resize();
				} else if (cover.style) {
					cover.style.height = val + 'px';
				}
			}
		});

		if (options.bleep !== false) {
			addBleep(popcorn.id);
		}

		return {
			start: function() {
				if (cover) {
					startCover();
				}
				active = true;
				if (!popcorn.media.paused && options.bleep !== false && !bleeping) {
					startBleep(popcorn.id);
					bleeping = true;
				}
			},
			end: function() {
				//removeEvent(popcorn, base.options);
				active = false;
				if (!popcorn.media.paused && options.bleep !== false && bleeping) {
					endBleep(popcorn.id);
					bleeping = false;
				}
				if (cover) {
					endCover();
				}
			},
			frame: resize,
			_update: function (trackEvent, changes) {
				if ('cover' in changes && changes.cover !== trackEvent.cover) {
					options.cover = changes.cover;
					setUpCover();
				}

				if ('bleep' in changes && Boolean(changes.bleep) !== Boolean(trackEvent.bleep)) {
					options.bleep = changes.bleep;
					if (options.bleep) {
						addBleep(popcorn.id);
						if (active && !popcorn.media.paused && !bleeping) {
							startBleep(popcorn.id);
							bleeping = true;
						}
					} else {
						if (active && !popcorn.media.paused && bleeping) {
							endBleep(popcorn.id);
							bleeping = false;
						}
						removeBleep(popcorn.id);
					}
				}
			},
			_teardown: function () {
				if (options.bleep !== false) {
					removeBleep(popcorn.id);
				}
				popcorn.off('loadedmetadata', loadedMetadata);
				popcorn.off('pause', pause);
				popcorn.off('play', play);
				teardownCover();
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
