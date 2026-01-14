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
        const speeds = [ 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2 ];
        let speedIndex = 2; // Default 1x

        if ( timingsData && highlighting ) {
            try {
                const parsed = JSON.parse( timingsData );
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
        } );

        audio.addEventListener( 'ended', () => {
            playBtn.classList.remove( 'is-playing' );
            iconPlay.style.display = '';
            iconPause.style.display = 'none';
            clearAllHighlights();
            stopHighlightLoop();
        } );

        audio.addEventListener( 'pause', () => {
            playBtn.classList.remove( 'is-playing' );
            iconPlay.style.display = '';
            iconPause.style.display = 'none';
            stopHighlightLoop();
        } );

        audio.addEventListener( 'play', () => {
            playBtn.classList.add( 'is-playing' );
            iconPlay.style.display = 'none';
            iconPause.style.display = '';
            
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
            
            const content = document.querySelector( '.entry-content, .post-content, article .content, .single-content, .elementor-widget-theme-post-content' )
                || article?.querySelector( '.entry-content, .post-content, .content' )
                || document.querySelector( '.elementor-widget-container' );

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
                const el = document.querySelector( '[data-word-index="' + i + '"]' );
                if ( el ) wordElements.push( el );
            }
        }

        function wrapElement( container, startIdx ) {
            const walker = document.createTreeWalker( 
                container, 
                NodeFilter.SHOW_TEXT, 
                {
                    acceptNode: function( node ) {
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

            nodes.forEach( function( node ) {
                const text = node.textContent;
                const parent = node.parentNode;
                
                // Create a temporary container
                const temp = document.createElement( 'span' );
                temp.style.cssText = 'display:contents;';
                
                // Split text into words and spaces
                const regex = /(\S+)/g;
                let lastIndex = 0;
                let match;
                
                while ( ( match = regex.exec( text ) ) !== null ) {
                    // Add any whitespace before this word
                    if ( match.index > lastIndex ) {
                        temp.appendChild( document.createTextNode( text.substring( lastIndex, match.index ) ) );
                    }
                    
                    // Add the word wrapped in a span
                    const span = document.createElement( 'span' );
                    span.className = 'speechable-word';
                    span.setAttribute( 'data-word-index', idx++ );
                    span.textContent = match[ 1 ];
                    temp.appendChild( span );
                    
                    lastIndex = regex.lastIndex;
                }
                
                // Add any remaining whitespace
                if ( lastIndex < text.length ) {
                    temp.appendChild( document.createTextNode( text.substring( lastIndex ) ) );
                }
                
                // Replace the text node with our wrapped content
                if ( temp.childNodes.length > 0 ) {
                    parent.replaceChild( temp, node );
                }
            } );

            return idx;
        }

        function highlightWord( ms ) {
            let timingIndex = -1;
            
            // Binary search
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
            
            // Find closest if no exact match
            if ( timingIndex === -1 ) {
                for ( let i = 0; i < wordTimings.length; i++ ) {
                    if ( ms < wordTimings[ i ].end ) {
                        timingIndex = i;
                        break;
                    }
                }
            }

            if ( timingIndex === -1 ) return;

            // Map timing index to DOM element
            let domIndex;
            if ( wordElements.length === wordTimings.length ) {
                domIndex = timingIndex;
            } else if ( wordElements.length > 0 && wordTimings.length > 0 ) {
                const ratio = timingIndex / Math.max( 1, wordTimings.length - 1 );
                domIndex = Math.round( ratio * ( wordElements.length - 1 ) );
            } else {
                return;
            }
            
            if ( domIndex < 0 || domIndex >= wordElements.length ) return;

            const el = wordElements[ domIndex ];

            if ( el && el !== currentHighlight ) {
                clearAllHighlights();
                el.classList.add( 'speechable-highlight' );
                currentHighlight = el;
                
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
            document.querySelectorAll( '.speechable-highlight' ).forEach( function( el ) {
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
                    
                    if ( Math.abs( currentMs - lastMs ) > 30 ) {
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
