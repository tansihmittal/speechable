/**
 * Speechable Audio Processor
 * 
 * Applies subtle pitch shifting and reverb effects using Web Audio API.
 * Designed to preserve audio duration for accurate word highlighting sync.
 *
 * @package Speechable
 */

/**
 * Audio Processor class for applying effects to generated audio.
 */
export class AudioProcessor {
    constructor() {
        this.audioContext = null;
    }

    /**
     * Initialize the audio context.
     */
    async init() {
        if ( ! this.audioContext ) {
            this.audioContext = new ( window.AudioContext || window.webkitAudioContext )();
        }
        if ( this.audioContext.state === 'suspended' ) {
            await this.audioContext.resume();
        }
        return this.audioContext;
    }

    /**
     * Process audio with pitch shift and reverb effects.
     * Preserves original duration for word timing sync.
     * 
     * @param {ArrayBuffer} audioBuffer - The WAV audio buffer
     * @param {Object} options - Processing options
     * @param {number} options.pitchShift - Pitch shift in semitones (-12 to 12)
     * @param {number} options.reverb - Reverb amount (0 to 100)
     * @returns {Promise<Blob>} Processed audio as WAV blob
     */
    async process( audioBuffer, options = {} ) {
        const { pitchShift = 0, reverb = 0 } = options;

        // If no effects needed, return original
        if ( pitchShift === 0 && reverb === 0 ) {
            return new Blob( [ audioBuffer ], { type: 'audio/wav' } );
        }

        await this.init();

        // Decode the WAV audio
        const decodedAudio = await this.audioContext.decodeAudioData( audioBuffer.slice( 0 ) );
        const originalLength = decodedAudio.length;
        const sampleRate = decodedAudio.sampleRate;

        let processedBuffer = decodedAudio;

        // Apply pitch shift while preserving duration (granular synthesis approach)
        if ( pitchShift !== 0 ) {
            processedBuffer = await this.applyPitchShiftPreserveDuration( processedBuffer, pitchShift );
        }

        // Apply subtle reverb (room ambience, not echo)
        if ( reverb > 0 ) {
            processedBuffer = await this.applySubtleReverb( processedBuffer, reverb );
        }

        // Ensure output matches original duration exactly
        processedBuffer = this.matchDuration( processedBuffer, originalLength );

        // Convert back to WAV
        return this.audioBufferToWav( processedBuffer );
    }

    /**
     * Apply pitch shift while preserving duration using WSOLA-like approach.
     * This resamples then time-stretches to maintain original length.
     */
    async applyPitchShiftPreserveDuration( audioBuffer, semitones ) {
        // Limit pitch shift to subtle range for natural sound
        const clampedSemitones = Math.max( -6, Math.min( 6, semitones ) );
        const ratio = Math.pow( 2, clampedSemitones / 12 );
        
        // Step 1: Resample (changes pitch AND duration)
        const resampledLength = Math.round( audioBuffer.length / ratio );
        
        const resampleCtx = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            resampledLength,
            audioBuffer.sampleRate
        );

        const source1 = resampleCtx.createBufferSource();
        source1.buffer = audioBuffer;
        source1.playbackRate.value = ratio;
        source1.connect( resampleCtx.destination );
        source1.start( 0 );

        const resampled = await resampleCtx.startRendering();

        // Step 2: Time-stretch back to original duration (simple linear interpolation)
        // This is a basic approach - for better quality, use overlap-add
        const stretched = this.timeStretch( resampled, audioBuffer.length );
        
