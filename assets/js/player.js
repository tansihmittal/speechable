/**
 * Speechable Frontend Player
 *
 * @package Speechable
 */
( function() {
    'use strict';

    document.querySelectorAll( '.speechable-player' ).forEach( initPlayer );

    function initPlayer( player ) {
        const audioData = player.dataset.audio;
        const timingsData = player.dataset.timings;
        const highlighting = player.dataset.highlighting === 'true';
        const autoScroll = player.dataset.autoscroll === 'true';

        if ( ! audioData ) return;

        const audio = new Audio( audioData );
        const playBtn = player.querySelector( '.speechable-play' );
        const iconPlay = player.querySelector( '.icon-play' );
        const iconPause = player.querySelector( '.icon-pause' );
        const progressWrap = player.querySelector( '.speechable-progress-wrap' );
        const progressFill = player.querySelector( '.speechable-progress-fill' );
        const timeDisplay = player.querySelector( '.speechable-time' );
        const durationDisplay = player.querySelector( '.speechable-duration' );
        const speedBtn = player.querySelector( '.speechable-speed' );
        const downloadBtn = player.querySelector( '.speechable-download' );

        let wordTimings = [];
        let currentHighlight = null;
        let wordElements = [];
        let wordsWrapped = false;
        let animationFrameId = null;
        let playCount = 0;
        let lastHighlightTime = 0;
        const speeds = [ 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2 ];
        let speedIndex = 2; // Default 1x

        if ( timingsData && highlighting ) {
            try {
                const parsed = JSON.parse( timingsData );
                // Validate that it's an array of timing objects
                if ( Array.isArray( parsed ) ) {
                    wordTimings = parsed.filter( t => 
                        typeof t === 'object' && 
                        typeof t.start === 'number' && 
                        typeof t.end === 'number'
                    );
                }
            } catch ( e ) {
                wordTimings = [];
            }
        }

        const formatTime = ( secs ) => {
            if ( isNaN( secs ) ) return '0:00';
            const m = Math.floor( secs / 60 );
            const s = Math.floor( secs % 60 );
            return m + ':' + s.toString().padStart( 2, '0' );
        };

        audio.addEventListener( 'loadedmetadata', () => {
            durationDisplay.textContent = formatTime( audio.duration );
        } );

        audio.addEventListener( 'timeupdate', () => {
            const pct = ( audio.currentTime / audio.duration ) * 100;
            progressFill.style.width = pct + '%';
            timeDisplay.textContent = formatTime( audio.currentTime );

            // Only highlight on FIRST playback (playCount === 1)
            if ( highlighting && wordTimings.length && playCount === 1 ) {
                const now = Date.now();
                // Throttle to ~60fps for smoother highlighting
                if ( now - lastHighlightTime > 16 ) {
                    // audio.currentTime is already in real-time (accounts for playbackRate)
                    // so we just need to convert to milliseconds
                    highlightWord( audio.currentTime * 1000 );
                    lastHighlightTime = now;
                }
            }
        } );

        // Update highlighting when playback rate changes
        audio.addEventListener( 'ratechange', () => {
            // The audio.currentTime automatically adjusts for playback rate
            // so highlighting will naturally sync - no additional adjustment needed
        } );

        audio.addEventListener( 'ended', () => {
            iconPlay.style.display = '';
            iconPause.style.display = 'none';
            clearAllHighlights();
            stopHighlightLoop();
        } );

        audio.addEventListener( 'pause', () => {
            iconPlay.style.display = '';
            iconPause.style.display = 'none';
            stopHighlightLoop();
        } );

        audio.addEventListener( 'play', () => {
            iconPlay.style.display = 'none';
            iconPause.style.display = '';
            playCount++;
            
            // Wrap words on first play only
            if ( highlighting && ! wordsWrapped && wordTimings.length ) {
                wrapWords();
                wordsWrapped = true;
            }
            
            // Start highlight loop whenever playing
            if ( highlighting && wordTimings.length && wordsWrapped ) {
                startHighlightLoop();
            }
        } );

        playBtn.addEventListener( 'click', () => {
            if ( audio.paused ) {
                audio.play();
            } else {
                audio.pause();
            }
        } );

        progressWrap.addEventListener( 'click', ( e ) => {
            const rect = progressWrap.getBoundingClientRect();
            audio.currentTime = ( ( e.clientX - rect.left ) / rect.width ) * audio.duration;
        } );

        speedBtn.addEventListener( 'click', () => {
            speedIndex = ( speedIndex + 1 ) % speeds.length;
            audio.playbackRate = speeds[ speedIndex ];
            speedBtn.textContent = speeds[ speedIndex ] + 'x';
        } );

        if ( downloadBtn ) {
            downloadBtn.addEventListener( 'click', () => {
                const link = document.createElement( 'a' );
                link.href = audioData;
                
                // Get post title for filename or use default
                const titleEl = document.querySelector( 'h1.entry-title, h1.post-title, .entry-title, .post-title, article > header h1' );
                const title = titleEl ? titleEl.textContent.trim().replace( /[^a-z0-9]/gi, '-' ).toLowerCase() : 'audio';
                link.download = title + '.wav';
                
                document.body.appendChild( link );
                link.click();
                document.body.removeChild( link );
            } );
        }

        function wrapWords() {
            const article = player.closest( 'article' ) || document.querySelector( 'article' );
            
            const titleEl = document.querySelector( 'h1.entry-title, h1.post-title, .entry-title, .post-title, article > header h1, .single h1' )
                || article?.querySelector( 'h1, h2.entry-title' );
            
            const content = document.querySelector( '.entry-content, .post-content, article .content, .single-content' )
                || article?.querySelector( '.entry-content, .post-content, .content' );

            if ( ! content && ! titleEl ) return;

            let idx = 0;

            if ( titleEl && ! titleEl.dataset.speechableWrapped ) {
                idx = wrapElement( titleEl, idx );
                titleEl.dataset.speechableWrapped = 'true';
            }

            if ( content && ! content.dataset.speechableWrapped ) {
                idx = wrapElement( content, idx );
                content.dataset.speechableWrapped = 'true';
            }

            wordElements = [];
            for ( let i = 0; i < idx; i++ ) {
                const el = document.querySelector( `.speechable-word[data-word-index="${ i }"]` );
                if ( el ) wordElements.push( el );
            }
        }

        function wrapElement( container, startIdx ) {
            const walker = document.createTreeWalker( 
                container, 
                NodeFilter.SHOW_TEXT, 
                {
                    acceptNode: function( node ) {
                        // Skip nodes inside speechable-player or other excluded elements
                        let parent = node.parentNode;
                        while ( parent && parent !== container ) {
                            if ( parent.classList && ( 
                                parent.classList.contains( 'speechable-player' ) ||
                                parent.classList.contains( 'speechable-word' ) ||
                                parent.tagName === 'SCRIPT' ||
                                parent.tagName === 'STYLE' ||
                                parent.tagName === 'NOSCRIPT'
                            ) ) {
                                return NodeFilter.FILTER_REJECT;
                            }
                            parent = parent.parentNode;
                        }
                        return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                    }
                },
                false 
            );
            const nodes = [];

            while ( walker.nextNode() ) {
                nodes.push( walker.currentNode );
            }

            let idx = startIdx;

            nodes.forEach( ( node ) => {
                const text = node.textContent;
                const parts = text.split( /(\s+)/ );
                const frag = document.createDocumentFragment();

                parts.forEach( ( part ) => {
                    if ( /^\s+$/.test( part ) ) {
                        frag.appendChild( document.createTextNode( part ) );
                    } else if ( part ) {
                        const span = document.createElement( 'span' );
                        span.textContent = part;
                        span.dataset.wordIndex = idx++;
                        span.className = 'speechable-word';
                        frag.appendChild( span );
                    }
                } );

                node.parentNode.replaceChild( frag, node );
            } );

            return idx;
        }

        function highlightWord( ms ) {
            // Find the timing entry for current playback position
            let timingIndex = -1;
            
            // Binary search for the timing entry
            let low = 0;
            let high = wordTimings.length - 1;
            
            while ( low <= high ) {
                const mid = Math.floor( ( low + high ) / 2 );
                const timing = wordTimings[ mid ];
                
                if ( ms >= timing.start && ms < timing.end ) {
                    timingIndex = mid;
                    break;
                } else if ( ms < timing.start ) {
                    high = mid - 1;
                } else {
                    low = mid + 1;
                }
            }
            
            // If no exact match, find the closest upcoming word
            if ( timingIndex === -1 ) {
                for ( let i = 0; i < wordTimings.length; i++ ) {
                    if ( ms < wordTimings[ i ].end ) {
                        timingIndex = i;
                        break;
                    }
                }
            }

            if ( timingIndex === -1 ) return;

            // Map timing index to DOM element index
            // If word counts differ, use proportional mapping
            let domIndex;
            if ( wordElements.length === wordTimings.length ) {
                domIndex = timingIndex;
            } else {
                // Proportional mapping: timing position -> DOM position
                const ratio = timingIndex / ( wordTimings.length - 1 );
                domIndex = Math.round( ratio * ( wordElements.length - 1 ) );
            }
            
            if ( domIndex < 0 || domIndex >= wordElements.length ) return;

            const el = wordElements[ domIndex ];

            if ( el && el !== currentHighlight ) {
                clearAllHighlights();
                el.classList.add( 'speechable-highlight' );
                currentHighlight = el;
                
                // Scroll into view if enabled and needed (smooth)
                if ( autoScroll ) {
                    const rect = el.getBoundingClientRect();
                    const viewHeight = window.innerHeight;
                    if ( rect.top < 100 || rect.bottom > viewHeight - 100 ) {
                        el.scrollIntoView( { behavior: 'smooth', block: 'center' } );
                    }
                }
            }
        }

        function clearAllHighlights() {
            document.querySelectorAll( '.speechable-highlight' ).forEach( el => {
                el.classList.remove( 'speechable-highlight' );
            } );
            currentHighlight = null;
        }
        
        function startHighlightLoop() {
            if ( animationFrameId ) return;
            
            let lastMs = -1;
            
            function loop() {
                if ( ! audio.paused ) {
                    const currentMs = audio.currentTime * 1000;
                    
                    // Only update if time has changed significantly (50ms threshold)
                    if ( Math.abs( currentMs - lastMs ) > 50 ) {
                        highlightWord( currentMs );
                        lastMs = currentMs;
                    }
                    
                    animationFrameId = requestAnimationFrame( loop );
                }
            }
            animationFrameId = requestAnimationFrame( loop );
        }
        
        function stopHighlightLoop() {
            if ( animationFrameId ) {
                cancelAnimationFrame( animationFrameId );
                animationFrameId = null;
            }
        }
    }
} )();
