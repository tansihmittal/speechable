/**
 * Speechable - Post List Page
 *
 * @package Speechable
 */
( function( $ ) {
    'use strict';

    let ttsModule = null;
    let currentModal = null;
    let currentAudio = null;
    let cancelGeneration = false;

    const QUALITY_PRESETS = {
        low: { name: 'Low (Smaller file)', chunkSize: 1500, sampleRate: 16000 },
        medium: { name: 'Medium', chunkSize: 1000, sampleRate: 22050 },
        high: { name: 'High (Best quality)', chunkSize: 600, sampleRate: 22050 }
    };

    const LARGE_TEXT_THRESHOLD = 2000;

    // ============================================
    // TEXT CLEANER - From piper-tts-web-demo
    // ============================================
    const TextCleaner = {
        ABBREVIATIONS: {
            'Mr.': 'Mister', 'Mrs.': 'Missus', 'Ms.': 'Miss', 'Dr.': 'Doctor',
            'Prof.': 'Professor', 'Sr.': 'Senior', 'Jr.': 'Junior', 'vs.': 'versus',
            'etc.': 'etcetera', 'e.g.': 'for example', 'i.e.': 'that is',
            'St.': 'Saint', 'Mt.': 'Mount', 'Inc.': 'Incorporated', 'Ltd.': 'Limited',
            'Corp.': 'Corporation', 'Ave.': 'Avenue', 'Blvd.': 'Boulevard', 'Rd.': 'Road'
        },
        clean( text ) {
            if ( ! text ) return '';
            let cleaned = text;
            // Remove emojis
            cleaned = cleaned.replace( /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]/gu, '' );
            cleaned = cleaned.replace( /\s+/g, ' ' ).trim();
            for ( const [ abbr, full ] of Object.entries( this.ABBREVIATIONS ) ) {
                cleaned = cleaned.replace( new RegExp( abbr.replace( '.', '\\.' ), 'gi' ), full );
            }
            // Handle special characters
            cleaned = cleaned.replace( /\b\/\b/g, ' slash ' );
            cleaned = cleaned.replace( /[\/\\()¯]/g, '' );
            cleaned = cleaned.replace( /["""]/g, '' );
            cleaned = cleaned.replace( /\s—/g, '. ' );
            cleaned = cleaned.replace( /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g, ( _, num ) => num.replace( /,/g, '' ) + ' dollars' );
            cleaned = cleaned.replace( /(\d+)%/g, '$1 percent' );
            cleaned = cleaned.replace( /&/g, ' and ' ).replace( /@/g, ' at ' );
            cleaned = cleaned.replace( /https?:\/\/[^\s]+/g, '' );
            cleaned = cleaned.replace( /[\w.-]+@[\w.-]+\.\w+/g, '' );
            cleaned = cleaned.replace( /['']/g, "'" );
            cleaned = cleaned.replace( /…/g, '...' ).replace( /[—–]/g, ', ' );
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

    function init() {
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
            checkAudio( postId, $btn );
        } );
    }

    async function checkAudio( postId, $btn ) {
        try {
            const res = await $.post( speechableList.ajaxUrl, {
                action: 'speechable_get_post_content',
                nonce: speechableList.nonce,
                post_id: postId,
            } );
            if ( res.success && res.data.hasAudio ) {
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

        const langOpts = Object.entries( languages ).map( ( [ code, name ] ) =>
            `<option value="${ code }" ${ code === defaultLang ? 'selected' : '' }>${ name }</option>`
        ).join( '' );

        const voiceOpts = Object.entries( voices )
            .filter( ( [ , v ] ) => v.lang === defaultLang )
            .map( ( [ id, v ] ) => `<option value="${ id }" ${ id === defaultVoice ? 'selected' : '' }>${ v.name }</option>` )
            .join( '' );

        const qualityOpts = Object.entries( QUALITY_PRESETS ).map( ( [ key, val ] ) =>
            `<option value="${ key }" ${ key === defaultQuality ? 'selected' : '' }>${ val.name }</option>`
        ).join( '' );

        const defaultSpeed = speechableList.options?.speed || 1;
        const speedOpts = [
            { value: 0.5, label: '0.5x (Slow)' },
            { value: 0.75, label: '0.75x' },
            { value: 1.0, label: '1x (Normal)' },
            { value: 1.25, label: '1.25x' },
            { value: 1.5, label: '1.5x' },
            { value: 1.75, label: '1.75x' },
            { value: 2.0, label: '2x (Fast)' }
        ].map( o => `<option value="${ o.value }" ${ o.value === defaultSpeed ? 'selected' : '' }>${ o.label }</option>` ).join( '' );

        // Estimate time
        const estSeconds = Math.ceil( ( wordCount / 150 ) * 60 + ( wordCount / 10 ) );
        const estTime = estSeconds < 60 ? `~${estSeconds}s` : `~${Math.floor(estSeconds/60)}m ${estSeconds%60}s`;
        const isLargeText = wordCount > LARGE_TEXT_THRESHOLD;

        return `
            <div class="speechable-modal-overlay" id="speechable-modal">
                <div class="speechable-modal">
                    <div class="speechable-modal-header">
                        <h3>Generate Audio</h3>
                        <button class="speechable-modal-close" type="button">&times;</button>
                    </div>
                    <div class="speechable-modal-body">
                        <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">${ postTitle }</p>
                        
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
                        <div class="speechable-field">
                            <label>Playback Speed</label>
                            <select id="speechable-speed">${ speedOpts }</select>
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
        $.post( speechableList.ajaxUrl, {
            action: 'speechable_get_post_content',
            nonce: speechableList.nonce,
            post_id: postId,
        } ).done( function( res ) {
            if ( ! res.success ) {
                alert( 'Failed to load post.' );
                return;
            }

            const { content, title, hasAudio } = res.data;
            const wordCount = content.split( /\s+/ ).length;
            
            $( 'body' ).append( createModal( postId, title, wordCount ) );
            currentModal = { postId, content, hasAudio };

            if ( hasAudio ) {
                $( '.speechable-delete-btn' ).show();
                $( '.speechable-generate-btn' ).text( 'Regenerate' );
            }

            $( '#speechable-lang' ).on( 'change', function() {
                const lang = $( this ).val();
                const opts = Object.entries( speechableList.voices )
                    .filter( ( [ , v ] ) => v.lang === lang )
                    .map( ( [ id, v ] ) => `<option value="${ id }">${ v.name }</option>` )
                    .join( '' );
                $( '#speechable-voice' ).html( opts );
            } );

            $( '.speechable-modal-close, .speechable-cancel-btn' ).on( 'click', closeModal );
            $( '.speechable-modal-overlay' ).on( 'click', function( e ) {
                if ( e.target === this ) closeModal();
            } );
            $( '.speechable-generate-btn' ).on( 'click', generate );
            $( '.speechable-delete-btn' ).on( 'click', deleteAudio );
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
        ttsModule = await import( 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/+esm' );
        return ttsModule;
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

            const estimateSyllables = ( word ) => {
                const vowels = word.toLowerCase().match( /[aeiouy]+/g );
                return vowels ? Math.max( 1, vowels.length ) : 1;
            };

            // Process chunk helper
            const processChunk = async ( chunk ) => {
                const words = chunk.split( /\s+/ ).filter( w => w.length > 0 );
                const wav = await tts.predict( { text: chunk, voiceId: voice } );
                const audioBuffer = await wav.arrayBuffer();
                const dur = getWavDuration( audioBuffer );
                
                const totalSyllables = words.reduce( ( sum, w ) => sum + estimateSyllables( w ), 0 );
                const pauseTime = 50;
                const speakingTime = dur - ( words.length * pauseTime );
                
                const timings = [];
                let offset = 0;
                words.forEach( ( word, idx ) => {
                    const syllables = estimateSyllables( word );
                    const wordDur = ( syllables / totalSyllables ) * speakingTime;
                    timings.push( { word, index: idx, start: offset, end: offset + wordDur } );
                    offset += wordDur + pauseTime;
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
            setProgress( 88 );

            const combined = await combineWav( audioChunks );
            audioChunks.length = 0; // Free memory

            if ( cancelGeneration ) throw new Error( 'Cancelled' );

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
                word_timings: JSON.stringify( wordTimings ),
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
        
        // Set playback speed from selector
        const selectedSpeed = parseFloat( $( '#speechable-speed' ).val() ) || 1;
        currentAudio.playbackRate = selectedSpeed;

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
