/**
 * Piper TTS Loader
 * 
 * This file provides a local wrapper for loading the Piper TTS library.
 * The library is loaded from a CDN as it's a service dependency for ML inference.
 * 
 * @package Speechable
 * @see https://github.com/Mintplex-Labs/piper-tts-web
 */

let piperModule = null;
let loadPromise = null;

/**
 * Load the Piper TTS module.
 * Uses dynamic import to load the library on-demand.
 * 
 * @returns {Promise<Object>} The Piper TTS module
 */
export async function loadPiperTTS() {
    if ( piperModule ) {
        return piperModule;
    }
    
    if ( loadPromise ) {
        return loadPromise;
    }
    
    loadPromise = ( async () => {
        try {
            // Load Piper TTS library - ML inference service dependency
            // This library provides text-to-speech functionality using ONNX runtime
            // Voice models are downloaded from HuggingFace on first use
            piperModule = await import( 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/+esm' );
            return piperModule;
        } catch ( error ) {
            loadPromise = null;
            throw new Error( 'Failed to load TTS library. Please check your internet connection.' );
        }
    } )();
    
    return loadPromise;
}

/**
 * Check if the Piper TTS module is loaded.
 * 
 * @returns {boolean} True if loaded
 */
export function isPiperLoaded() {
    return piperModule !== null;
}

/**
 * Get the loaded Piper TTS module.
 * 
 * @returns {Object|null} The module or null if not loaded
 */
export function getPiperModule() {
    return piperModule;
}
