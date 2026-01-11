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
    let whisperPipeline = null;
    let ttsWorker = null;
    let useWorker = false;
    let audioProcessor = null;

    /**
     * Load the audio processor module.
     * 
     * @returns {Promise<Object>} The audio processor
     */
    const loadAudioProcessor = async () => {
        if ( audioProcessor ) {
            return audioProcessor;
        }
        const module = await import( speechableEditor.pluginUrl + 'assets/js/audio-processor.js' );
        audioProcessor = module.getAudioProcessor();
        return audioProcessor;
    };

    /**
     * Load the Piper TTS module via local loader.
     * 
     * @returns {Promise<Object>} The Piper TTS module
     */
    const loadPiperTTS = async () => {
        if ( ttsModule ) {
            return ttsModule;
        }
        const loader = await import( speechableEditor.pluginUrl + 'assets/js/vendor/piper-tts-loader.js' );
        ttsModule = await loader.loadPiperTTS();
        return ttsModule;
    };

    /**
     * Load the Whisper pipeline via local loader.
     * 
     * @param {string} modelId - The Whisper model ID
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} The Whisper pipeline
     */
    const loadWhisperPipeline = async ( modelId, onProgress ) => {
        if ( whisperPipeline ) {
            return whisperPipeline;
        }
        const loader = await import( speechableEditor.pluginUrl + 'assets/js/vendor/whisper-loader.js' );
        whisperPipeline = await loader.loadWhisperPipeline( modelId, onProgress );
        return whisperPipeline;
    };

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
    // TEXT CLEANER - Enhanced for natural TTS
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
            'Rd.': 'Road',
            'approx.': 'approximately',
            'govt.': 'government',
            'dept.': 'department',
            'est.': 'established',
            'min.': 'minutes',
            'max.': 'maximum',
            'avg.': 'average',
            'no.': 'number',
            'vol.': 'volume',
            'Jan.': 'January',
            'Feb.': 'February',
            'Mar.': 'March',
            'Apr.': 'April',
            'Jun.': 'June',
            'Jul.': 'July',
            'Aug.': 'August',
            'Sep.': 'September',
            'Sept.': 'September',
            'Oct.': 'October',
            'Nov.': 'November',
            'Dec.': 'December'
        },

        // Number words for conversion
        ONES: [ '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen' ],
        TENS: [ '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety' ],
        SCALES: [ '', 'thousand', 'million', 'billion', 'trillion' ],

        // Convert number to words (handles up to trillions)
        numberToWords( num ) {
            if ( num === 0 ) return 'zero';
            if ( num < 0 ) return 'negative ' + this.numberToWords( -num );
            if ( ! Number.isInteger( num ) ) {
                const parts = num.toString().split( '.' );
                const intPart = this.numberToWords( parseInt( parts[ 0 ], 10 ) );
                const decPart = parts[ 1 ].split( '' ).map( d => this.ONES[ parseInt( d, 10 ) ] || d ).join( ' ' );
                return intPart + ' point ' + decPart;
            }

            let words = '';
            let scaleIndex = 0;

            while ( num > 0 ) {
                const chunk = num % 1000;
                if ( chunk > 0 ) {
                    const chunkWords = this.chunkToWords( chunk );
                    const scale = this.SCALES[ scaleIndex ];
                    words = chunkWords + ( scale ? ' ' + scale : '' ) + ( words ? ' ' + words : '' );
                }
                num = Math.floor( num / 1000 );
                scaleIndex++;
            }

            return words.trim();
        },

        chunkToWords( num ) {
            if ( num < 20 ) return this.ONES[ num ];
            if ( num < 100 ) {
                return this.TENS[ Math.floor( num / 10 ) ] + ( num % 10 ? ' ' + this.ONES[ num % 10 ] : '' );
            }
            return this.ONES[ Math.floor( num / 100 ) ] + ' hundred' + ( num % 100 ? ' ' + this.chunkToWords( num % 100 ) : '' );
        },

        // Convert ordinal numbers (1st, 2nd, 3rd, etc.)
        ordinalToWords( num ) {
            const ordinals = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth', 11: 'eleventh', 12: 'twelfth' };
            if ( ordinals[ num ] ) return ordinals[ num ];
            const word = this.numberToWords( num );
            if ( word.endsWith( 'y' ) ) return word.slice( 0, -1 ) + 'ieth';
            if ( word.endsWith( 'e' ) ) return word + 'th';
            return word + 'th';
        },

        // Clean and normalize text for TTS
        clean( text ) {
            if ( ! text ) return '';

            let cleaned = text;

            // Remove emojis
            cleaned = cleaned.replace( /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]/gu, '' );

            // Normalize whitespace
            cleaned = cleaned.replace( /\s+/g, ' ' ).trim();

            // Expand abbreviations (case-insensitive with word boundaries)
            for ( const [ abbr, full ] of Object.entries( this.ABBREVIATIONS ) ) {
                const pattern = new RegExp( '\\b' + abbr.replace( '.', '\\.' ), 'gi' );
                cleaned = cleaned.replace( pattern, full );
            }

            // Handle special characters
            cleaned = cleaned.replace( /\b\/\b/g, ' slash ' );
            cleaned = cleaned.replace( /[\/\\()¯\[\]{}]/g, '' );
            cleaned = cleaned.replace( /["""„«»]/g, '' );
            cleaned = cleaned.replace( /\s[—–]\s/g, ', ' );
            cleaned = cleaned.replace( /\b_\b/g, ' ' );

            // Convert times (e.g., 3:30 PM -> three thirty PM)
            cleaned = cleaned.replace( /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/g, ( _, h, m, ampm ) => {
                const hour = this.numberToWords( parseInt( h, 10 ) );
                const min = m === '00' ? '' : ( m.startsWith( '0' ) ? 'oh ' + this.numberToWords( parseInt( m, 10 ) ) : this.numberToWords( parseInt( m, 10 ) ) );
                return hour + ( min ? ' ' + min : '' ) + ( ampm ? ' ' + ampm : '' );
            } );

            // Convert dates (e.g., 2024 -> twenty twenty-four for years)
            cleaned = cleaned.replace( /\b(19|20)(\d{2})\b/g, ( _, century, year ) => {
                const c = parseInt( century, 10 );
                const y = parseInt( year, 10 );
                if ( y === 0 ) return this.numberToWords( c * 100 );
                if ( y < 10 ) return this.numberToWords( c ) + ' oh ' + this.numberToWords( y );
                return this.numberToWords( c ) + ' ' + this.numberToWords( y );
            } );

            // Convert ordinals (1st, 2nd, 3rd, etc.)
            cleaned = cleaned.replace( /(\d+)(st|nd|rd|th)\b/gi, ( _, num ) => {
                return this.ordinalToWords( parseInt( num, 10 ) );
            } );

            // Convert currency
            cleaned = cleaned.replace( /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g, ( _, num ) => {
                const amount = parseFloat( num.replace( /,/g, '' ) );
                if ( amount === 1 ) return 'one dollar';
                const dollars = Math.floor( amount );
                const cents = Math.round( ( amount - dollars ) * 100 );
                let result = this.numberToWords( dollars ) + ' dollar' + ( dollars !== 1 ? 's' : '' );
                if ( cents > 0 ) {
                    result += ' and ' + this.numberToWords( cents ) + ' cent' + ( cents !== 1 ? 's' : '' );
                }
                return result;
            } );

            // Convert other currencies
            cleaned = cleaned.replace( /€(\d+(?:,\d{3})*(?:\.\d{2})?)/g, ( _, num ) => {
                const amount = parseFloat( num.replace( /,/g, '' ) );
                return this.numberToWords( Math.floor( amount ) ) + ' euro' + ( amount !== 1 ? 's' : '' );
            } );
            cleaned = cleaned.replace( /£(\d+(?:,\d{3})*(?:\.\d{2})?)/g, ( _, num ) => {
                const amount = parseFloat( num.replace( /,/g, '' ) );
                return this.numberToWords( Math.floor( amount ) ) + ' pound' + ( amount !== 1 ? 's' : '' );
            } );

            // Convert percentages
            cleaned = cleaned.replace( /(\d+(?:\.\d+)?)\s*%/g, ( _, num ) => {
                const n = parseFloat( num );
                return ( Number.isInteger( n ) ? this.numberToWords( n ) : num ) + ' percent';
            } );

            // Convert standalone numbers (but not in the middle of words/codes)
            cleaned = cleaned.replace( /(?<![a-zA-Z0-9])(\d{1,4})(?![a-zA-Z0-9])/g, ( _, num ) => {
                const n = parseInt( num, 10 );
                if ( n <= 9999 ) return this.numberToWords( n );
                return num;
            } );

            // Convert larger numbers with commas
            cleaned = cleaned.replace( /(\d{1,3}(?:,\d{3})+)/g, ( _, num ) => {
                return this.numberToWords( parseInt( num.replace( /,/g, '' ), 10 ) );
            } );

            // Common symbols
            cleaned = cleaned.replace( /&/g, ' and ' );
            cleaned = cleaned.replace( /@/g, ' at ' );
            cleaned = cleaned.replace( /\+/g, ' plus ' );
            cleaned = cleaned.replace( /=/g, ' equals ' );
            cleaned = cleaned.replace( /#(\w+)/g, 'hashtag $1' );
            cleaned = cleaned.replace( /(\d+)\s*x\s*(\d+)/gi, '$1 by $2' );

            // Remove URLs and emails
            cleaned = cleaned.replace( /https?:\/\/[^\s]+/g, '' );
            cleaned = cleaned.replace( /[\w.-]+@[\w.-]+\.\w+/g, '' );

            // Clean up punctuation
            cleaned = cleaned.replace( /[''`]/g, "'" );
            cleaned = cleaned.replace( /…/g, '...' );
            cleaned = cleaned.replace( /([.!?]){2,}/g, '$1' );
            cleaned = cleaned.replace( /([.!?,;:])([A-Za-z])/g, '$1 $2' );

            // Remove extra spaces
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
                    audioRef.current.playbackRate = speechableEditor?.options?.speed || 1.0;
                };
                audioRef.current.onended = () => setIsPlaying( false );
            }
        }, [ audioUrl ] );

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
            // Load Piper TTS library via local loader
            ttsModule = await loadPiperTTS();
            return ttsModule;
        };

        // Get Whisper model from settings
        const getWhisperModel = () => {
            return speechableEditor?.options?.whisper_model || 'Xenova/whisper-tiny.en';
        };

        // Check if Whisper is enabled
        const isWhisperEnabled = () => {
            return getWhisperModel() !== 'none';
        };

        // Load Whisper for accurate word-level timestamps
        const loadWhisper = async ( onProgress ) => {
            const modelId = getWhisperModel();
            
            if ( modelId === 'none' ) {
                return null;
            }
            
            if ( whisperPipeline ) return whisperPipeline;
            
            if ( onProgress ) onProgress( `Loading Whisper (${modelId.split('/')[1]})...` );
            
            whisperPipeline = await loadWhisperPipeline( modelId, ( progress ) => {
                if ( onProgress && progress.status === 'downloading' ) {
                    const pct = progress.progress ? Math.round( progress.progress ) : 0;
                    onProgress( `Downloading Whisper model... ${pct}%` );
                }
            } );
            
            return whisperPipeline;
        };

        // Extract word timestamps from audio using Whisper
        const extractWordTimestamps = async ( audioBlob, onProgress ) => {
            if ( ! isWhisperEnabled() ) {
                return null; // Whisper disabled, use estimation
            }
            
            try {
                const transcriber = await loadWhisper( onProgress );
                
                if ( ! transcriber ) {
                    return null;
                }
                
                if ( onProgress ) onProgress( 'Extracting word timestamps with Whisper...' );
                
                // Convert blob to array buffer for Whisper
                const arrayBuffer = await audioBlob.arrayBuffer();
                
                // Transcribe with word-level timestamps
                const result = await transcriber( arrayBuffer, { 
                    return_timestamps: 'word',
                    chunk_length_s: 30,
                    stride_length_s: 5
                } );
                
                // Convert Whisper output to our timing format
                // Whisper returns: { text, chunks: [{ text, timestamp: [start, end] }] }
                if ( result.chunks && result.chunks.length > 0 ) {
                    if ( onProgress ) onProgress( `Whisper extracted ${result.chunks.length} word timestamps` );
                    return result.chunks.map( ( chunk, index ) => ( {
                        word: chunk.text.trim(),
                        index: index,
                        start: chunk.timestamp[ 0 ] * 1000, // Convert to ms
                        end: chunk.timestamp[ 1 ] * 1000
                    } ) ).filter( t => t.word.length > 0 );
                }
                
                return null; // Fall back to estimation if Whisper fails
            } catch ( err ) {
                console.warn( 'Whisper timestamp extraction failed, using estimation:', err );
                if ( onProgress ) onProgress( 'Whisper failed, using estimated timestamps' );
                return null;
            }
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

        // Improved syllable estimator for better timing accuracy
        const estimateSyllables = ( word ) => {
            // Remove punctuation for syllable counting
            const cleanWord = word.replace( /[^a-zA-Z]/g, '' ).toLowerCase();
            if ( ! cleanWord ) return 1;
            
            // Count vowel groups (basic syllable estimation)
            const vowelGroups = cleanWord.match( /[aeiouy]+/g );
            let syllables = vowelGroups ? vowelGroups.length : 1;
            
            // Adjust for silent 'e' at end
            if ( cleanWord.endsWith( 'e' ) && syllables > 1 ) {
                syllables--;
            }
            
            // Adjust for common suffixes
            if ( cleanWord.endsWith( 'le' ) && cleanWord.length > 2 && ! /[aeiouy]/.test( cleanWord.charAt( cleanWord.length - 3 ) ) ) {
                syllables++;
            }
            
            return Math.max( 1, syllables );
        };

        // Estimate pause after word based on punctuation
        const estimatePauseAfter = ( word ) => {
            if ( /[.!?]$/.test( word ) ) return 200; // Sentence end
            if ( /[,;:]$/.test( word ) ) return 100; // Clause break
            if ( /-$/.test( word ) ) return 50; // Hyphen
            return 30; // Normal word gap
        };

        // Process a single chunk and return timing + audio data
        const processChunk = async ( tts, chunk, chunkStartTime, globalWordIndex, voiceId ) => {
            const words = chunk.split( /\s+/ ).filter( w => w.length > 0 );
            const timings = [];

            const wavBlob = await tts.predict( { text: chunk, voiceId } );
            const audioBuffer = await wavBlob.arrayBuffer();
            
            // Get duration directly from WAV header (much faster than Audio element)
            const chunkDuration = getWavDuration( audioBuffer );

            // Calculate total syllables and pauses
            const totalSyllables = words.reduce( ( sum, w ) => sum + estimateSyllables( w ), 0 );
            const totalPauseTime = words.reduce( ( sum, w ) => sum + estimatePauseAfter( w ), 0 );
            const speakingTime = Math.max( 0, chunkDuration - totalPauseTime );
            
            let currentOffset = chunkStartTime;
            let idx = globalWordIndex;

            words.forEach( ( word ) => {
                const syllables = estimateSyllables( word );
                const wordDuration = ( syllables / totalSyllables ) * speakingTime;
                const pauseAfter = estimatePauseAfter( word );
                
                timings.push( { 
                    word, 
                    index: idx++, 
                    start: currentOffset, 
                    end: currentOffset + wordDuration 
                } );
                currentOffset += wordDuration + pauseAfter;
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
                setProgress( 85 );

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

                // Apply audio effects (pitch shift, reverb) if configured
                const pitchShift = speechableEditor?.options?.pitch_shift || 0;
                const reverb = speechableEditor?.options?.reverb || 0;
                
                if ( pitchShift !== 0 || reverb > 0 ) {
                    setStatus( 'Applying audio effects...' );
                    setProgress( 87 );
                    
                    const processor = await loadAudioProcessor();
                    const combinedBuffer = await combined.arrayBuffer();
                    combined = await processor.process( combinedBuffer, {
                        pitchShift: pitchShift,
                        reverb: reverb
                    } );
                }

                if ( cancelRef.current ) throw new Error( 'Cancelled' );

                // Try to get accurate word timestamps using Whisper
                setStatus( 'Extracting word timestamps...' );
                setProgress( 90 );
                
                const whisperTimings = await extractWordTimestamps( combined, setStatus );
                
                // Use Whisper timings if available, otherwise keep estimated timings
                const finalTimings = whisperTimings || wordTimings;

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
                        word_timings: JSON.stringify( finalTimings ),
                    } ),
                } );

                editPost( {
                    meta: {
                        _speechable_audio: audioDataUrl,
                        _speechable_word_timings: JSON.stringify( finalTimings ),
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
