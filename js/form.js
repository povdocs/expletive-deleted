(function (window) {
	var wordList = [
			'ass:animal',
			'ass:anatomy',
			'ass:insult',
			'ass:sex act',
			'balls:metaphor',
			'balls:anatomy',
			'balls:sex act',
			'bastard',
			'bitch:verb',
			'bitch:noun',
			'bullshit',
			'butthead',
			'cagada',
			'cocksuckers',
			'crap',
			'dick:insult',
			'dick:anatomy',
			'dumbass',
			'friggin',
			'fuck',
			'goddamn',
			'hell',
			'jesus christ',
			'mierda',
			'shit',
			'pussy:insult',
			'pussy:anatomy',
			'tits'
		],
		words = {},
		form = document.getElementById('form'),
		iframe = document.getElementById('iframe'),
		cover = document.getElementById('cover'),
		embed = document.getElementById('embed');

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

		function clean(word) {
			var i, n,
				newWord;

			newWord = word[0].toUpperCase();
			n = word.length;
			if (n >= 4) {
				n--;
			}

			for (i = 1; i < n; i++) {
				newWord += '-';
			}
			if (n < word.length) {
				newWord += word[n];
			}

			return newWord;
		}

		function updateLabel(ref) {
			var labelText = ref.clean;
			if (ref.qual) {
				labelText += ' (' + ref.qual + ')';
			}
			ref.label.childNodes[1].nodeValue = labelText;
		}

		function setEmbedCode() {
			var word,
				ref,
				params = [],
				url = window.location.origin + window.location.pathname.replace(/[^\/]+$/, '') + 'player.html?';

			if (!cover.checked) {
				params.push('cover=0');
			}

			for (word in words) {
				if (words.hasOwnProperty(word)) {
					ref = words[word];
					if (!ref.censored) {
						params.push(ref.hash + '=0');
					}
				}
			}

			url += params.join('&amp;');
			embed.value = '<iframe width="960" height="540" src="' + url + '"></iframe>';
		}

		function updateCover() {
			iframe.contentWindow.postMessage({
				action: 'setCover',
				cover: cover.checked
			}, '*');

			setEmbedCode();
		}

		function updateWord(input, word) {
			var ref = words[word];
			ref.censored = input.checked;
			updateLabel(ref);
			iframe.contentWindow.postMessage({
				action: 'updateWord',
				word: word,
				censored: ref.censored
			}, '*');

			setEmbedCode();
		}

		function loadWords() {
			var xhr = new XMLHttpRequest();
			xhr.onload = function () {
				var response,
					usedWords = {};

				response = JSON.parse(xhr.responseText);
				response.forEach(function (occurrence) {
					usedWords[occurrence.word] = true;
				});

				wordList.sort();
				wordList.forEach(function (word) {
					var ref,
						split,
						input,
						label,
						labelText;

					if (!usedWords[word]) {
						return;
					}

					label = document.createElement('label');

					split = word.split(':');
					ref = {
						word: split[0],
						qual: split[1],
						hash: hash(word),
						clean: split[0].split(' ').map(clean).join(' '), //clean(split[0]),
						censored: true,
						label: label
					};

					words[word] = ref;

					input = document.createElement('input');
					input.type = 'checkbox';
					input.checked = true;
					label.appendChild(input);
					label.appendChild(document.createTextNode(''));
					updateLabel(ref);

					input.addEventListener('change', updateWord.bind(null, input, word));

					form.appendChild(label);
				});

				setEmbedCode();
			};
			xhr.open('GET', 'data/words.json');
			xhr.send();
		}

		loadWords();
		updateCover();

		embed.addEventListener('focus', function () {
			this.setSelectionRange(0, this.value.length);
		});
		embed.addEventListener('click', function () {
			this.setSelectionRange(0, this.value.length);
		});
		cover.addEventListener('change', updateCover);
}(this));