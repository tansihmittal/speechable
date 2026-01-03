/**
 * Speechable Editor Panel
 *
 * @package Speechable
 */
( function() {
    'use strict';

    if ( typeof wp === 'undefined' || ! wp.plugins || ! wp.editPost || ! wp.element ) {
        return;
    }

    const { registerPlugin } = wp.plugins;
    const { PluginDocumentSettingPanel } = wp.editPost;
    const { Button } = wp.components;
    const { useState, useEffect, useRef, createElement: el } = wp.element;
    const { useSelect, useDispatch } = wp.data;

    let ttsModule = null;
    let ttsWorker = null;
    let useWorker = false;

    // Try to initialize Web Worker for better performance
    const initWorker = () => {
        if ( typeof Worker === 'undefined' || typeof speechableEditor === 'undefined' ) return;
        
        try {
            const workerUrl = speechableEditor.pluginUrl + 'assets/js/tts-worker.js';
            ttsWorker = new Worker( workerUrl, { type: 'module' } );
            useWorker = true;
        } catch ( e ) {
            // Worker not supported or blocked, fall back to main thread
            useWorker = false;
        }
    };
    
    initWorker();

    // ============================================
    // TEXT CLEANER - Inspired by piper-tts-web-demo
    // ============================================
    const TextCleaner = {
        // Common abbreviations
        ABBREVIATIONS: {
            'Mr.': 'Mister',
            'Mrs.': 'Missus',
            'Ms.': 'Miss',
            'Dr.': 'Doctor',
            'Prof.': 'Professor',
            'Sr.': 'Senior',
            'Jr.': 'Junior',
            'vs.': 'versus',
            'etc.': 'etcetera',
            'e.g.': 'for example',
            'i.e.': 'that is',
            'St.': 'Saint',
            'Mt.': 'Mount',
            'Inc.': 'Incorporated',
            'Ltd.': 'Limited',
            'Corp.': 'Corporation',
            'Ave.': 'Avenue',
            'Blvd.': 'Boulevard',
            'Rd.': 'Road'
        },

        // Clean and normalize text for TTS
        clean( text ) {
            if ( ! text ) return '';

            let cleaned = text;

            // Remove emojis
            cleaned = cleaned.replace( /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]/gu, '' );

            // Normalize whitespace
            cleaned = cleaned.replace( /\s+/g, ' ' ).trim();

            // Expand abbreviations
            for ( const [ abbr, full ] of Object.entries( this.ABBREVIATIONS ) ) {
                cleaned = cleaned.replace( new RegExp( abbr.replace( '.', '\\.' ), 'gi' ), full );
            }

            // Handle special characters
            cleaned = cleaned.replace( /\b\/\b/g, ' slash ' );
            cleaned = cleaned.replace( /[\/\\()¯]/g, '' );
            cleaned = cleaned.replace( /["""]/g, '' );
            cleaned = cleaned.replace( /\s—/g, '. ' );
            cleaned = cleaned.replace( /\b_\b/g, ' ' );
            cleaned = cleaned.replace( /\b-\b/g, ' ' );

            // Convert numbers/symbols
            cleaned = cleaned.replace( /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g, ( _, num ) => {
                return num.replace( /,/g, '' ) + ' dollars';
            } );
            cleaned = cleaned.replace( /(\d+)%/g, '$1 percent' );
            cleaned = cleaned.replace( /&/g, ' and ' );
            cleaned = cleaned.replace( /@/g, ' at ' );

            // Remove URLs and emails
            cleaned = cleaned.replace( /https?:\/\/[^\s]+/g, '' );
            cleaned = cleaned.replace( /[\w.-]+@[\w.-]+\.\w+/g, '' );

            // Clean up punctuation
            cleaned = cleaned.replace( /['']/g, "'" );
            cleaned = cleaned.replace( /…/g, '...' );
            cleaned = cleaned.replace( /–/g, ', ' );
            cleaned = cleaned.replace( /([.!?]){2,}/g, '$1' );
            cleaned = cleaned.replace( /([.!?,;:])([A-Za-z])/g, '$1 $2' );

            return cleaned.replace( /\s+/g, ' ' ).trim();
        }
    };

    // ============================================
    // SMART TEXT CHUNKER - From piper-tts-web-demo
    // ============================================
    const TextChunker = {
        MIN_CHUNK_LENGTH: 4,
        MAX_CHUNK_LENGTH: 1500,

        chunk( text, maxChunkSize = 1000 ) {
            if ( ! text ) return [];
            
            const MAX_LEN = Math.min( maxChunkSize, this.MAX_CHUNK_LENGTH );
            const lines = text.split( '\n' );
            const chunks = [];

            for ( const line of lines ) {
                if ( ! line.trim() ) continue;

                // Ensure line ends with punctuation
                const processedLine = /[.!?]$/.test( line.trim() ) ? line : line.trim() + '.';
                
                // Split into sentences
                const sentences = processedLine.split( /(?<=[.!?])(?=\s+|$)/ );
                let currentChunk = '';

                for ( const sentence of sentences ) {
                    const trimmed = sentence.trim();
                    if ( ! trimmed ) continue;

                    // Handle very long sentences
                    if ( trimmed.length > MAX_LEN ) {
                        if ( currentChunk ) {
                            chunks.push( currentChunk );
                            currentChunk = '';
                        }
                        // Split at word boundaries
                        const words = trimmed.split( ' ' );
                        let longChunk = '';
                        for ( const word of words ) {
                            const potential = longChunk + ( longChunk ? ' ' : '' ) + word;
                            if ( potential.length <= MAX_LEN ) {
                                longChunk = potential;
                            } else {
                                if ( longChunk ) chunks.push( longChunk );
                                longChunk = word;
                            }
                        }
                        if ( longChunk ) currentChunk = longChunk;
                        continue;
                    }

                    const potential = currentChunk + ( currentChunk ? ' ' : '' ) + trimmed;
                    if ( potential.length > MAX_LEN ) {
                        if ( currentChunk ) chunks.push( currentChunk );
                        currentChunk = trimmed;
                    } else if ( potential.length < this.MIN_CHUNK_LENGTH ) {
                        currentChunk = potential;
                    } else {
                        if ( currentChunk ) chunks.push( currentChunk );
                        currentChunk = trimmed;
                    }
                }

                if ( currentChunk ) {
                    chunks.push( currentChunk );
                }
            }

            return chunks.filter( c => c.length >= this.MIN_CHUNK_LENGTH );
        }
    };

    // ============================================
    // MODEL CACHE - IndexedDB caching for voice models
    // ============================================
    const ModelCache = {
        DB_NAME: 'speechable-model-cache',
        DB_VERSION: 1,
        STORE_NAME: 'models',

        async openDB() {
            return new Promise( ( resolve, reject ) => {
                const request = indexedDB.open( this.DB_NAME, this.DB_VERSION );
                
                request.onerror = () => reject( request.error );
                request.onsuccess = () => resolve( request.result );
                
                request.onupgradeneeded = ( event ) => {
                    const db = event.target.result;
                    if ( ! db.objectStoreNames.contains( this.STORE_NAME ) ) {
                        db.createObjectStore( this.STORE_NAME, { keyPath: 'voiceId' } );
                    }
                };
            } );
        },

        async get( voiceId ) {
            try {
                const db = await this.openDB();
                return new Promise( ( resolve, reject ) => {
                    const tx = db.transaction( this.STORE_NAME, 'readonly' );
                    const store = tx.objectStore( this.STORE_NAME );
                    const request = store.get( voiceId );
                    
                    request.onerror = () => reject( request.error );
                    request.onsuccess = () => resolve( request.result );
                } );
            } catch ( e ) {
                return null;
            }
        },

        async set( voiceId, data ) {
            try {
                const db = await this.openDB();
                return new Promise( ( resolve, reject ) => {
                    const tx = db.transaction( this.STORE_NAME, 'readwrite' );
                    const store = tx.objectStore( this.STORE_NAME );
                    const request = store.put( { voiceId, data, timestamp: Date.now() } );
                    
                    request.onerror = () => reject( request.error );
                    request.onsuccess = () => resolve();
                } );
            } catch ( e ) {
                // Silently fail - caching is optional
            }
        },

        async isCached( voiceId ) {
            const cached = await this.get( voiceId );
            return !! cached;
        }
    };

    // Quality presets - affects sentence chunking and audio quality
    const QUALITY_PRESETS = {
        low: { 
            name: 'Low (Smaller file)', 
            chunkSize: 1500, 
            sampleRate: 16000,
            description: 'Smallest file, fastest generation' 
        },
        medium: { 
            name: 'Medium', 
            chunkSize: 1000, 
            sampleRate: 22050,
            description: 'Balanced quality and speed' 
        },
        high: { 
            name: 'High (Best quality)', 
            chunkSize: 600, 
            sampleRate: 22050,
            description: 'Best sync accuracy, slower generation' 
        }
    };

    const SpeechablePanel = () => {
        const [ isGenerating, setIsGenerating ] = useState( false );
        const [ progress, setProgress ] = useState( 0 );
        const [ status, setStatus ] = useState( '' );
        const [ error, setError ] = useState( null );
        const [ selectedLang, setSelectedLang ] = useState( speechableEditor?.options?.language || 'en' );
        const [ selectedVoice, setSelectedVoice ] = useState(
            speechableEditor?.options?.voice || 'en_US-hfc_female-medium'
        );
        const [ quality, setQuality ] = useState( speechableEditor?.options?.quality || 'medium' );
        const [ speed, setSpeed ] = useState( speechableEditor?.options?.speed || 1.0 );
        const [ hasAudio, setHasAudio ] = useState( false );
        const [ audioUrl, setAudioUrl ] = useState( null );
        const [ isPlaying, setIsPlaying ] = useState( false );
        const [ currentTime, setCurrentTime ] = useState( 0 );
        const [ duration, setDuration ] = useState( 0 );
        const [ estimatedTime, setEstimatedTime ] = useState( '' );
        const [ isLargeText, setIsLargeText ] = useState( false );
        const audioRef = useRef( null );
        const cancelRef = useRef( false );

        // Large text threshold (words)
        const LARGE_TEXT_THRESHOLD = 2000;
        const BATCH_SIZE = 5; // Process chunks in batches for large text

        const postTitle = useSelect( ( select ) =>
            select( 'core/editor' ).getEditedPostAttribute( 'title' ) || ''
        );

        const postContent = useSelect( ( select ) => {
            const content = select( 'core/editor' ).getEditedPostContent();
            const text = content ? content.replace( /<[^>]*>/g, ' ' ).replace( /\s+/g, ' ' ).trim() : '';
            return postTitle ? postTitle + '. ' + text : text;
        } );

        const postId = useSelect( ( select ) => select( 'core/editor' ).getCurrentPostId() );
        const { editPost } = useDispatch( 'core/editor' );

        const existingAudio = useSelect( ( select ) => {
            const meta = select( 'core/editor' ).getEditedPostAttribute( 'meta' );
            return meta?._speechable_audio || null;
        } );

        useEffect( () => {
            if ( existingAudio ) {
                setHasAudio( true );
                setAudioUrl( existingAudio );
            }
        }, [ existingAudio ] );

        // Calculate estimated time based on content length and quality
        useEffect( () => {
            if ( ! postContent ) {
                setEstimatedTime( '' );
                setIsLargeText( false );
                return;
            }
            
            const words = postContent.split( /\s+/ ).length;
            const chars = postContent.length;
            
            // Check if large text
            setIsLargeText( words > LARGE_TEXT_THRESHOLD );
            
            // Rough estimates: ~150 words per minute speech, plus processing time
            const speechMinutes = words / 150;
            const qualityMultiplier = quality === 'low' ? 0.8 : quality === 'medium' ? 1.2 : 2;
            const processingMinutes = ( chars / 1000 ) * 0.3 * qualityMultiplier;
            const totalSeconds = Math.ceil( ( speechMinutes + processingMinutes ) * 60 );
            
            if ( totalSeconds < 60 ) {
                setEstimatedTime( `~${totalSeconds}s` );
            } else {
                const mins = Math.floor( totalSeconds / 60 );
                const secs = totalSeconds % 60;
                setEstimatedTime( `~${mins}m ${secs}s` );
            }
        }, [ postContent, quality ] );

        useEffect( () => {
            if ( audioRef.current ) {
                audioRef.current.ontimeupdate = () => setCurrentTime( audioRef.current.currentTime );
                audioRef.current.onloadedmetadata = () => {
                    setDuration( audioRef.current.duration );
                    audioRef.current.playbackRate = speed;
                };
                audioRef.current.onended = () => setIsPlaying( false );
            }
        }, [ audioUrl, speed ] );

        const voices = speechableEditor?.voices || {};
        const languages = speechableEditor?.languages || {};

        const filteredVoices = Object.entries( voices )
            .filter( ( [ , v ] ) => v.lang === selectedLang )
            .map( ( [ id, v ] ) => ( { value: id, label: v.name } ) );

        useEffect( () => {
            const first = filteredVoices[ 0 ];
            if ( first && ! filteredVoices.find( ( v ) => v.value === selectedVoice ) ) {
                setSelectedVoice( first.value );
            }
        }, [ selectedLang ] );

        const loadTTS = async () => {
            if ( ttsModule ) return ttsModule;
            ttsModule = await import( 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/+esm' );
            return ttsModule;
        };

        // Get WAV duration from header (avoids creating Audio element)
        const getWavDuration = ( arrayBuffer ) => {
            const view = new DataView( arrayBuffer );
            const sampleRate = view.getUint32( 24, true );
            const numChannels = view.getUint16( 22, true );
            const bitsPerSample = view.getUint16( 34, true );
            const byteRate = sampleRate * numChannels * ( bitsPerSample / 8 );
            
            // Find data chunk size
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
                    return ( size / byteRate ) * 1000; // Duration in ms
                }
                offset += 8 + size;
            }
            return 0;
        };

        // Syllable estimator (cached for performance)
        const estimateSyllables = ( word ) => {
            const vowels = word.toLowerCase().match( /[aeiouy]+/g );
            return vowels ? Math.max( 1, vowels.length ) : 1;
        };

        // Process a single chunk and return timing + audio data
        const processChunk = async ( tts, chunk, chunkStartTime, globalWordIndex, voiceId ) => {
            const words = chunk.split( /\s+/ ).filter( w => w.length > 0 );
            const timings = [];

            const wavBlob = await tts.predict( { text: chunk, voiceId } );
            const audioBuffer = await wavBlob.arrayBuffer();
            
            // Get duration directly from WAV header (much faster than Audio element)
            const chunkDuration = getWavDuration( audioBuffer );

            const totalSyllables = words.reduce( ( sum, w ) => sum + estimateSyllables( w ), 0 );
            const pauseTime = 50;
            const speakingTime = chunkDuration - ( words.length * pauseTime );
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
                duration: chunkDuration,
                wordCount: words.length
            };
        };

        // Process chunks in batches for large text
        const processBatch = async ( tts, chunks, startIdx, batchSize, voiceId, onProgress ) => {
            const results = [];
            const batch = chunks.slice( startIdx, startIdx + batchSize );
            
            let totalDuration = 0;
            let globalWordIndex = 0;

            // Calculate starting values from previous results
            for ( let i = 0; i < startIdx; i++ ) {
                // Estimate - will be corrected as we process
            }

            for ( let i = 0; i < batch.length; i++ ) {
                if ( cancelRef.current ) throw new Error( 'Cancelled' );
                
                const result = await processChunk( tts, batch[ i ], totalDuration, globalWordIndex, voiceId );
                results.push( result );
                totalDuration += result.duration;
                globalWordIndex += result.wordCount;
                
                onProgress( startIdx + i + 1 );
                
                // Allow UI to update
                await new Promise( r => setTimeout( r, 0 ) );
            }

            return results;
        };

        const cancelGeneration = () => {
            cancelRef.current = true;
        };

        const generateAudio = async () => {
            if ( ! postContent ) {
                setError( 'No content to generate audio from.' );
                return;
            }

            cancelRef.current = false;
            setIsGenerating( true );
            setProgress( 0 );
            setError( null );
            setStatus( 'Loading TTS engine...' );

            try {
                const tts = await loadTTS();

                // Check if model is cached
                const isCached = await ModelCache.isCached( selectedVoice );
                setStatus( isCached ? 'Loading cached voice...' : 'Downloading voice model...' );
                setProgress( 5 );

                await tts.download( selectedVoice, ( prog ) => {
                    if ( prog.total ) {
                        setProgress( 5 + Math.round( ( prog.loaded / prog.total ) * 10 ) );
                    }
                } );

                if ( cancelRef.current ) throw new Error( 'Cancelled' );

                // Mark as cached for next time
                if ( ! isCached ) {
                    await ModelCache.set( selectedVoice, true );
                }

                setStatus( 'Processing text...' );
                setProgress( 15 );

                // Clean and chunk text
                const cleanedText = TextCleaner.clean( postContent );
                const qualitySettings = QUALITY_PRESETS[ quality ];
                const chunks = TextChunker.chunk( cleanedText, qualitySettings.chunkSize );
                
                const totalChunks = chunks.length;
                const wordTimings = [];
                const audioChunks = [];
                let totalDuration = 0;
                let globalWordIndex = 0;

                setStatus( `Generating audio (${totalChunks} chunks)...` );

                // Process chunks with parallelism for better performance
                const PARALLEL_CHUNKS = 3; // Process 3 chunks at a time
                
                for ( let i = 0; i < chunks.length; i += PARALLEL_CHUNKS ) {
                    if ( cancelRef.current ) throw new Error( 'Cancelled' );

                    // Get batch of chunks to process in parallel
                    const batchEnd = Math.min( i + PARALLEL_CHUNKS, chunks.length );
                    const batchChunks = chunks.slice( i, batchEnd );
                    
                    // Process batch in parallel
                    const batchPromises = batchChunks.map( ( chunk, idx ) => {
                        const chunkIdx = i + idx;
                        // Calculate approximate start time (will be corrected after)
                        return processChunk( tts, chunk, 0, 0, selectedVoice )
                            .then( result => ( { ...result, chunkIdx } ) );
                    } );
                    
                    const batchResults = await Promise.all( batchPromises );
                    
                    // Sort by original index and add to results with correct timings
                    batchResults.sort( ( a, b ) => a.chunkIdx - b.chunkIdx );
                    
                    for ( const result of batchResults ) {
                        // Recalculate timings with correct offsets
                        const correctedTimings = result.timings.map( t => ( {
                            ...t,
                            index: globalWordIndex + ( t.index - result.timings[0]?.index || 0 ),
                            start: totalDuration + t.start,
                            end: totalDuration + t.end
                        } ) );
                        
                        wordTimings.push( ...correctedTimings );
                        audioChunks.push( result.audioBuffer );
                        totalDuration += result.duration;
                        globalWordIndex += result.wordCount;
                    }

                    const pct = 15 + Math.round( ( batchEnd / totalChunks ) * 70 );
                    setProgress( pct );
                    setStatus( `Processing ${ batchEnd }/${ totalChunks } chunks...` );
                }

                if ( cancelRef.current ) throw new Error( 'Cancelled' );

                setStatus( 'Combining audio...' );
                setProgress( 88 );

                // For very large audio, combine in stages to avoid memory issues
                let combined;
                if ( audioChunks.length > 50 ) {
                    combined = await combineWavLarge( audioChunks );
                } else {
                    combined = await combineWav( audioChunks );
                }

                // Clear audio chunks from memory
                audioChunks.length = 0;

                if ( cancelRef.current ) throw new Error( 'Cancelled' );

                setStatus( 'Saving...' );
                setProgress( 95 );

                const audioDataUrl = await new Promise( ( resolve, reject ) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve( reader.result );
                    reader.onerror = reject;
                    reader.readAsDataURL( combined );
                } );

                await fetch( speechableEditor.ajaxUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams( {
                        action: 'speechable_save_audio',
                        nonce: speechableEditor.nonce,
                        post_id: postId,
                        audio_data: audioDataUrl,
                        word_timings: JSON.stringify( wordTimings ),
                    } ),
                } );

                editPost( {
                    meta: {
                        _speechable_audio: audioDataUrl,
                        _speechable_word_timings: JSON.stringify( wordTimings ),
                    },
                } );

                setAudioUrl( audioDataUrl );
                setHasAudio( true );
                setProgress( 100 );
                setStatus( 'Done!' );
            } catch ( err ) {
                if ( err.message === 'Cancelled' ) {
                    setStatus( 'Cancelled' );
                    setError( null );
                } else {
                    setError( err.message );
                    setStatus( '' );
                }
            } finally {
                setIsGenerating( false );
                cancelRef.current = false;
            }
        };

        // Audio processing utilities from piper-tts-web-demo
        const normalizePeak = ( samples, target = 0.9 ) => {
            if ( ! samples?.length ) return samples;
            let max = 1e-9;
            for ( let i = 0; i < samples.length; i++ ) {
                max = Math.max( max, Math.abs( samples[ i ] ) );
            }
            const gain = Math.min( 4, target / max );
            if ( gain < 1 ) {
                for ( let i = 0; i < samples.length; i++ ) {
                    samples[ i ] *= gain;
                }
            }
            return samples;
        };

        const trimSilence = ( samples, thresh = 0.002, minSamples = 480 ) => {
            let start = 0, end = samples.length - 1;
            while ( start < end && Math.abs( samples[ start ] ) < thresh ) start++;
            while ( end > start && Math.abs( samples[ end ] ) < thresh ) end--;
            start = Math.max( 0, start - minSamples );
            end = Math.min( samples.length, end + minSamples );
            return samples.slice( start, end );
        };

        const combineWav = async ( chunks ) => {
            if ( chunks.length === 1 ) {
                return new Blob( [ chunks[ 0 ] ], { type: 'audio/wav' } );
            }

            let totalData = 0;
            let sampleRate = 22050;
            let numChannels = 1;
            let bitsPerSample = 16;
            const pcm = [];

            for ( const chunk of chunks ) {
                const view = new DataView( chunk );
                sampleRate = view.getUint32( 24, true );
                numChannels = view.getUint16( 22, true );
                bitsPerSample = view.getUint16( 34, true );

                let offset = 12;
                while ( offset < chunk.byteLength - 8 ) {
                    const id = String.fromCharCode(
                        view.getUint8( offset ),
                        view.getUint8( offset + 1 ),
                        view.getUint8( offset + 2 ),
                        view.getUint8( offset + 3 )
                    );
                    const size = view.getUint32( offset + 4, true );
                    if ( id === 'data' ) {
                        pcm.push( new Uint8Array( chunk, offset + 8, size ) );
                        totalData += size;
                        break;
                    }
                    offset += 8 + size;
                }
            }

            const buffer = new ArrayBuffer( 44 + totalData );
            const view = new DataView( buffer );
            const write = ( o, s ) => { for ( let i = 0; i < s.length; i++ ) view.setUint8( o + i, s.charCodeAt( i ) ); };

            write( 0, 'RIFF' );
            view.setUint32( 4, 36 + totalData, true );
            write( 8, 'WAVE' );
            write( 12, 'fmt ' );
            view.setUint32( 16, 16, true );
            view.setUint16( 20, 1, true );
            view.setUint16( 22, numChannels, true );
            view.setUint32( 24, sampleRate, true );
            view.setUint32( 28, sampleRate * numChannels * ( bitsPerSample / 8 ), true );
            view.setUint16( 32, numChannels * ( bitsPerSample / 8 ), true );
            view.setUint16( 34, bitsPerSample, true );
            write( 36, 'data' );
            view.setUint32( 40, totalData, true );

            let offset = 44;
            for ( const p of pcm ) {
                new Uint8Array( buffer, offset, p.length ).set( p );
                offset += p.length;
            }

            return new Blob( [ buffer ], { type: 'audio/wav' } );
        };

        // Memory-efficient WAV combining for large files
        const combineWavLarge = async ( chunks ) => {
            // First pass: get metadata and calculate total size
            let totalData = 0;
            let sampleRate = 22050;
            let numChannels = 1;
            let bitsPerSample = 16;
            const chunkInfo = [];

            for ( let i = 0; i < chunks.length; i++ ) {
                const chunk = chunks[ i ];
                const view = new DataView( chunk );
                sampleRate = view.getUint32( 24, true );
                numChannels = view.getUint16( 22, true );
                bitsPerSample = view.getUint16( 34, true );

                let offset = 12;
                while ( offset < chunk.byteLength - 8 ) {
                    const id = String.fromCharCode(
                        view.getUint8( offset ),
                        view.getUint8( offset + 1 ),
                        view.getUint8( offset + 2 ),
                        view.getUint8( offset + 3 )
                    );
                    const size = view.getUint32( offset + 4, true );
                    if ( id === 'data' ) {
                        chunkInfo.push( { chunkIdx: i, dataOffset: offset + 8, dataSize: size } );
                        totalData += size;
                        break;
                    }
                    offset += 8 + size;
                }
            }

            // Create header
            const header = new ArrayBuffer( 44 );
            const headerView = new DataView( header );
            const write = ( o, s ) => { for ( let i = 0; i < s.length; i++ ) headerView.setUint8( o + i, s.charCodeAt( i ) ); };

            write( 0, 'RIFF' );
            headerView.setUint32( 4, 36 + totalData, true );
            write( 8, 'WAVE' );
            write( 12, 'fmt ' );
            headerView.setUint32( 16, 16, true );
            headerView.setUint16( 20, 1, true );
            headerView.setUint16( 22, numChannels, true );
            headerView.setUint32( 24, sampleRate, true );
            headerView.setUint32( 28, sampleRate * numChannels * ( bitsPerSample / 8 ), true );
            headerView.setUint16( 32, numChannels * ( bitsPerSample / 8 ), true );
            headerView.setUint16( 34, bitsPerSample, true );
            write( 36, 'data' );
            headerView.setUint32( 40, totalData, true );

            // Combine in batches to avoid memory spikes
            const blobParts = [ header ];
            const COMBINE_BATCH = 20;

            for ( let i = 0; i < chunkInfo.length; i += COMBINE_BATCH ) {
                const batch = chunkInfo.slice( i, i + COMBINE_BATCH );
                for ( const info of batch ) {
                    const chunk = chunks[ info.chunkIdx ];
                    blobParts.push( new Uint8Array( chunk, info.dataOffset, info.dataSize ) );
                }
                // Allow GC between batches
                await new Promise( r => setTimeout( r, 0 ) );
            }

            return new Blob( blobParts, { type: 'audio/wav' } );
        };

        const removeAudio = async () => {
            await fetch( speechableEditor.ajaxUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams( {
                    action: 'speechable_delete_audio',
                    nonce: speechableEditor.nonce,
                    post_id: postId,
                } ),
            } );

            editPost( { meta: { _speechable_audio: '', _speechable_word_timings: '' } } );
            setHasAudio( false );
            setAudioUrl( null );
            setIsPlaying( false );
        };

        const togglePlay = () => {
            if ( ! audioRef.current ) return;
            if ( isPlaying ) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying( ! isPlaying );
        };

        const formatTime = ( s ) => {
            const m = Math.floor( s / 60 );
            const sec = Math.floor( s % 60 );
            return `${ m }:${ sec.toString().padStart( 2, '0' ) }`;
        };

        const langOptions = Object.entries( languages ).map( ( [ code, name ] ) => ( { value: code, label: name } ) );
        const qualityOptions = Object.entries( QUALITY_PRESETS ).map( ( [ key, val ] ) => ( { value: key, label: val.name } ) );
        const speedOptions = [
            { value: 0.5, label: '0.5x (Slow)' },
            { value: 0.75, label: '0.75x' },
            { value: 1.0, label: '1x (Normal)' },
            { value: 1.25, label: '1.25x' },
            { value: 1.5, label: '1.5x' },
            { value: 1.75, label: '1.75x' },
            { value: 2.0, label: '2x (Fast)' }
        ];

        return el(
            PluginDocumentSettingPanel,
            { name: 'speechable-panel', title: 'Audio Generation', className: 'speechable-panel' },

            audioUrl && el( 'audio', { ref: audioRef, src: audioUrl, preload: 'metadata' } ),

            error && el( 'div', {
                style: { padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', marginBottom: '12px', color: '#dc2626', fontSize: '13px' },
            }, error ),

            // Language selector
            el( 'div', { style: { marginBottom: '12px' } },
                el( 'label', { style: { display: 'block', fontSize: '11px', fontWeight: '500', marginBottom: '4px', color: '#6b7280', textTransform: 'uppercase' } }, 'Language' ),
                el( 'select', {
                    value: selectedLang,
                    onChange: ( e ) => setSelectedLang( e.target.value ),
                    disabled: isGenerating,
                    style: { width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' },
                }, langOptions.map( ( o ) => el( 'option', { key: o.value, value: o.value }, o.label ) ) )
            ),

            // Voice selector
            el( 'div', { style: { marginBottom: '12px' } },
                el( 'label', { style: { display: 'block', fontSize: '11px', fontWeight: '500', marginBottom: '4px', color: '#6b7280', textTransform: 'uppercase' } }, 'Voice' ),
                el( 'select', {
                    value: selectedVoice,
                    onChange: ( e ) => setSelectedVoice( e.target.value ),
                    disabled: isGenerating,
                    style: { width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' },
                }, filteredVoices.map( ( o ) => el( 'option', { key: o.value, value: o.value }, o.label ) ) )
            ),

            // Quality selector
            el( 'div', { style: { marginBottom: '12px' } },
                el( 'label', { style: { display: 'block', fontSize: '11px', fontWeight: '500', marginBottom: '4px', color: '#6b7280', textTransform: 'uppercase' } }, 'Quality' ),
                el( 'select', {
                    value: quality,
                    onChange: ( e ) => setQuality( e.target.value ),
                    disabled: isGenerating,
                    style: { width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' },
                }, qualityOptions.map( ( o ) => el( 'option', { key: o.value, value: o.value }, o.label ) ) ),
                el( 'p', { style: { fontSize: '11px', color: '#9ca3af', margin: '4px 0 0' } }, QUALITY_PRESETS[ quality ].description )
            ),

            // Speed selector
            el( 'div', { style: { marginBottom: '12px' } },
                el( 'label', { style: { display: 'block', fontSize: '11px', fontWeight: '500', marginBottom: '4px', color: '#6b7280', textTransform: 'uppercase' } }, 'Playback Speed' ),
                el( 'select', {
                    value: speed,
                    onChange: ( e ) => setSpeed( parseFloat( e.target.value ) ),
                    disabled: isGenerating,
                    style: { width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' },
                }, speedOptions.map( ( o ) => el( 'option', { key: o.value, value: o.value }, o.label ) ) )
            ),

            // Estimated time
            postContent && ! isGenerating && el( 'div', {
                style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '12px', padding: '8px', background: '#f9fafb', borderRadius: '6px' }
            },
                el( 'span', null, `${ postContent.split( /\s+/ ).length } words` ),
                el( 'span', null, `Est. time: ${ estimatedTime }` )
            ),

            // Large text warning
            isLargeText && ! isGenerating && el( 'div', {
                style: { padding: '8px 12px', background: '#fefce8', border: '1px solid #fef08a', borderRadius: '6px', marginBottom: '12px', color: '#a16207', fontSize: '12px' }
            }, '⚠ Large content detected. Generation may take several minutes. You can cancel anytime.' ),

            // Progress bar
            isGenerating && el( 'div', { style: { marginBottom: '12px' } },
                el( 'div', { style: { height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' } },
                    el( 'div', { style: { height: '100%', width: progress + '%', background: '#2563eb', transition: 'width 0.2s' } } )
                ),
                el( 'p', { style: { fontSize: '12px', color: '#6b7280', margin: '6px 0 0' } }, status )
            ),

            // Preview player
            hasAudio && audioUrl && ! isGenerating && el( 'div', {
                style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: '#f9fafb', borderRadius: '6px', marginBottom: '12px' },
            },
                el( 'button', {
                    onClick: togglePlay,
                    type: 'button',
                    style: { width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
                }, isPlaying ? '❚❚' : '▶' ),
                el( 'div', {
                    style: { flex: 1, height: '4px', background: '#e5e7eb', borderRadius: '2px', cursor: 'pointer' },
                    onClick: ( e ) => {
                        if ( ! audioRef.current || ! duration ) return;
                        const rect = e.target.getBoundingClientRect();
                        audioRef.current.currentTime = ( ( e.clientX - rect.left ) / rect.width ) * duration;
                    },
                },
                    el( 'div', { style: { height: '100%', width: ( duration ? ( currentTime / duration ) * 100 : 0 ) + '%', background: '#2563eb', borderRadius: '2px' } } )
                ),
                el( 'span', { style: { fontSize: '11px', color: '#6b7280', minWidth: '70px', textAlign: 'right' } },
                    formatTime( currentTime ) + ' / ' + formatTime( duration )
                )
            ),

            // Success indicator
            hasAudio && ! isGenerating && el( 'div', {
                style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', marginBottom: '12px', color: '#16a34a', fontSize: '13px' },
            }, '✓ Audio ready' ),

            // Buttons
            el( 'div', { style: { display: 'flex', gap: '8px' } },
                isGenerating ? el( Button, {
                    variant: 'secondary',
                    onClick: cancelGeneration,
                    isDestructive: true,
                }, 'Cancel' ) : el( Button, {
                    variant: 'primary',
                    onClick: generateAudio,
                    disabled: ! postContent,
                    style: { flex: 1 },
                }, hasAudio ? 'Regenerate' : 'Generate Audio' ),

                hasAudio && ! isGenerating && el( Button, {
                    variant: 'secondary',
                    onClick: removeAudio,
                    isDestructive: true,
                }, 'Remove' )
            )
        );
    };

    registerPlugin( 'speechable-panel', {
        render: SpeechablePanel,
        icon: 'microphone',
    } );
} )();
