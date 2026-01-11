/**
 * Speechable - Post List Page
 *
 * @package Speechable
 */
( function( $ ) {
    'use strict';

    let ttsModule = null;
    let whisperPipeline = null;
    let audioProcessor = null;
    let currentModal = null;
    let currentAudio = null;
    let cancelGeneration = false;

    /**
     * Load the audio processor module.
     * 
     * @returns {Promise<Object>} The audio processor
     */
    async function loadAudioProcessor() {
        if ( audioProcessor ) {
            return audioProcessor;
        }
        const module = await import( speechableList.pluginUrl + 'assets/js/audio-processor.js' );
        audioProcessor = module.getAudioProcessor();
        return audioProcessor;
    }

    /**
     * Load the Piper TTS module via local loader.
     * 
     * @returns {Promise<Object>} The Piper TTS module
     */
    async function loadPiperTTS() {
        if ( ttsModule ) {
            return ttsModule;
        }
        const loader = await import( speechableList.pluginUrl + 'assets/js/vendor/piper-tts-loader.js' );
        ttsModule = await loader.loadPiperTTS();
        return ttsModule;
    }

    /**
     * Load the Whisper pipeline via local loader.
     * 
     * @param {string} modelId - The Whisper model ID
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} The Whisper pipeline
     */
    async function loadWhisperPipeline( modelId, onProgress ) {
        if ( whisperPipeline ) {
            return whisperPipeline;
        }
        const loader = await import( speechableList.pluginUrl + 'assets/js/vendor/whisper-loader.js' );
        whisperPipeline = await loader.loadWhisperPipeline( modelId, onProgress );
        return whisperPipeline;
    }

    const QUALITY_PRESETS = {
        low: { name: 'Low (Smaller file)', chunkSize: 1500, sampleRate: 16000 },
        medium: { name: 'Medium', chunkSize: 1000, sampleRate: 22050 },
        high: { name: 'High (Best quality)', chunkSize: 600, sampleRate: 22050 }
    };

    const LARGE_TEXT_THRESHOLD = 2000;

    // ============================================
    // TEXT CLEANER - Enhanced for natural TTS
    // ============================================
    const TextCleaner = {
        ABBREVIATIONS: {
            'Mr.': 'Mister', 'Mrs.': 'Missus', 'Ms.': 'Miss', 'Dr.': 'Doctor',
            'Prof.': 'Professor', 'Sr.': 'Senior', 'Jr.': 'Junior', 'vs.': 'versus',
            'etc.': 'etcetera', 'e.g.': 'for example', 'i.e.': 'that is',
            'St.': 'Saint', 'Mt.': 'Mount', 'Inc.': 'Incorporated', 'Ltd.': 'Limited',
            'Corp.': 'Corporation', 'Ave.': 'Avenue', 'Blvd.': 'Boulevard', 'Rd.': 'Road',
            'approx.': 'approximately', 'govt.': 'government', 'dept.': 'department',
            'est.': 'established', 'min.': 'minutes', 'max.': 'maximum', 'avg.': 'average',
            'no.': 'number', 'vol.': 'volume', 'Jan.': 'January', 'Feb.': 'February',
            'Mar.': 'March', 'Apr.': 'April', 'Jun.': 'June', 'Jul.': 'July',
            'Aug.': 'August', 'Sep.': 'September', 'Sept.': 'September', 'Oct.': 'October',
            'Nov.': 'November', 'Dec.': 'December'
        },
        ONES: [ '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen' ],
        TENS: [ '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety' ],
        SCALES: [ '', 'thousand', 'million', 'billion', 'trillion' ],
        numberToWords( num ) {
            if ( num === 0 ) return 'zero';
            if ( num < 0 ) return 'negative ' + this.numberToWords( -num );
            if ( ! Number.isInteger( num ) ) {
                const parts = num.toString().split( '.' );
                return this.numberToWords( parseInt( parts[ 0 ], 10 ) ) + ' point ' + parts[ 1 ].split( '' ).map( d => this.ONES[ parseInt( d, 10 ) ] || d ).join( ' ' );
            }
            let words = '', scaleIndex = 0;
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
            if ( num < 100 ) return this.TENS[ Math.floor( num / 10 ) ] + ( num % 10 ? ' ' + this.ONES[ num % 10 ] : '' );
            return this.ONES[ Math.floor( num / 100 ) ] + ' hundred' + ( num % 100 ? ' ' + this.chunkToWords( num % 100 ) : '' );
        },
        ordinalToWords( num ) {
            const ordinals = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth', 11: 'eleventh', 12: 'twelfth' };
            if ( ordinals[ num ] ) return ordinals[ num ];
            const word = this.numberToWords( num );
            if ( word.endsWith( 'y' ) ) return word.slice( 0, -1 ) + 'ieth';
            if ( word.endsWith( 'e' ) ) return word + 'th';
            return word + 'th';
        },
        clean( text ) {
            if ( ! text ) return '';
            let cleaned = text;
            cleaned = cleaned.replace( /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]/gu, '' );
            cleaned = cleaned.replace( /\s+/g, ' ' ).trim();
            for ( const [ abbr, full ] of Object.entries( this.ABBREVIATIONS ) ) {
                cleaned = cleaned.replace( new RegExp( '\\b' + abbr.replace( '.', '\\.' ), 'gi' ), full );
            }
            cleaned = cleaned.replace( /\b\/\b/g, ' slash ' );
            cleaned = cleaned.replace( /[\/\\()¯\[\]{}]/g, '' );
            cleaned = cleaned.replace( /["""„«»]/g, '' );
            cleaned = cleaned.replace( /\s[—–]\s/g, ', ' );
            // Convert times
            cleaned = cleaned.replace( /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/g, ( _, h, m, ampm ) => {
                const hour = this.numberToWords( parseInt( h, 10 ) );
                const min = m === '00' ? '' : ( m.startsWith( '0' ) ? 'oh ' + this.numberToWords( parseInt( m, 10 ) ) : this.numberToWords( parseInt( m, 10 ) ) );
                return hour + ( min ? ' ' + min : '' ) + ( ampm ? ' ' + ampm : '' );
            } );
            // Convert years
            cleaned = cleaned.replace( /\b(19|20)(\d{2})\b/g, ( _, century, year ) => {
                const c = parseInt( century, 10 ), y = parseInt( year, 10 );
                if ( y === 0 ) return this.numberToWords( c * 100 );
                if ( y < 10 ) return this.numberToWords( c ) + ' oh ' + this.numberToWords( y );
                return this.numberToWords( c ) + ' ' + this.numberToWords( y );
            } );
            // Convert ordinals
            cleaned = cleaned.replace( /(\d+)(st|nd|rd|th)\b/gi, ( _, num ) => this.ordinalToWords( parseInt( num, 10 ) ) );
            // Convert currency
            cleaned = cleaned.replace( /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g, ( _, num ) => {
                const amount = parseFloat( num.replace( /,/g, '' ) );
                const dollars = Math.floor( amount ), cents = Math.round( ( amount - dollars ) * 100 );
                let result = this.numberToWords( dollars ) + ' dollar' + ( dollars !== 1 ? 's' : '' );
                if ( cents > 0 ) result += ' and ' + this.numberToWords( cents ) + ' cent' + ( cents !== 1 ? 's' : '' );
                return result;
            } );
            cleaned = cleaned.replace( /€(\d+(?:,\d{3})*(?:\.\d{2})?)/g, ( _, num ) => this.numberToWords( Math.floor( parseFloat( num.replace( /,/g, '' ) ) ) ) + ' euros' );
            cleaned = cleaned.replace( /£(\d+(?:,\d{3})*(?:\.\d{2})?)/g, ( _, num ) => this.numberToWords( Math.floor( parseFloat( num.replace( /,/g, '' ) ) ) ) + ' pounds' );
            cleaned = cleaned.replace( /(\d+(?:\.\d+)?)\s*%/g, ( _, num ) => {
                const n = parseFloat( num );
                return ( Number.isInteger( n ) ? this.numberToWords( n ) : num ) + ' percent';
            } );
            // Convert standalone numbers
            cleaned = cleaned.replace( /(?<![a-zA-Z0-9])(\d{1,4})(?![a-zA-Z0-9])/g, ( _, num ) => {
                const n = parseInt( num, 10 );
                return n <= 9999 ? this.numberToWords( n ) : num;
            } );
            cleaned = cleaned.replace( /(\d{1,3}(?:,\d{3})+)/g, ( _, num ) => this.numberToWords( parseInt( num.replace( /,/g, '' ), 10 ) ) );
            cleaned = cleaned.replace( /&/g, ' and ' ).replace( /@/g, ' at ' ).replace( /\+/g, ' plus ' ).replace( /=/g, ' equals ' );
            cleaned = cleaned.replace( /#(\w+)/g, 'hashtag $1' );
            cleaned = cleaned.replace( /(\d+)\s*x\s*(\d+)/gi, '$1 by $2' );
            cleaned = cleaned.replace( /https?:\/\/[^\s]+/g, '' );
            cleaned = cleaned.replace( /[\w.-]+@[\w.-]+\.\w+/g, '' );
            cleaned = cleaned.replace( /[''`]/g, "'" );
            cleaned = cleaned.replace( /…/g, '...' );
            cleaned = cleaned.replace( /([.!?]){2,}/g, '$1' );
            cleaned = cleaned.replace( /([.!?,;:])([A-Za-z])/g, '$1 $2' );
            return cleaned.replace( /\s+/g, ' ' ).trim();
        }
    };

    // ============================================
    // TEXT CHUNKER - From piper-tts-web-demo
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
                const processedLine = /[.!?]$/.test( line.trim() ) ? line : line.trim() + '.';
                const sentences = processedLine.split( /(?<=[.!?])(?=\s+|$)/ );
                let currentChunk = '';
                for ( const sentence of sentences ) {
                    const trimmed = sentence.trim();
                    if ( ! trimmed ) continue;
                    if ( trimmed.length > MAX_LEN ) {
                        if ( currentChunk ) { chunks.push( currentChunk ); currentChunk = ''; }
                        const words = trimmed.split( ' ' );
                        let longChunk = '';
                        for ( const word of words ) {
                            const potential = longChunk + ( longChunk ? ' ' : '' ) + word;
                            if ( potential.length <= MAX_LEN ) { longChunk = potential; }
                            else { if ( longChunk ) chunks.push( longChunk ); longChunk = word; }
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
                if ( currentChunk ) chunks.push( currentChunk );
            }
            return chunks.filter( c => c.length >= this.MIN_CHUNK_LENGTH );
        }
    };

    // Cache for audio status to avoid repeated AJAX calls
    const audioStatusCache = {};

    function init() {
        // Add buttons immediately without waiting for AJAX
        const buttons = [];
        const postIds = [];
        
        $( '.row-actions' ).each( function() {
            const $row = $( this ).closest( 'tr' );
            const postId = $row.attr( 'id' )?.replace( 'post-', '' );
            if ( ! postId ) return;

            const $btn = $( '<button>', {
                class: 'speechable-gen-btn',
                'data-post-id': postId,
                html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg> Audio',
            } );

            $( this ).append( ' | ' ).append( $btn );
            buttons.push( { postId, $btn } );
            postIds.push( postId );
        } );

        // Check audio status in one batch request (much faster)
        if ( postIds.length > 0 ) {
            checkAudioBatch( postIds, buttons );
        }
    }

    // Check audio status for all posts in one request
    async function checkAudioBatch( postIds, buttons ) {
        try {
            const res = await $.post( speechableList.ajaxUrl, {
                action: 'speechable_check_audio_batch',
                nonce: speechableList.nonce,
                post_ids: postIds,
            } );

            if ( res.success && res.data.statuses ) {
                const statuses = res.data.statuses;
                
                buttons.forEach( ( { postId, $btn } ) => {
                    audioStatusCache[ postId ] = !! statuses[ postId ];
                    
                    if ( statuses[ postId ] ) {
                        $btn.addClass( 'has-audio' ).html( '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Audio' );
                    }
                } );
            }
        } catch ( e ) {
            // Fallback to individual checks if batch fails
            buttons.forEach( ( { postId, $btn } ) => checkAudio( postId, $btn ) );
        }
    }

    async function checkAudio( postId, $btn ) {
        // Check cache first
        if ( audioStatusCache[ postId ] !== undefined ) {
            if ( audioStatusCache[ postId ] ) {
                $btn.addClass( 'has-audio' ).html( '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Audio' );
            }
            return;
        }

        try {
            const res = await $.post( speechableList.ajaxUrl, {
                action: 'speechable_get_post_content',
                nonce: speechableList.nonce,
                post_id: postId,
            } );
            
            // Cache the result
            audioStatusCache[ postId ] = res.success && res.data.hasAudio;
            
            if ( audioStatusCache[ postId ] ) {
                $btn.addClass( 'has-audio' ).html( '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Audio' );
            }
        } catch ( e ) { /* ignore */ }
    }

    function createModal( postId, postTitle, wordCount ) {
        const languages = speechableList.languages || {};
        const voices = speechableList.voices || {};
        const defaultVoice = speechableList.options?.voice || 'en_US-hfc_female-medium';
        const defaultLang = speechableList.options?.language || voices[ defaultVoice ]?.lang || 'en';
        const defaultQuality = speechableList.options?.quality || 'medium';

        // Helper function to escape HTML entities
        const escapeHtml = ( str ) => {
            const div = document.createElement( 'div' );
            div.textContent = str;
            return div.innerHTML;
        };

        const langOpts = Object.entries( languages ).map( ( [ code, name ] ) =>
            `<option value="${ escapeHtml( code ) }" ${ code === defaultLang ? 'selected' : '' }>${ escapeHtml( name ) }</option>`
        ).join( '' );

        const voiceOpts = Object.entries( voices )
            .filter( ( [ , v ] ) => v.lang === defaultLang )
            .map( ( [ id, v ] ) => `<option value="${ escapeHtml( id ) }" ${ id === defaultVoice ? 'selected' : '' }>${ escapeHtml( v.name ) }</option>` )
            .join( '' );

        const qualityOpts = Object.entries( QUALITY_PRESETS ).map( ( [ key, val ] ) =>
            `<option value="${ escapeHtml( key ) }" ${ key === defaultQuality ? 'selected' : '' }>${ escapeHtml( val.name ) }</option>`
        ).join( '' );

        // Estimate time
        const estSeconds = Math.ceil( ( wordCount / 150 ) * 60 + ( wordCount / 10 ) );
        const estTime = estSeconds < 60 ? `~${estSeconds}s` : `~${Math.floor(estSeconds/60)}m ${estSeconds%60}s`;
        const isLargeText = wordCount > LARGE_TEXT_THRESHOLD;

        // Escape the post title to prevent XSS
        const safePostTitle = escapeHtml( postTitle );

        return `
            <div class="speechable-modal-overlay" id="speechable-modal">
                <div class="speechable-modal">
                    <div class="speechable-modal-header">
                        <h3>Generate Audio</h3>
                        <button class="speechable-modal-close" type="button">&times;</button>
                    </div>
                    <div class="speechable-modal-body">
                        <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">${ safePostTitle }</p>
                        
                        <div class="speechable-info-row" style="display:flex;justify-content:space-between;padding:8px 12px;background:#f9fafb;border-radius:6px;margin-bottom:16px;font-size:12px;color:#6b7280;">
                            <span>${ wordCount } words</span>
                            <span>Est. time: ${ estTime }</span>
                        </div>
                        
                        ${ isLargeText ? '<div class="speechable-large-warning" style="padding:8px 12px;background:#fefce8;border:1px solid #fef08a;border-radius:6px;margin-bottom:16px;color:#a16207;font-size:12px;">⚠ Large content. Generation may take several minutes.</div>' : '' }
                        
                        <div class="speechable-field">
                            <label>Language</label>
                            <select id="speechable-lang">${ langOpts }</select>
                        </div>
                        <div class="speechable-field">
                            <label>Voice</label>
                            <select id="speechable-voice">${ voiceOpts }</select>
                        </div>
                        <div class="speechable-field">
                            <label>Quality</label>
                            <select id="speechable-quality">${ qualityOpts }</select>
                        </div>
                        <div class="speechable-progress-container" style="display:none;">
                            <div class="speechable-progress-outer"><div class="speechable-progress-inner"></div></div>
                            <div class="speechable-status"></div>
                        </div>
                        <div class="speechable-preview-player" style="display:none;">
                            <button class="speechable-preview-play" type="button">▶</button>
                            <div class="speechable-preview-progress"><div class="speechable-preview-progress-fill"></div></div>
                            <span class="speechable-preview-time">0:00 / 0:00</span>
                        </div>
                        <div class="speechable-error" style="display:none;"></div>
                    </div>
                    <div class="speechable-modal-footer">
                        <button class="speechable-btn speechable-btn-danger speechable-delete-btn" type="button" style="display:none;margin-right:auto;">Delete</button>
                        <button class="speechable-btn speechable-btn-secondary speechable-cancel-btn" type="button">Cancel</button>
                        <button class="speechable-btn speechable-btn-primary speechable-generate-btn" type="button">Generate</button>
                    </div>
                </div>
            </div>
        `;
    }

    function openModal( postId ) {
        // Show loading modal immediately for better UX
        const loadingModal = `
            <div class="speechable-modal-overlay" id="speechable-modal">
                <div class="speechable-modal">
                    <div class="speechable-modal-header">
                        <h3>Generate Audio</h3>
                        <button class="speechable-modal-close" type="button">&times;</button>
                    </div>
                    <div class="speechable-modal-body" style="text-align:center;padding:40px;">
                        <div class="speechable-loading-spinner"></div>
                        <p style="margin:16px 0 0;color:#6b7280;">Loading post content...</p>
                    </div>
                </div>
            </div>
        `;
        $( 'body' ).append( loadingModal );
        $( '.speechable-modal-close' ).on( 'click', closeModal );
        $( '.speechable-modal-overlay' ).on( 'click', function( e ) {
            if ( e.target === this ) closeModal();
        } );

        // Load content in background
        $.post( speechableList.ajaxUrl, {
            action: 'speechable_get_post_content',
            nonce: speechableList.nonce,
            post_id: postId,
        } ).done( function( res ) {
            if ( ! res.success ) {
                closeModal();
                alert( 'Failed to load post.' );
                return;
            }

            const { content, title, hasAudio } = res.data;
            const wordCount = content.split( /\s+/ ).length;
            
            // Replace loading modal with full modal
            $( '#speechable-modal' ).remove();
            $( 'body' ).append( createModal( postId, title, wordCount ) );
            currentModal = { postId, content, hasAudio };

            if ( hasAudio ) {
                $( '.speechable-delete-btn' ).show();
                $( '.speechable-generate-btn' ).text( 'Regenerate' );
            }

            $( '#speechable-lang' ).on( 'change', function() {
                const lang = $( this ).val();
                // Helper function to escape HTML entities
                const escapeHtml = ( str ) => {
                    const div = document.createElement( 'div' );
                    div.textContent = str;
                    return div.innerHTML;
                };
                const opts = Object.entries( speechableList.voices )
                    .filter( ( [ , v ] ) => v.lang === lang )
                    .map( ( [ id, v ] ) => `<option value="${ escapeHtml( id ) }">${ escapeHtml( v.name ) }</option>` )
                    .join( '' );
                $( '#speechable-voice' ).html( opts );
            } );

            $( '.speechable-modal-close, .speechable-cancel-btn' ).on( 'click', closeModal );
            $( '.speechable-modal-overlay' ).on( 'click', function( e ) {
                if ( e.target === this ) closeModal();
            } );
            $( '.speechable-generate-btn' ).on( 'click', generate );
            $( '.speechable-delete-btn' ).on( 'click', deleteAudio );
        } ).fail( function() {
            closeModal();
            alert( 'Failed to load post.' );
        } );
    }

    function closeModal() {
        if ( currentAudio ) {
            currentAudio.pause();
            currentAudio = null;
        }
        $( '#speechable-modal' ).remove();
        currentModal = null;
    }

    async function loadTTS() {
        if ( ttsModule ) return ttsModule;
        // Load Piper TTS library via local loader
        ttsModule = await loadPiperTTS();
        return ttsModule;
    }

    // Get Whisper model from settings
    function getWhisperModel() {
        return speechableList?.options?.whisper_model || 'Xenova/whisper-tiny.en';
    }

    // Check if Whisper is enabled
    function isWhisperEnabled() {
        return getWhisperModel() !== 'none';
    }

    // Load Whisper for accurate word-level timestamps
    async function loadWhisper( setStatus ) {
        const modelId = getWhisperModel();
        
        if ( modelId === 'none' ) {
            return null;
        }
        
        if ( whisperPipeline ) return whisperPipeline;
        
        if ( setStatus ) setStatus( `Loading Whisper (${modelId.split('/')[1]})...` );
        
        whisperPipeline = await loadWhisperPipeline( modelId, ( progress ) => {
            if ( setStatus && progress.status === 'downloading' ) {
                const pct = progress.progress ? Math.round( progress.progress ) : 0;
                setStatus( `Downloading Whisper model... ${pct}%` );
            }
        } );
        
        return whisperPipeline;
    }

    // Extract word timestamps from audio using Whisper
    async function extractWordTimestamps( audioBlob, setStatus ) {
        if ( ! isWhisperEnabled() ) {
            return null; // Whisper disabled, use estimation
        }
        
        try {
            const transcriber = await loadWhisper( setStatus );
            
            if ( ! transcriber ) {
                return null;
            }
            
            if ( setStatus ) setStatus( 'Extracting word timestamps with Whisper...' );
            
            // Convert blob to array buffer for Whisper
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            // Transcribe with word-level timestamps
            const result = await transcriber( arrayBuffer, { 
                return_timestamps: 'word',
                chunk_length_s: 30,
                stride_length_s: 5
            } );
            
            // Convert Whisper output to our timing format
            if ( result.chunks && result.chunks.length > 0 ) {
                if ( setStatus ) setStatus( `Whisper extracted ${result.chunks.length} word timestamps` );
                return result.chunks.map( ( chunk, index ) => ( {
                    word: chunk.text.trim(),
                    index: index,
                    start: chunk.timestamp[ 0 ] * 1000, // Convert to ms
                    end: chunk.timestamp[ 1 ] * 1000
                } ) ).filter( t => t.word.length > 0 );
            }
            
            return null;
        } catch ( err ) {
            console.warn( 'Whisper timestamp extraction failed, using estimation:', err );
            if ( setStatus ) setStatus( 'Whisper failed, using estimated timestamps' );
            return null;
        }
    }

    function splitIntoChunks( text, maxSize ) {
        return TextChunker.chunk( TextCleaner.clean( text ), maxSize );
    }

    async function generate() {
        if ( ! currentModal ) return;

        const { postId, content } = currentModal;
        const voice = $( '#speechable-voice' ).val();
        const quality = $( '#speechable-quality' ).val();

        if ( ! content ) {
            $( '.speechable-error' ).text( 'No content.' ).show();
            return;
        }

        cancelGeneration = false;
        $( '.speechable-generate-btn' ).prop( 'disabled', true ).text( 'Generating...' );
        $( '.speechable-cancel-btn' ).text( 'Cancel Generation' ).off( 'click' ).on( 'click', function() {
            cancelGeneration = true;
            $( '.speechable-status' ).text( 'Cancelling...' );
        } );
        $( '.speechable-progress-container' ).show();
        $( '.speechable-error' ).hide();

        const setProgress = ( p ) => $( '.speechable-progress-inner' ).css( 'width', p + '%' );
        const setStatus = ( t ) => $( '.speechable-status' ).text( t );

        try {
            const tts = await loadTTS();

            setStatus( 'Downloading voice...' );
            setProgress( 5 );

            await tts.download( voice, ( prog ) => {
                if ( prog.total ) setProgress( 5 + Math.round( ( prog.loaded / prog.total ) * 10 ) );
            } );

            if ( cancelGeneration ) throw new Error( 'Cancelled' );

            setStatus( 'Processing text...' );
            setProgress( 15 );

            const chunkSize = QUALITY_PRESETS[ quality ].chunkSize;
            const chunks = splitIntoChunks( content, chunkSize );
            const totalChunks = chunks.length;
            const wordTimings = [];
            const audioChunks = [];
            let totalDuration = 0;
            let globalWordIndex = 0;

            setStatus( `Generating audio (${totalChunks} chunks)...` );

            // Get WAV duration from header (avoids creating Audio element)
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

            // Process chunk helper
            const processChunk = async ( chunk ) => {
                const words = chunk.split( /\s+/ ).filter( w => w.length > 0 );
                const wav = await tts.predict( { text: chunk, voiceId: voice } );
                const audioBuffer = await wav.arrayBuffer();
                const dur = getWavDuration( audioBuffer );
                
                // Calculate total syllables and pauses
                const totalSyllables = words.reduce( ( sum, w ) => sum + estimateSyllables( w ), 0 );
                const totalPauseTime = words.reduce( ( sum, w ) => sum + estimatePauseAfter( w ), 0 );
                const speakingTime = Math.max( 0, dur - totalPauseTime );
                
                const timings = [];
                let offset = 0;
                words.forEach( ( word, idx ) => {
                    const syllables = estimateSyllables( word );
                    const wordDur = ( syllables / totalSyllables ) * speakingTime;
                    const pauseAfter = estimatePauseAfter( word );
                    timings.push( { word, index: idx, start: offset, end: offset + wordDur } );
                    offset += wordDur + pauseAfter;
                } );
                
                return { audioBuffer, timings, duration: dur, wordCount: words.length };
            };

            // Process chunks with parallelism
            const PARALLEL_CHUNKS = 3;
            
            for ( let i = 0; i < chunks.length; i += PARALLEL_CHUNKS ) {
                if ( cancelGeneration ) throw new Error( 'Cancelled' );

                const batchEnd = Math.min( i + PARALLEL_CHUNKS, chunks.length );
                const batchChunks = chunks.slice( i, batchEnd );
                
                // Process batch in parallel
                const batchResults = await Promise.all( 
                    batchChunks.map( chunk => processChunk( chunk ) )
                );
                
                // Add results with correct timings
                for ( const result of batchResults ) {
                    const correctedTimings = result.timings.map( t => ( {
                        ...t,
                        index: globalWordIndex + t.index,
                        start: totalDuration + t.start,
                        end: totalDuration + t.end
                    } ) );
                    
                    wordTimings.push( ...correctedTimings );
                    audioChunks.push( result.audioBuffer );
                    totalDuration += result.duration;
                    globalWordIndex += result.wordCount;
                }

                setProgress( 15 + Math.round( ( batchEnd / totalChunks ) * 70 ) );
                setStatus( `Processing ${ batchEnd }/${ totalChunks }...` );
            }

            if ( cancelGeneration ) throw new Error( 'Cancelled' );

            setStatus( 'Combining...' );
            setProgress( 85 );

            let combined = await combineWav( audioChunks );
            audioChunks.length = 0; // Free memory

            if ( cancelGeneration ) throw new Error( 'Cancelled' );

            // Apply audio effects (pitch shift, reverb) if configured
            const pitchShift = speechableList?.options?.pitch_shift || 0;
            const reverb = speechableList?.options?.reverb || 0;
            
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

            if ( cancelGeneration ) throw new Error( 'Cancelled' );

            // Try to get accurate word timestamps using Whisper
            setStatus( 'Extracting word timestamps...' );
            setProgress( 90 );
            
            const whisperTimings = await extractWordTimestamps( combined, setStatus );
            
            // Use Whisper timings if available, otherwise keep estimated timings
            const finalTimings = whisperTimings || wordTimings;

            if ( cancelGeneration ) throw new Error( 'Cancelled' );

            setStatus( 'Saving...' );
            setProgress( 95 );

            const dataUrl = await new Promise( ( resolve, reject ) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve( reader.result );
                reader.onerror = reject;
                reader.readAsDataURL( combined );
            } );

            await $.post( speechableList.ajaxUrl, {
                action: 'speechable_save_audio',
                nonce: speechableList.nonce,
                post_id: postId,
                audio_data: dataUrl,
                word_timings: JSON.stringify( finalTimings ),
            } );

            setProgress( 100 );
            setStatus( 'Done!' );

            showPreview( dataUrl );

            $( `.speechable-gen-btn[data-post-id="${ postId }"]` )
                .addClass( 'has-audio' )
                .html( '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Audio' );

            $( '.speechable-generate-btn' ).prop( 'disabled', false ).text( 'Regenerate' );
            $( '.speechable-cancel-btn' ).text( 'Close' ).off( 'click' ).on( 'click', closeModal );
            $( '.speechable-delete-btn' ).show();
            currentModal.hasAudio = true;
        } catch ( err ) {
            if ( err.message === 'Cancelled' ) {
                setStatus( 'Cancelled' );
                $( '.speechable-progress-container' ).hide();
            } else {
                $( '.speechable-error' ).text( err.message ).show();
            }
            $( '.speechable-generate-btn' ).prop( 'disabled', false ).text( 'Generate' );
            $( '.speechable-cancel-btn' ).text( 'Cancel' ).off( 'click' ).on( 'click', closeModal );
        }
    }

    async function combineWav( chunks ) {
        if ( chunks.length === 1 ) return new Blob( [ chunks[ 0 ] ], { type: 'audio/wav' } );

        let totalData = 0, sampleRate = 22050, numChannels = 1, bitsPerSample = 16;
        const pcm = [];

        for ( const chunk of chunks ) {
            const view = new DataView( chunk );
            sampleRate = view.getUint32( 24, true );
            numChannels = view.getUint16( 22, true );
            bitsPerSample = view.getUint16( 34, true );

            let offset = 12;
            while ( offset < chunk.byteLength - 8 ) {
                const id = String.fromCharCode( view.getUint8( offset ), view.getUint8( offset + 1 ), view.getUint8( offset + 2 ), view.getUint8( offset + 3 ) );
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
    }

    function showPreview( dataUrl ) {
        $( '.speechable-preview-player' ).show();
        currentAudio = new Audio( dataUrl );
        
        // Set playback speed from settings
        const defaultSpeed = speechableList?.options?.speed || 1;
        currentAudio.playbackRate = defaultSpeed;

        currentAudio.onloadedmetadata = updateTime;
        currentAudio.ontimeupdate = function() {
            $( '.speechable-preview-progress-fill' ).css( 'width', ( currentAudio.currentTime / currentAudio.duration ) * 100 + '%' );
            updateTime();
        };
        currentAudio.onended = function() { $( '.speechable-preview-play' ).text( '▶' ); };

        $( '.speechable-preview-play' ).off( 'click' ).on( 'click', function() {
            if ( currentAudio.paused ) {
                currentAudio.play();
                $( this ).text( '❚❚' );
            } else {
                currentAudio.pause();
                $( this ).text( '▶' );
            }
        } );

        $( '.speechable-preview-progress' ).off( 'click' ).on( 'click', function( e ) {
            const rect = this.getBoundingClientRect();
            currentAudio.currentTime = ( ( e.clientX - rect.left ) / rect.width ) * currentAudio.duration;
        } );
    }

    function updateTime() {
        if ( ! currentAudio ) return;
        const fmt = ( s ) => Math.floor( s / 60 ) + ':' + Math.floor( s % 60 ).toString().padStart( 2, '0' );
        $( '.speechable-preview-time' ).text( fmt( currentAudio.currentTime ) + ' / ' + fmt( currentAudio.duration || 0 ) );
    }

    async function deleteAudio() {
        if ( ! currentModal || ! confirm( 'Delete audio?' ) ) return;

        await $.post( speechableList.ajaxUrl, {
            action: 'speechable_delete_audio',
            nonce: speechableList.nonce,
            post_id: currentModal.postId,
        } );

        $( `.speechable-gen-btn[data-post-id="${ currentModal.postId }"]` )
            .removeClass( 'has-audio' )
            .html( '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg> Audio' );

        closeModal();
    }

    $( document ).on( 'click', '.speechable-gen-btn', function( e ) {
        e.preventDefault();
        openModal( $( this ).data( 'post-id' ) );
    } );

    $( document ).ready( init );
} )( jQuery );
