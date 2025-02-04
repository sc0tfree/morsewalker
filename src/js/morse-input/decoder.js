const morseToAlphabet = new Map([
	["12", "A"],
	["2111", "B"],
	["2121", "C"],
	["211", "D"],
	["1", "E"],
	["1121", "F"],
	["221", "G"],
	["1111", "H"],
	["11", "I"],
	["1222", "J"],
	["212", "K"],
	["1211", "L"],
	["22", "M"],
	["21", "N"],
	["222", "O"],
	["1221", "P"],
	["2212", "Q"],
	["121", "R"],
	["111", "S"],
	["2", "T"],
	["112", "U"],
	["1112", "V"],
	["122", "W"],
	["2112", "X"],
	["2122", "Y"],
	["2211", "Z"],
    ["12222", "1"],
    ["11222", "2"],
    ["11122", "3"],
    ["11112", "4"],
    ["11111", "5"],
    ["21111", "6"],
    ["22111", "7"],
    ["22211", "8"],
    ["22221", "9"],
    ["22222", "0"],
	["121212", "."],
    ["221122", ","],
    ["21121", "/"],
    ["112211", "?"],
    ["212122", "!"],
    ["211112", "-"],
    ["21221", "("],
    ["212212", ")"],
    ["222111", ":"],
]);

export class Decoder {
	constructor(onLetterDecoded) {
		this.onLetterDecoded = onLetterDecoded; // Store the callback function
		this.lastLetter = '';
		this.decodeArray = '';
		this.unit = 80; // adjustment: short dit reduces, long dah lengthens
		this.keyStartTime = null;
		this.keyEndTime = null;
		this.spaceTimer = null;
        this.farnsworth = 3;
		this.wordTimer = null; // Timer for word boundaries
		this.wordTimeout = this.unit * 7; // A typical word gap is 7 units
	}

	keyOn() {
		clearTimeout(this.spaceTimer);
		clearTimeout(this.wordTimer); // Clear the wordTimer as well since we are receiving input
		this.keyStartTime = Date.now();
		//var pauseDuration = (this.keyEndTime) ? this.keyStartTime - this.keyEndTime : 0;
		//if (pauseDuration > this.unit + (this.unit/10)) { // end sequence and decode letter
			//this.registerLetter();
		//}
	}

	keyOff() {
		this.keyEndTime = Date.now();
		var keyDuration = (this.keyStartTime) ? this.keyEndTime - this.keyStartTime : 0;
		if (keyDuration < this.unit) {
			// reduce unit based on short dit
			this.unit = (keyDuration + this.unit) / 2;
			this.registerDit();
		} else if (keyDuration > this.unit * 3) {
			// lengthen unit based on long dah
			this.unit = ((keyDuration / 3) + this.unit) / 2;
			this.registerDah();
		} else {
			var ditAndDahThreshold = (this.unit * 2);
			if (keyDuration >= ditAndDahThreshold) {
				this.registerDah();
			} else {
				this.registerDit();
			}
		}
        let spaceTime = this.unit * this.farnsworth;
		this.spaceTimer = setTimeout(() => { // end sequence and decode letter
			this.updateLastLetter(this.morseToLetter(this.decodeArray));
			this.decodeArray = '';
			this.startWordTimer(); // Start the word timer after finishing a letter
		}, spaceTime, "keyOff");
	}

	registerDit() {
		this.decodeArray += '1';
	}

	registerDah() {
		this.decodeArray += '2';
	}

	updateLastLetter(letter) {
		//updateCurrentLetter(letter);
		this.lastLetter = letter;
		//console.log(this.lastLetter);

		// Notify the callback function that a new letter is decoded
        if (this.onLetterDecoded) {
            this.onLetterDecoded(letter);
        }
	}

	morseToLetter(sequence) {
		var letter = morseToAlphabet.get(sequence);
		if (letter) {
			return letter;
		} else {
			return '*';
		}
	}

	startWordTimer() {
		// Comment out word spacing for MorseWalker integration
		// Set up the word timer to add a space after a word boundary
		/*
		this.wordTimer = setTimeout(() => {
			// Update with a space to indicate a word boundary
			if (this.onLetterDecoded) {
				this.onLetterDecoded(' ');
			}
		}, this.wordTimeout);
		*/
	}

    calculateWpm() {
        return 60000 / (this.unit * 50);
    }

    setFarnsworth(farnsworth) {
        this.farnsworth = farnsworth;
    }
}