        return stretched;
    }

    /**
     * Simple time stretching using linear interpolation.
     * Stretches or compresses audio to target length.
     */
    timeStretch( audioBuffer, targetLength ) {
        const numChannels = audioBuffer.numberOfChannels;
        const sourceLength = audioBuffer.length;
        
        const stretched = this.audioContext.createBuffer(
            numChannels,
            targetLength,
            audioBuffer.sampleRate
        );

        for ( let ch = 0; ch < numChannels; ch++ ) {
            const sourceData = audioBuffer.getChannelData( ch );
            const targetData = stretched.getChannelData( ch );
            
            for ( let i = 0; i < targetLength; i++ ) {
                // Map target position to source position
                const srcPos = ( i / targetLength ) * sourceLength;
                const srcIndex = Math.floor( srcPos );
                const frac = srcPos - srcIndex;
                
                // Linear interpolation between samples
                const s0 = sourceData[ srcIndex ] || 0;
                const s1 = sourceData[ srcIndex + 1 ] || s0;
                targetData[ i ] = s0 + frac * ( s1 - s0 );
            }
        }

        return stretched;
    }

    /**
     * Apply subtle reverb - more like room ambience than echo.
     * Uses short impulse response for natural sound.
     */
    async applySubtleReverb( audioBuffer, reverbAmount ) {
        // Scale reverb to be subtle (max 0.8 seconds, mostly dry)
        const reverbTime = 0.1 + ( reverbAmount / 100 ) * 0.7; // 0.1 to 0.8 seconds
        const wetMix = ( reverbAmount / 100 ) * 0.25; // Max 25% wet
        
        const impulseResponse = this.generateRoomImpulse( 
            audioBuffer.sampleRate, 
            reverbTime
        );

        // Render with exact original length (no tail extension)
        const offlineCtx = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );

        // Create convolver for reverb
        const convolver = offlineCtx.createConvolver();
        convolver.buffer = impulseResponse;

        // Create dry/wet mix
        const dryGain = offlineCtx.createGain();
        const wetGain = offlineCtx.createGain();
        
        dryGain.gain.value = 1 - wetMix;
        wetGain.gain.value = wetMix;

        // Source
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;

        // Dry path
        source.connect( dryGain );
        dryGain.connect( offlineCtx.destination );

        // Wet path (through convolver)
        source.connect( convolver );
        convolver.connect( wetGain );
        wetGain.connect( offlineCtx.destination );

        source.start( 0 );

        return offlineCtx.startRendering();
    }

    /**
     * Generate a natural-sounding room impulse response.
     * Uses filtered noise with exponential decay.
     */
    generateRoomImpulse( sampleRate, duration ) {
        const length = Math.floor( sampleRate * duration );
        const impulse = this.audioContext.createBuffer( 2, length, sampleRate );
        
        for ( let channel = 0; channel < 2; channel++ ) {
            const channelData = impulse.getChannelData( channel );
            
            for ( let i = 0; i < length; i++ ) {
                // Exponential decay
                const decay = Math.exp( -3 * i / length );
                
                // Early reflections (first 20ms) - stronger
                const earlyReflection = i < sampleRate * 0.02 ? 0.5 : 0;
                
                // Diffuse tail - filtered noise
                const noise = ( Math.random() * 2 - 1 ) * decay * 0.3;
                
                // Combine with slight stereo variation
                const stereoOffset = channel === 0 ? 0.98 : 1.02;
                channelData[ i ] = ( earlyReflection + noise ) * stereoOffset;
            }
            
            // Initial spike for direct sound
            channelData[ 0 ] = 0.8;
        }
        
        return impulse;
    }

    /**
     * Ensure buffer matches exact target duration.
     */
    matchDuration( audioBuffer, targetLength ) {
        if ( audioBuffer.length === targetLength ) {
            return audioBuffer;
        }

        const matched = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            targetLength,
            audioBuffer.sampleRate
        );
        
        const copyLength = Math.min( audioBuffer.length, targetLength );
        
        for ( let ch = 0; ch < audioBuffer.numberOfChannels; ch++ ) {
            const sourceData = audioBuffer.getChannelData( ch );
            const targetData = matched.getChannelData( ch );
            targetData.set( sourceData.subarray( 0, copyLength ) );
        }
        
        return matched;
    }

    /**
     * Convert AudioBuffer to WAV Blob.
     */
    audioBufferToWav( audioBuffer ) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = audioBuffer.length * blockAlign;
        const bufferSize = 44 + dataSize;
        
        const buffer = new ArrayBuffer( bufferSize );
        const view = new DataView( buffer );
        
        const writeString = ( offset, string ) => {
            for ( let i = 0; i < string.length; i++ ) {
                view.setUint8( offset + i, string.charCodeAt( i ) );
            }
        };
        
        writeString( 0, 'RIFF' );
        view.setUint32( 4, 36 + dataSize, true );
        writeString( 8, 'WAVE' );
        writeString( 12, 'fmt ' );
        view.setUint32( 16, 16, true );
        view.setUint16( 20, 1, true );
        view.setUint16( 22, numChannels, true );
        view.setUint32( 24, sampleRate, true );
        view.setUint32( 28, byteRate, true );
        view.setUint16( 32, blockAlign, true );
        view.setUint16( 34, bitsPerSample, true );
        writeString( 36, 'data' );
        view.setUint32( 40, dataSize, true );
        
        let offset = 44;
        const channels = [];
        for ( let ch = 0; ch < numChannels; ch++ ) {
            channels.push( audioBuffer.getChannelData( ch ) );
        }
        
        for ( let i = 0; i < audioBuffer.length; i++ ) {
            for ( let ch = 0; ch < numChannels; ch++ ) {
                let sample = channels[ ch ][ i ];
                sample = Math.max( -1, Math.min( 1, sample ) );
                const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16( offset, intSample, true );
                offset += 2;
            }
        }
        
        return new Blob( [ buffer ], { type: 'audio/wav' } );
    }

    /**
     * Close the audio context.
     */
    close() {
        if ( this.audioContext ) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

// Singleton instance
let processorInstance = null;

/**
 * Get the audio processor instance.
 */
export function getAudioProcessor() {
    if ( ! processorInstance ) {
        processorInstance = new AudioProcessor();
    }
    return processorInstance;
}
