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
		coverEnabled = true,
		form = document.getElementById('form'),
		iframe = document.getElementById('iframe');

		function grawlix(word) {
			var i, n,
				newWord;

			newWord = word[0];
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
			var labelText = ref.grawlix;
			if (ref.qual) {
				labelText += ' (' + ref.qual + ')';
			}
			ref.label.childNodes[1].nodeValue = labelText;
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
			console.log('toggle', word, ref.censored);
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
						grawlix: split[0].split(' ').map(grawlix).join(' '), //grawlix(split[0]),
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
			};
			xhr.open('GET', 'data/words.json');
			xhr.send();
		}

		loadWords();
}(this));