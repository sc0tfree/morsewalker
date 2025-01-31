import { Sounder } from './sounder.js';
import { Decoder } from './decoder.js';
import { Keyer } from './keyer.js';
import { getInputs } from '../inputs.js';

/**
 * MorseInput class handles real-time morse code input from keyboard or USB devices.
 * It integrates with MorseWalker's input fields and settings.
 */
class MorseInput {
    constructor() {
        this.sounder = null;
        this.decoder = null;
        this.keyer = null;
        this.initialized = false;
        
        // Set up keyboard input - but don't initialize audio yet
        window.addEventListener('keydown', (e) => this.handleKeyEvent(e, true));
        window.addEventListener('keyup', (e) => this.handleKeyEvent(e, false));
    }

    /**
     * Initialize the morse input system after user interaction
     */
    initialize() {
        if (this.initialized) return;
        
        this.sounder = new Sounder();
        this.decoder = new Decoder(this.handleDecodedLetter.bind(this));
        this.keyer = new Keyer(this.sounder, this.decoder);
        
        // Load settings from MorseWalker
        this.syncWithMorseWalker();
        
        this.initialized = true;
    }

    /**
     * Handle key events, initializing if needed
     */
    handleKeyEvent(e, down) {
        if (!this.initialized) {
            this.initialize();
        }
        this.keyer?.press(e, down);
    }

    /**
     * Synchronizes settings with MorseWalker's current configuration
     */
    syncWithMorseWalker() {
        const inputs = getInputs();
        if (!inputs) return;

        // Update keyer settings
        this.keyer?.setWpm(inputs.yourSpeed);
        this.keyer?.setMode(inputs.keyerMode);
        this.keyer?.setTone(inputs.yourSidetone);
        
        // Sync Farnsworth if enabled
        if (inputs.enableFarnsworth) {
            this.decoder?.setFarnsworth(inputs.farnsworthSpeed);
        }
    }

    /**
     * Handles decoded letters from morse input
     * @param {string} letter - The decoded letter
     */
    handleDecodedLetter(letter) {
        const activeField = document.activeElement;
        if (!activeField || !['INPUT', 'TEXTAREA'].includes(activeField.tagName)) {
            return;
        }

        // Insert the letter at the cursor position
        const start = activeField.selectionStart;
        const end = activeField.selectionEnd;
        const value = activeField.value;
        
        activeField.value = value.substring(0, start) + letter + value.substring(end);
        
        // Move cursor after inserted letter
        activeField.selectionStart = activeField.selectionEnd = start + letter.length;
        
        // Trigger input event to ensure MorseWalker processes the change
        activeField.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * Updates settings when MorseWalker configuration changes
     * @param {Object} settings - New settings object
     */
    updateSettings(settings) {
        if (!this.initialized) return;
        
        if (settings.wpm !== undefined) {
            this.keyer.setWpm(settings.wpm);
        }
        if (settings.tone !== undefined) {
            this.keyer.setTone(settings.tone);
        }
        if (settings.farnsworth !== undefined) {
            this.decoder.setFarnsworth(settings.farnsworth);
        }
        if (settings.mode !== undefined) {
            this.keyer.setMode(settings.mode);
        }
    }
}

// Create and export a singleton instance
export const morseInput = new MorseInput();
