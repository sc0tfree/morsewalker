// Morse Code Audio Generation Component
import { audioContext } from '../audio.js';

let sounderGlobalVolume = 0.5;

export function setSounderGlobalVolume(volume) {
  sounderGlobalVolume = volume;
}

export class Sounder {
    constructor() {
        this.oscillator = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.frequency = 550; // Default frequency
        this.volume = sounderGlobalVolume; // Default volume
        
        // Attack and release parameters for smooth transitions
        this.attackTime = 0.005;  // 5ms attack
        this.releaseTime = 0.005; // 5ms release
    }

    /**
     * Initialize audio components
     */
    initialize() {
        if (this.oscillator) return;

        this.oscillator = audioContext.createOscillator();
        this.gainNode = audioContext.createGain();

        this.oscillator.type = 'sine';
        this.oscillator.frequency.value = this.frequency;
        this.gainNode.gain.value = 0; // Start silent

        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(audioContext.destination);
        this.oscillator.start();
    }

    /**
     * Clean up audio resources
     */
    cleanup() {
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
            this.oscillator = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        this.isPlaying = false;
    }

    /**
     * Set the frequency of the oscillator
     * @param {number} freq - Frequency in Hz
     */
    setTone(freq) {
        this.frequency = freq;
        if (this.oscillator) {
            this.oscillator.frequency.value = freq;
        }
    }

    /**
     * Set the volume of the audio
     * @param {number} vol - Volume between 0 and 1
     */
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    }

    /**
     * Start playing the tone with smooth attack
     */
    on() {
        if (!this.gainNode) this.initialize();
        
        const now = audioContext.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(0, now);
        this.gainNode.gain.linearRampToValueAtTime(this.volume, now + this.attackTime);
        
        this.isPlaying = true;
    }

    /**
     * Stop playing the tone with smooth release
     */
    off() {
        if (!this.gainNode) return;
        
        const now = audioContext.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
        this.gainNode.gain.linearRampToValueAtTime(0, now + this.releaseTime);
        
        this.isPlaying = false;
    }
}

// These are needed by keyer.js but we don't need them anymore since we're using MorseWalker's audio context
export function restartAudioNeeded() {
    return false;
}

export function restartAudio() {
    // No-op since we're using MorseWalker's audio context
}
