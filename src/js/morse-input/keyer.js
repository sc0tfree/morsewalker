import { restartAudioNeeded, restartAudio } from './sounder.js';

export class Keyer {
    constructor(sndr, decoder) {
        this.sndr = sndr; // Sounder instance
        this.decoder = decoder; // Decoder instance
        // Using [ and ] for dits and dahs respectively for compatibility with the vband usb interface
        this.ditKey1 = 'ControlLeft';
        this.dahKey1 = 'ControlRight';
        this.ditKey2 = 'BracketLeft';
        this.dahKey2 = 'BracketRight';
        this.wpm = 20;
        this.unit = 60; // length of dit in milliseconds; 60 is 20wpm
        this.mode = 2;  // 1: straight key, 2: iambicA, 3: iambicB, 4: ultimatic
        this.tone = 550;
        this.queue = [];
        this.ditKeyState = 0;
        this.dahKeyState = 0;
        this.lastKey = null;
        this.ditStreak = 0;
        this.dahStreak = 0;
        this.streak = 0;
        this.ditStart = null;
        this.ditStop = null;
        this.dahStart = null;
        this.dahStop = null;
        this.sending = false;
        this.lastSendTimestamp = null;
        this.oscillatorTimer = setInterval(() => {
            this.oscillate();
        }, 0);
    }

    setWpm(wpm){
        this.wpm = wpm;
        this.unit = 60000 / (wpm * 50)  // based on the PARIS method 60 seconds / 50 elements per word * WPM
        this.decoder.unit = this.unit;
    }

    setMode(mode){
        this.mode = mode;
    }

    setTone(tone){
        this.tone = tone;
    }

    sendSignal() {
        this.sending = true;
        //console.log('startSignal');
        if (restartAudioNeeded()) {
            restartAudio();
        }
        this.sndr.setTone(this.tone);
        this.sndr.on();
        this.decoder.keyOn();
    }

    stopSignal() {
        //console.log('stopSignal');
        this.sndr.off();
        this.decoder.keyOff();
        this.lastSendTimestamp = Date.now();
        setTimeout(() => {
            this.sending = false;
        }, this.unit);
    }

    press(event, down, mode=this.mode) {
        if (mode > 1 && event.code != this.ditKey1 && event.code != this.dahKey1 && event.code != this.ditKey2 && event.code != this.dahKey2) return;
        if (mode == 1) {
            if (down) {
                if (restartAudioNeeded()) {
                    restartAudio();
                }
                this.sndr.setTone(this.tone);
                this.sndr.on();
                this.decoder.keyOn();

            } else {
                this.sndr.off();
                this.decoder.keyOff();
            }
        } else if (mode > 1) {
            //console.log(key);
            if (event.code == this.ditKey1 || event.code == this.ditKey2) {
                if (down) { // dit key down
                    this.ditKeyState = 1;
                    this.ditStart = Date.now()
                } else { // dit key up
                    this.ditKeyState = 0;
                    this.ditStop = Date.now()
                }
            }
            if (event.code == this.dahKey1 || event.code == this.dahKey2) {
                if (down) { // dah key down
                    this.dahKeyState = 1;
                    this.dahStart = Date.now()
                } else { // dah key up
                    this.dahKeyState = 0;
                    this.dahStop = Date.now()
                }
            }
        }
    }

    processQueue() {
        //console.log('processQueue');
        if (!this.sending && this.queue.length) {
            this.lastKey = this.queue.shift();
            var signalLength = (this.lastKey == 1) ? this.unit : this.unit * 3;
            this.sendSignal();
            setTimeout(() => {
                this.stopSignal();
            }, signalLength);
        }
    }

    oscillate() {
        if (this.mode === 2) {
            this.oscillatev2();
        } else if (this.mode === 3) {
            this.oscillatev3();
        } else if (this.mode === 4) {
            this.oscillatev4();
        } else {
            this.oscillatev1();
        }
    }

