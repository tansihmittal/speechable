/**
 * Speechable Frontend Player
 *
 * @package Speechable
 */
( function() {
    'use strict';

    /**
     * Initialize all Speechable players on the page.
     * Can be called multiple times safely (e.g., after AJAX content loads).
     */
    function speechableInitPlayers() {
        document.querySelectorAll( '.speechable-player:not([data-initialized])' ).forEach( initPlayer );
    }

    // Expose globally for page builders and AJAX content
    window.speechableInitPlayers = speechableInitPlayers;

    // Initial load
    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', speechableInitPlayers );
    } else {
        speechableInitPlayers();
    }

    // Re-initialize on common AJAX/dynamic content events
    
    // jQuery AJAX complete (for themes/plugins using jQuery)
    if ( typeof jQuery !== 'undefined' ) {
        jQuery( document ).on( 'ajaxComplete', function() {
            setTimeout( speechableInitPlayers, 100 );
        } );
    }

    // Elementor frontend hooks (only if Elementor is loaded)
    if ( typeof jQuery !== 'undefined' && typeof elementorFrontend !== 'undefined' ) {
        jQuery( window ).on( 'elementor/frontend/init', function() {
            if ( elementorFrontend.hooks ) {
                elementorFrontend.hooks.addAction( 'frontend/element_ready/global', speechableInitPlayers );
            }
        } );
    }

    // MutationObserver for dynamic content (Elementor, Beaver Builder, etc.)
    if ( typeof MutationObserver !== 'undefined' ) {
        const observer = new MutationObserver( function( mutations ) {
            let shouldInit = false;
            mutations.forEach( function( mutation ) {
                if ( mutation.addedNodes.length ) {
                    mutation.addedNodes.forEach( function( node ) {
                        if ( node.nodeType === 1 ) {
                            if ( node.classList && node.classList.contains( 'speechable-player' ) ) {
                                shouldInit = true;
                            } else if ( node.querySelector && node.querySelector( '.speechable-player' ) ) {
                                shouldInit = true;
                            }
                        }
                    } );
                }
            } );
            if ( shouldInit ) {
                setTimeout( speechableInitPlayers, 50 );
            }
        } );

        observer.observe( document.body, {
            childList: true,
            subtree: true
        } );
    }

    // Beaver Builder hooks
    if ( typeof jQuery !== 'undefined' && typeof FLBuilder !== 'undefined' ) {
        jQuery( document ).on( 'fl-builder.layout-rendered', speechableInitPlayers );
    }

    // Divi Builder hooks
    if ( typeof jQuery !== 'undefined' ) {
        jQuery( document ).on( 'et_pb_after_init_modules', speechableInitPlayers );
    }

    // Bricks Builder hooks
    document.addEventListener( 'bricks/ajax/load_page/completed', speechableInitPlayers );

    // WPBakery hooks
    if ( typeof jQuery !== 'undefined' ) {
        jQuery( document ).on( 'vc-full-width-row-single', speechableInitPlayers );
    }

    // Oxygen Builder hooks
    document.addEventListener( 'oxygen-ajax-loaded', speechableInitPlayers );

    function initPlayer( player ) {
        // Mark as initialized to prevent double-init
        player.setAttribute( 'data-initialized', 'true' );

        const audioData = player.dataset.audio;
        const timingsData = player.dataset.timings;
        const highlighting = player.dataset.highlighting === 'true';
        const autoScroll = player.dataset.autoscroll === 'true';
        let highlightLight = player.dataset.highlightLight || '#fef08a';
        let highlightDark = player.dataset.highlightDark || '#854d0e';
        const colorScheme = player.dataset.colorScheme || 'light';
        const userHighlightChoice = player.dataset.userHighlight === 'true';

        // Highlight color presets
        const highlightPresets = [
            { name: 'Yellow', light: '#fef08a', dark: '#854d0e' },
            { name: 'Green', light: '#bbf7d0', dark: '#166534' },
            { name: 'Blue', light: '#bfdbfe', dark: '#1e40af' },
            { name: 'Red', light: '#fecaca', dark: '#991b1b' },
            { name: 'Purple', light: '#e9d5ff', dark: '#6b21a8' }
        ];

        // Load user's saved highlight preference
        const savedHighlight = localStorage.getItem( 'speechable_highlight' );
        if ( savedHighlight && userHighlightChoice ) {
            const preset = highlightPresets.find( p => p.name.toLowerCase() === savedHighlight );
            if ( preset ) {
                highlightLight = preset.light;
                highlightDark = preset.dark;
            }
        }

        if ( ! audioData ) return;

        // Website dark mode detection (not system preference)
        function isWebsiteDarkMode() {
            const root = document.documentElement;
            const body = document.body;
            
            // Method 1: Check common dark mode classes on body/html
            if ( root.classList.contains( 'dark' ) || root.classList.contains( 'dark-mode' ) ||
                 root.classList.contains( 'theme-dark' ) || root.classList.contains( 'is-dark' ) ||
                 body.classList.contains( 'dark' ) || body.classList.contains( 'dark-mode' ) ||
                 body.classList.contains( 'theme-dark' ) || body.classList.contains( 'is-dark' ) ) {
                return true;
            }
            
            // Method 2: Check data-theme attribute
            if ( root.getAttribute( 'data-theme' ) === 'dark' ||
                 body.getAttribute( 'data-theme' ) === 'dark' ||
                 root.getAttribute( 'data-color-scheme' ) === 'dark' ||
                 body.getAttribute( 'data-color-scheme' ) === 'dark' ) {
                return true;
            }
            
            // Method 3: Check background color luminance of body
            const bgColor = window.getComputedStyle( body ).backgroundColor;
            const rgb = bgColor.match( /\d+/g );
            if ( rgb && rgb.length >= 3 ) {
                const luminance = ( 0.299 * parseInt( rgb[0] ) + 0.587 * parseInt( rgb[1] ) + 0.114 * parseInt( rgb[2] ) ) / 255;
                if ( luminance < 0.4 ) return true;
            }
            
            return false;
        }

        // Check system preference (OS dark mode)
        function isSystemDarkMode() {
            return window.matchMedia && window.matchMedia( '(prefers-color-scheme: dark)' ).matches;
        }

        // Apply dark mode class if color scheme is 'auto' and website is dark
        function updatePlayerTheme() {
            if ( colorScheme === 'auto' ) {
                // Auto mode: detect website theme
                if ( isWebsiteDarkMode() ) {
                    player.classList.add( 'speechable-dark' );
                } else {
                    player.classList.remove( 'speechable-dark' );
                }
            }
            // Note: 'system' mode is handled by CSS media query, no JS needed
        }

        // Initial theme check
        updatePlayerTheme();

        // Observe theme changes on body/html (for auto mode)
        if ( colorScheme === 'auto' ) {
            const themeObserver = new MutationObserver( function() {
                updatePlayerTheme();
                updateHighlightColors();
            } );
            themeObserver.observe( document.documentElement, { attributes: true, attributeFilter: [ 'class', 'data-theme', 'data-color-scheme' ] } );
            themeObserver.observe( document.body, { attributes: true, attributeFilter: [ 'class', 'data-theme', 'data-color-scheme' ] } );
        }

        // Listen for system preference changes (for system mode highlight colors)
        if ( colorScheme === 'system' && window.matchMedia ) {
            window.matchMedia( '(prefers-color-scheme: dark)' ).addEventListener( 'change', updateHighlightColors );
        }

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

        // Get highlight color based on current theme
        function getHighlightColor() {
            // For dark mode setting
            if ( colorScheme === 'dark' ) {
                return highlightDark;
            }
            // For auto mode, check if player has dark class (set by isWebsiteDarkMode)
            if ( colorScheme === 'auto' && player.classList.contains( 'speechable-dark' ) ) {
                return highlightDark;
            }
            // For system mode, check OS preference
            if ( colorScheme === 'system' && isSystemDarkMode() ) {
                return highlightDark;
            }
            // Default to light
            return highlightLight;
        }

        function updateHighlightColors() {
            const color = getHighlightColor();
            document.querySelectorAll( '.speechable-highlight' ).forEach( el => {
                el.style.backgroundColor = color;
                el.style.boxShadow = '0 0 0 2px ' + color;
            } );
        }

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

        // Add highlight color picker for users (if enabled by admin)
        if ( userHighlightChoice && highlighting ) {
            const highlightBtn = document.createElement( 'button' );
            highlightBtn.className = 'speechable-highlight-btn';
            highlightBtn.setAttribute( 'aria-label', 'Choose highlight color' );
            highlightBtn.setAttribute( 'title', 'Highlight color' );
            // Show colored circle instead of icon
            highlightBtn.innerHTML = '<span class="speechable-hl-circle" style="background:' + highlightLight + '"></span>';
            
            // Function to update button color
            function updateButtonColor() {
                const circle = highlightBtn.querySelector( '.speechable-hl-circle' );
                if ( circle ) {
                    circle.style.background = highlightLight;
                }
            }
            
            // Insert before download button or at end
            if ( downloadBtn ) {
                downloadBtn.parentNode.insertBefore( highlightBtn, downloadBtn );
            } else {
                player.appendChild( highlightBtn );
            }

            // Create picker popup
            const picker = document.createElement( 'div' );
            picker.className = 'speechable-highlight-picker';
            picker.innerHTML = highlightPresets.map( ( p, i ) => 
                '<button class="speechable-hl-option' + ( i === 0 ? ' active' : '' ) + '" data-name="' + p.name.toLowerCase() + '" data-light="' + p.light + '" data-dark="' + p.dark + '" title="' + p.name + '">' +
                '<span style="background:' + p.light + '"></span></button>'
            ).join( '' );
            highlightBtn.appendChild( picker );

            // Set active state from saved preference
            if ( savedHighlight ) {
                picker.querySelectorAll( '.speechable-hl-option' ).forEach( btn => {
                    btn.classList.toggle( 'active', btn.dataset.name === savedHighlight );
                } );
            }

            // Toggle picker
            highlightBtn.addEventListener( 'click', ( e ) => {
                e.stopPropagation();
                picker.classList.toggle( 'show' );
            } );

            // Handle color selection
            picker.addEventListener( 'click', ( e ) => {
                const btn = e.target.closest( '.speechable-hl-option' );
                if ( ! btn ) return;
                
                picker.querySelectorAll( '.speechable-hl-option' ).forEach( b => b.classList.remove( 'active' ) );
                btn.classList.add( 'active' );
                
                highlightLight = btn.dataset.light;
                highlightDark = btn.dataset.dark;
                
                // Save preference
                localStorage.setItem( 'speechable_highlight', btn.dataset.name );
                
                // Update button color and current highlight
                updateButtonColor();
                updateHighlightColors();
                picker.classList.remove( 'show' );
            } );

            // Close picker when clicking outside
            document.addEventListener( 'click', ( e ) => {
                if ( ! player.contains( e.target ) ) {
                    picker.classList.remove( 'show' );
                }
            } );
        }

        function wrapWords() {
            const article = player.closest( 'article' ) || document.querySelector( 'article' );
            
            // Title selector - only the main post title, not metadata
            const titleEl = document.querySelector( 
                // Standard WordPress
                'h1.entry-title, h1.post-title, ' +
                // Specific title classes
                '.single-post h1.entry-title, .single h1.entry-title, ' +
                // Elementor
                '.elementor-post__title h1, ' +
                // Divi
                '.et_pb_post_title h1, ' +
                // Astra
                'h1.ast-title-single, ' +
                // GeneratePress
                'h1.page-title, ' +
                // OceanWP
                'h1.single-post-title'
            );
            
            // Content selector - only the actual post content, NOT metadata
            const content = document.querySelector( 
                // Standard WordPress - most specific first
                '.entry-content, ' +
                '.post-content, ' +
                // Elementor - only text content widgets
                '.elementor-widget-theme-post-content .elementor-widget-container, ' +
                // Divi
                '.et_pb_post_content .entry-content, ' +
                '.et_pb_post_content, ' +
                // Beaver Builder
                '.fl-post-content, ' +
                // GeneratePress
                '.entry-content, ' +
                // Astra
                '.entry-content, ' +
                // OceanWP
                '.entry-content'
            );

            // If no specific content found, try article but exclude metadata
            if ( ! content && ! titleEl ) return;

            let idx = 0;

            // Only wrap title if it's a clean h1, not inside metadata
            if ( titleEl && ! titleEl.dataset.speechableWrapped ) {
                // Make sure title is not inside a metadata container
                const isInMeta = titleEl.closest( '.entry-meta, .post-meta, .byline, .author, .date, .posted-on, .cat-links, .tags-links, .comments-link' );
                if ( ! isInMeta ) {
                    idx = wrapElement( titleEl, idx );
                    titleEl.dataset.speechableWrapped = 'true';
                }
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
                        // Skip nodes inside excluded elements
                        let parent = node.parentNode;
                        while ( parent && parent !== container ) {
                            // Skip if inside player
                            if ( parent.classList && parent.classList.contains( 'speechable-player' ) ) {
                                return NodeFilter.FILTER_REJECT;
                            }
                            // Skip if already wrapped
                            if ( parent.classList && parent.classList.contains( 'speechable-word' ) ) {
                                return NodeFilter.FILTER_REJECT;
                            }
                            // Skip script/style/noscript
                            if ( parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'NOSCRIPT' ) {
                                return NodeFilter.FILTER_REJECT;
                            }
                            // Skip metadata elements (author, date, categories, etc.)
                            if ( parent.classList && (
                                parent.classList.contains( 'entry-meta' ) ||
                                parent.classList.contains( 'post-meta' ) ||
                                parent.classList.contains( 'byline' ) ||
                                parent.classList.contains( 'author' ) ||
                                parent.classList.contains( 'posted-on' ) ||
                                parent.classList.contains( 'post-date' ) ||
                                parent.classList.contains( 'date' ) ||
                                parent.classList.contains( 'cat-links' ) ||
                                parent.classList.contains( 'tags-links' ) ||
                                parent.classList.contains( 'comments-link' ) ||
                                parent.classList.contains( 'edit-link' ) ||
                                parent.classList.contains( 'post-categories' ) ||
                                parent.classList.contains( 'post-tags' ) ||
                                parent.classList.contains( 'meta-info' ) ||
                                parent.classList.contains( 'entry-footer' ) ||
                                parent.classList.contains( 'post-footer' ) ||
                                parent.classList.contains( 'share-buttons' ) ||
                                parent.classList.contains( 'social-share' ) ||
                                parent.classList.contains( 'related-posts' ) ||
                                parent.classList.contains( 'post-navigation' ) ||
                                parent.classList.contains( 'nav-links' ) ||
                                parent.classList.contains( 'comments-area' ) ||
                                parent.classList.contains( 'comment' )
                            ) ) {
                                return NodeFilter.FILTER_REJECT;
                            }
                            // Skip time elements (dates)
                            if ( parent.tagName === 'TIME' ) {
                                return NodeFilter.FILTER_REJECT;
                            }
                            // Skip links that look like metadata (rel="author", rel="tag", etc.)
                            if ( parent.tagName === 'A' && parent.getAttribute( 'rel' ) ) {
                                const rel = parent.getAttribute( 'rel' );
                                if ( rel.includes( 'author' ) || rel.includes( 'tag' ) || rel.includes( 'category' ) ) {
                                    return NodeFilter.FILTER_REJECT;
                                }
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
                // Split by word boundaries, keeping spaces intact
                const parts = text.split( /(\S+)/ );
                const frag = document.createDocumentFragment();

                parts.forEach( ( part ) => {
                    if ( ! part ) return;
                    
                    if ( /^\s+$/.test( part ) ) {
                        // Preserve exact whitespace
                        frag.appendChild( document.createTextNode( part ) );
                    } else {
                        const span = document.createElement( 'span' );
                        span.textContent = part;
                        span.dataset.wordIndex = idx++;
                        span.className = 'speechable-word';
                        frag.appendChild( span );
                    }
                } );

                // Only replace if we have content
                if ( frag.childNodes.length > 0 ) {
                    node.parentNode.replaceChild( frag, node );
                }
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
                // Apply dynamic highlight color based on current theme
                const color = getHighlightColor();
                el.style.backgroundColor = color;
                el.style.boxShadow = '0 0 0 2px ' + color;
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
                el.style.backgroundColor = '';
                el.style.boxShadow = '';
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
