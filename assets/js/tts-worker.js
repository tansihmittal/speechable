/**
 * Speechable TTS Web Worker
 * Offloads TTS processing from main thread for better performance
 *
 * @package Speechable
 */

let ttsModule = null;

/**
 * Load the Piper TTS module.
 * Uses dynamic import to load the library on-demand from local loader.
 * 
 * @returns {Promise<Object>} The Piper TTS module
 */
const loadPiperTTS = async () => {
    if ( ttsModule ) {
        return ttsModule;
    }
    // Import from local loader which handles the CDN loading
    const loader = await import( './vendor/piper-tts-loader.js' );
    ttsModule = await loader.loadPiperTTS();
    return ttsModule;
};

// Get WAV duration from header
const getWavDuration = ( arrayBuffer ) => {
    const view = new DataView( arrayBuffer );
    const sampleRate = view.getUint32( 24, true );
    const numChannels = view.getUint16( 22, true );
    const bitsPerSample = view.getUint16( 34, true );
    const byteRate = sampleRate * numChannels * ( bitsPerSample / 8 );
    
    let offset = 12;
    while ( offset < arrayBuffer.byteLength - 8 ) {
        const id = String.fromCharCode(
            view.getUint8( offset ),
            view.getUint8( offset + 1 ),
            view.getUint8( offset + 2 ),
            view.getUint8( offset + 3 )
        );
        const size = view.getUint32( offset + 4, true );
        if ( id === 'data' ) {
            return ( size / byteRate ) * 1000;
        }
        offset += 8 + size;
    }
    return 0;
};

const estimateSyllables = ( word ) => {
    const vowels = word.toLowerCase().match( /[aeiouy]+/g );
    return vowels ? Math.max( 1, vowels.length ) : 1;
};

const processChunk = async ( text, voiceId, chunkStartTime, globalWordIndex ) => {
    const words = text.split( /\s+/ ).filter( w => w.length > 0 );
    
    const wavBlob = await ttsModule.predict( { text, voiceId } );
    const audioBuffer = await wavBlob.arrayBuffer();
    const duration = getWavDuration( audioBuffer );
    
    // Calculate word timings
    const totalSyllables = words.reduce( ( sum, w ) => sum + estimateSyllables( w ), 0 );
    const pauseTime = 50;
    const speakingTime = duration - ( words.length * pauseTime );
    
    const timings = [];
    let currentOffset = chunkStartTime;
    let idx = globalWordIndex;
    
    words.forEach( ( word ) => {
        const syllables = estimateSyllables( word );
        const wordDuration = ( syllables / totalSyllables ) * speakingTime;
        timings.push( { word, index: idx++, start: currentOffset, end: currentOffset + wordDuration } );
        currentOffset += wordDuration + pauseTime;
    } );
    
    return {
        audioBuffer,
        timings,
        duration,
        wordCount: words.length
    };
};

self.onmessage = async ( e ) => {
    const { type, data } = e.data;
    
    try {
        switch ( type ) {
            case 'init':
                // Load Piper TTS library via local loader
                ttsModule = await loadPiperTTS();
                self.postMessage( { type: 'ready' } );
                break;
                
            case 'download':
                await ttsModule.download( data.voiceId, ( prog ) => {
                    if ( prog.total ) {
                        self.postMessage( { 
                            type: 'downloadProgress', 
                            progress: prog.loaded / prog.total 
                        } );
                    }
                } );
                self.postMessage( { type: 'downloadComplete' } );
                break;
                
            case 'processChunk':
                const result = await processChunk( 
                    data.text, 
                    data.voiceId, 
                    data.chunkStartTime, 
                    data.globalWordIndex 
                );
                self.postMessage( { 
                    type: 'chunkComplete', 
                    result,
                    chunkIndex: data.chunkIndex
                }, [ result.audioBuffer ] ); // Transfer buffer for performance
                break;
                
            case 'processAll':
                const { chunks, voiceId } = data;
                const results = [];
                let totalDuration = 0;
                let wordIndex = 0;
                
                for ( let i = 0; i < chunks.length; i++ ) {
                    const result = await processChunk( chunks[i], voiceId, totalDuration, wordIndex );
                    results.push( result );
                    totalDuration += result.duration;
                    wordIndex += result.wordCount;
                    
                    self.postMessage( { 
                        type: 'progress', 
                        current: i + 1, 
                        total: chunks.length 
                    } );
                }
                
                self.postMessage( { type: 'allComplete', results } );
                break;
        }
    } catch ( error ) {
        self.postMessage( { type: 'error', error: error.message } );
    }
};
