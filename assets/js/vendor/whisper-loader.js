/**
 * Whisper Loader
 * 
 * This file provides a local wrapper for loading the Hugging Face Transformers library
 * which includes Whisper for word-level timestamp extraction.
 * 
 * @package Speechable
 * @see https://huggingface.co/docs/transformers.js
 */

let transformersModule = null;
let whisperPipeline = null;
let loadPromise = null;

/**
 * Load the Transformers.js module.
 * Uses dynamic import to load the library on-demand.
 * 
 * @returns {Promise<Object>} The Transformers module
 */
export async function loadTransformers() {
    if ( transformersModule ) {
        return transformersModule;
    }
    
    if ( loadPromise ) {
        return loadPromise;
    }
    
    loadPromise = ( async () => {
        try {
            // Load Hugging Face Transformers.js - ML inference service dependency
            // This library provides Whisper for accurate word-level timestamps
            transformersModule = await import( 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.1/+esm' );
            return transformersModule;
        } catch ( error ) {
            loadPromise = null;
            throw new Error( 'Failed to load Whisper library. Please check your internet connection.' );
        }
    } )();
    
    return loadPromise;
}

/**
 * Load or get the Whisper pipeline for speech recognition.
 * 
 * @param {string} modelId - The Whisper model ID (e.g., 'Xenova/whisper-tiny.en')
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} The Whisper pipeline
 */
export async function loadWhisperPipeline( modelId, onProgress ) {
    if ( whisperPipeline ) {
        return whisperPipeline;
    }
    
    const { pipeline } = await loadTransformers();
    
    whisperPipeline = await pipeline( 
        'automatic-speech-recognition', 
        modelId,
        { 
            dtype: 'fp32',
            device: 'webgpu' in navigator ? 'webgpu' : 'wasm',
            progress_callback: onProgress
        }
    );
    
    return whisperPipeline;
}

/**
 * Check if the Transformers module is loaded.
 * 
 * @returns {boolean} True if loaded
 */
export function isTransformersLoaded() {
    return transformersModule !== null;
}

/**
 * Check if the Whisper pipeline is loaded.
 * 
 * @returns {boolean} True if loaded
 */
export function isWhisperLoaded() {
    return whisperPipeline !== null;
}