    oscillatev1() {
        if (!this.ditKeyState && !this.dahKeyState) {
            this.queue = [];
        }
        if (this.ditKeyState) {
            if (this.queue.length == 0) {
                if (!this.dahKeyState && !this.sending || this.lastKey == 2) {
                    this.queue.push(1);
                }
            }
        }
        if (this.dahKeyState) {
            if (this.queue.length == 0) {
                if (!this.ditKeyState && !this.sending || this.lastKey == 1) {
                    this.queue.push(2);
                }
            }
        }
        if (!this.sending && Date.now() - this.lastSendTimestamp > this.unit) {
            this.processQueue();
        }
    }

    oscillatev2() {
        if (this.mode == 2 && !this.ditKeyState && !this.dahKeyState) { // Iambic B doesn't clear the queue
            if (this.streak > 1) {
                //console.log(this.streak + " queue: " + this.queue[0]);
                this.queue = [];
            }
            this.streak = 0;
        }
        if (this.ditKeyState) {
            if (this.queue.length < 1) {
                if (!this.sending || this.lastKey == 2) {
                    this.queue.push(1);
                    if (this.lastKey == 2 && this.dahKeyState) {
                        this.streak++;
                    } else {
                        this.streak = 0;
                    }
                }
            }
        }
        if (this.dahKeyState) {
            if (this.queue.length < 1) {
                if (!this.sending || this.lastKey == 1) {
                    this.queue.push(2);
                    if (this.lastKey == 1 && this.ditKeyState) {
                        this.streak++;
                    } else {
                        this.streak = 0;
                    }
                }
            }
        }
        if (!this.sending && Date.now() - this.lastSendTimestamp >= this.unit) {
            this.processQueue();
        }
    }

    oscillatev3() {
        if (this.mode == 2 && !this.ditKeyState && !this.dahKeyState && this.queue.length) { // Iambic B doesn't clear the queue
            if ((this.ditStreak && this.queue[0] == 1) || (this.dahStreak && this.queue[0] == 2)) {
                console.log("ditStreak: "+this.ditStreak+" dahStreak: "+this.dahStreak+" queue: "+this.queue[0]);
                this.queue = [];
            }
            //console.log("NO CLEAR ditStreak: "+this.ditStreak+" dahStreak: "+this.dahStreak+" queue: "+this.queue[0]);
            this.ditStreak = 0;
            this.dahStreak = 0;
        }
        if (this.ditKeyState) {
            if (!this.queue.length) {
                if (!this.sending || this.lastKey == 2) {
                    this.queue.push(1);
                    this.ditStreak++;
                }
            } else if (!this.dahKeyState && this.queue[0] == 2) { // dah was canceled.  Replace in queue
                this.queue[0] = 1;
                this.dahStreak = 0;
                this.ditStreak++;
            }
        }
        if (this.dahKeyState) {
            if (!this.queue.length) {
                if (!this.sending || this.lastKey == 1) {
                    this.queue.push(2);
                    this.dahStreak++;
                }
            } else if (!this.ditKeyState && this.queue[0] == 1) { // dit was canceled.  Replace in queue
                this.queue[0] = 2;
                this.ditStreak = 0;
                this.dahStreak++;
            }
        }
        if (!this.sending && Date.now() - this.lastSendTimestamp >= this.unit) {
            this.processQueue();
        }
    }

    oscillatev4() {
        if (!this.ditKeyState && !this.dahKeyState) {
            this.queue = [];
        }
        if (this.ditKeyState) {
            if (this.queue.length == 0) {
                if (!this.sending || this.lastKey == 2) {
                    this.queue.push(1);
                }
            }
        }
        if (this.dahKeyState) {
            if (this.queue.length == 0) {
                if (!this.sending || this.lastKey == 1) {
                    this.queue.push(2);
                }
            }
        }
        if (!this.sending && Date.now() - this.lastSendTimestamp > this.unit) {
            this.processQueue();
        }
    }
}
