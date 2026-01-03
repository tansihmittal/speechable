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
        let playCount = 0;
        let wordsWrapped = false;
        let lastHighlightTime = 0;
        let animationFrameId = null;
        const speeds = [ 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2 ];
        let speedIndex = 2; // Default 1x
        
        // Get default speed from settings
        const defaultSpeed = typeof speechablePlayer !== 'undefined' ? ( speechablePlayer.options?.speed || 1 ) : 1;
        speedIndex = speeds.indexOf( defaultSpeed );
        if ( speedIndex === -1 ) speedIndex = 2;

        if ( timingsData && highlighting ) {
            try {
                wordTimings = JSON.parse( timingsData );
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

            if ( wordTimings.length > 0 ) {
                const actual = audio.duration * 1000;
                const original = wordTimings[ wordTimings.length - 1 ]?.end || actual;
                const ratio = actual / original;

                wordTimings = wordTimings.map( ( t ) => ( {
                    ...t,
                    start: t.start * ratio,
                    end: t.end * ratio,
                } ) );
            }
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
                    highlightWord( audio.currentTime * 1000 );
                    lastHighlightTime = now;
                }
            }
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
            
            // Increment play count
            playCount++;
            
            // Wrap words only on first play
            if ( highlighting && ! wordsWrapped && wordTimings.length && playCount === 1 ) {
                wrapWords();
                wordsWrapped = true;
            }
            
            // Start smooth highlight loop on first play
            if ( highlighting && wordTimings.length && playCount === 1 ) {
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
            const walker = document.createTreeWalker( container, NodeFilter.SHOW_TEXT, null, false );
            const nodes = [];

            while ( walker.nextNode() ) {
                if ( walker.currentNode.textContent.trim() ) {
                    nodes.push( walker.currentNode );
                }
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
            let targetIndex = -1;
            
            // Find exact match first
            for ( let i = 0; i < wordTimings.length; i++ ) {
                if ( ms >= wordTimings[ i ].start && ms < wordTimings[ i ].end ) {
                    targetIndex = i;
                    break;
                }
            }
            
            // If no exact match, find closest word within tolerance
            if ( targetIndex === -1 ) {
                const tolerance = 500; // 500ms tolerance window
                let minDist = Infinity;
                
                for ( let i = 0; i < wordTimings.length; i++ ) {
                    const midpoint = ( wordTimings[ i ].start + wordTimings[ i ].end ) / 2;
                    const dist = Math.abs( ms - midpoint );
                    
                    if ( dist < minDist && dist < tolerance ) {
                        minDist = dist;
                        targetIndex = i;
                    }
                }
            }
            
            // Prevent backward jumps (only allow forward or same position)
            if ( targetIndex !== -1 && currentHighlight ) {
                const currentIdx = parseInt( currentHighlight.dataset.wordIndex, 10 );
                // Allow small backward correction (max 2 words) but prevent large jumps
                if ( targetIndex < currentIdx - 2 ) {
                    targetIndex = currentIdx;
                }
            }

            if ( targetIndex === -1 || targetIndex >= wordElements.length ) return;

            const el = wordElements[ targetIndex ];

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
            
            function loop() {
                if ( ! audio.paused && playCount === 1 ) {
                    highlightWord( audio.currentTime * 1000 );
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
