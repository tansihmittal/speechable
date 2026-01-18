/**
 * Speechable Settings Page
 *
 * @package Speechable
 */
( function() {
    'use strict';

    let ttsModule = null;

    /**
     * Load the Piper TTS module via local loader.
     * 
     * @returns {Promise<Object>} The Piper TTS module
     */
    async function loadPiperTTS() {
        if ( ttsModule ) {
            return ttsModule;
        }
        const loader = await import( speechableSettings.pluginUrl + 'assets/js/vendor/piper-tts-loader.js' );
        ttsModule = await loader.loadPiperTTS();
        return ttsModule;
    }

    // Voice Presets functionality
    function initVoicePresets() {
        const presets = document.querySelectorAll( '.speechable-preset:not(.speechable-preset-custom)' );
        const customPreset = document.querySelector( '.speechable-preset-custom' );
        const pitchInput = document.getElementById( 'speechable-pitch' );
        const reverbInput = document.getElementById( 'speechable-reverb' );
        const presetInput = document.getElementById( 'speechable-voice-preset' );
        const pitchValue = document.getElementById( 'speechable-pitch-value' );
        const reverbValue = document.getElementById( 'speechable-reverb-value' );

        if ( ! pitchInput || ! reverbInput ) {
            return;
        }

        function updateActivePreset() {
            const currentPitch = parseInt( pitchInput.value, 10 );
            const currentReverb = parseInt( reverbInput.value, 10 );
            let matchFound = false;

            presets.forEach( function( preset ) {
                const presetPitch = parseInt( preset.dataset.pitch, 10 );
                const presetReverb = parseInt( preset.dataset.reverb, 10 );

                const isMatch = currentPitch === presetPitch && currentReverb === presetReverb;

                preset.classList.toggle( 'active', isMatch );
                if ( isMatch ) {
                    matchFound = true;
                    if ( presetInput ) {
                        presetInput.value = preset.dataset.preset;
                    }
                }
            } );

            // If no preset matches, show Custom
            if ( customPreset ) {
                if ( matchFound ) {
                    customPreset.style.display = 'none';
                    customPreset.classList.remove( 'active' );
                } else {
                    customPreset.style.display = 'flex';
                    customPreset.classList.add( 'active' );
                    if ( presetInput ) {
                        presetInput.value = 'custom';
                    }
                }
            }
        }

        // Set active preset based on saved value on page load
        function setActivePresetFromSaved() {
            if ( ! presetInput ) {
                return;
            }
            
            const savedPreset = presetInput.value;
            
            // If saved preset is custom, show it
            if ( savedPreset === 'custom' && customPreset ) {
                customPreset.style.display = 'flex';
                customPreset.classList.add( 'active' );
                presets.forEach( function( preset ) {
                    preset.classList.remove( 'active' );
                } );
                return;
            }
            
            presets.forEach( function( preset ) {
                if ( preset.dataset.preset === savedPreset ) {
                    preset.classList.add( 'active' );
                } else {
                    preset.classList.remove( 'active' );
                }
            } );
            
            // Hide custom if a regular preset is selected
            if ( customPreset ) {
                customPreset.style.display = 'none';
                customPreset.classList.remove( 'active' );
            }
        }

        presets.forEach( function( preset ) {
            preset.addEventListener( 'click', function() {
                const pitch = this.dataset.pitch;
                const reverb = this.dataset.reverb;
                const presetName = this.dataset.preset;

                // Update inputs (only pitch and reverb, not speed)
                pitchInput.value = pitch;
                reverbInput.value = reverb;
                if ( presetInput ) {
                    presetInput.value = presetName;
                }

                // Update display values
                if ( pitchValue ) {
                    pitchValue.textContent = pitch + ' st';
                }
                if ( reverbValue ) {
                    reverbValue.textContent = reverb + '%';
                }

                // Update active state
                presets.forEach( function( p ) {
                    p.classList.remove( 'active' );
                } );
                this.classList.add( 'active' );
                
                // Hide custom preset when a regular preset is clicked
                if ( customPreset ) {
                    customPreset.style.display = 'none';
                    customPreset.classList.remove( 'active' );
                }

                // Trigger preview update
                updatePreview();
            } );
        } );

        // Update active preset when sliders change
        pitchInput.addEventListener( 'input', updateActivePreset );
        reverbInput.addEventListener( 'input', updateActivePreset );

        // On page load, use the saved preset value (don't recalculate from pitch/reverb)
        setActivePresetFromSaved();
    }

    // Range input value displays
    function initRangeInputs() {
        const pitchEl = document.getElementById( 'speechable-pitch' );
        const reverbEl = document.getElementById( 'speechable-reverb' );
        const radiusEl = document.getElementById( 'speechable-radius' );

        if ( pitchEl ) {
            pitchEl.addEventListener( 'input', function() {
                const valueEl = document.getElementById( 'speechable-pitch-value' );
                if ( valueEl ) {
                    valueEl.textContent = this.value + ' st';
                }
            } );
        }

        if ( reverbEl ) {
            reverbEl.addEventListener( 'input', function() {
                const valueEl = document.getElementById( 'speechable-reverb-value' );
                if ( valueEl ) {
                    valueEl.textContent = this.value + '%';
                }
            } );
        }

        if ( radiusEl ) {
            radiusEl.addEventListener( 'input', function() {
                const valueEl = document.getElementById( 'speechable-radius-value' );
                if ( valueEl ) {
                    valueEl.textContent = this.value + 'px';
                }
                updatePreview();
            } );
        }
    }

    // Color input listeners
    function initColorInputs() {
        // Light mode colors
        [ 'speechable-color-bg', 'speechable-color-text', 'speechable-color-button', 'speechable-color-progress', 'speechable-color-border', 'speechable-color-progress-bg' ].forEach( function( id ) {
            const el = document.getElementById( id );
            if ( el ) {
                el.addEventListener( 'input', function() {
                    updatePreview( false );
                } );
            }
        } );

        // Dark mode colors
        [ 'speechable-dark-bg', 'speechable-dark-text', 'speechable-dark-button', 'speechable-dark-progress', 'speechable-dark-border', 'speechable-dark-progress-bg' ].forEach( function( id ) {
            const el = document.getElementById( id );
            if ( el ) {
                el.addEventListener( 'input', function() {
                    updatePreview( true );
                } );
            }
        } );
    }

    // Color scheme selector
    function initColorScheme() {
        const schemeOptions = document.querySelectorAll( '.speechable-scheme-option' );
        
        schemeOptions.forEach( function( option ) {
            option.addEventListener( 'click', function() {
                schemeOptions.forEach( function( opt ) {
                    opt.classList.remove( 'active' );
                } );
                this.classList.add( 'active' );
            } );
        } );
    }

    // Preview mode toggle (light/dark)
    function initPreviewToggle() {
        const toggleBtn = document.getElementById( 'speechable-preview-mode' );
        const previewBox = toggleBtn ? toggleBtn.closest( '.speechable-preview-box' ) : null;
        
        if ( ! toggleBtn || ! previewBox ) {
            return;
        }

        let isDarkPreview = false;

        toggleBtn.addEventListener( 'click', function() {
            isDarkPreview = ! isDarkPreview;
            previewBox.classList.toggle( 'dark-preview', isDarkPreview );
            toggleBtn.classList.toggle( 'dark-mode', isDarkPreview );
            
            const lightIcon = toggleBtn.querySelector( '.light-icon' );
            const darkIcon = toggleBtn.querySelector( '.dark-icon' );
            
            if ( lightIcon ) {
                lightIcon.style.display = isDarkPreview ? 'none' : 'block';
            }
            if ( darkIcon ) {
                darkIcon.style.display = isDarkPreview ? 'block' : 'none';
            }
            
            updatePreview( isDarkPreview );
        } );
    }

    // Preview update function
    function updatePreview( isDark ) {
        const preview = document.getElementById( 'speechable-preview' );
        if ( ! preview ) {
            return;
        }

        const prefix = isDark ? 'speechable-dark-' : 'speechable-color-';
        
        const bgEl = document.getElementById( prefix + 'bg' );
        const radiusEl = document.getElementById( 'speechable-radius' );
        const buttonEl = document.getElementById( prefix + 'button' );
        const progressEl = document.getElementById( prefix + 'progress' );
        const textEl = document.getElementById( prefix + 'text' );
        const borderEl = document.getElementById( prefix + 'border' );
        const progressBgEl = document.getElementById( prefix + 'progress-bg' );

        if ( bgEl ) {
            preview.style.background = bgEl.value;
        }
        if ( radiusEl ) {
            preview.style.borderRadius = radiusEl.value + 'px';
        }
        if ( borderEl ) {
            preview.style.borderColor = borderEl.value;
        }

        const previewBtn = preview.querySelector( '.speechable-preview-btn' );
        if ( previewBtn && buttonEl ) {
            previewBtn.style.background = buttonEl.value;
        }

        const previewBar = preview.querySelector( '.speechable-preview-bar' );
        if ( previewBar && progressBgEl ) {
            previewBar.style.background = progressBgEl.value;
        }

        const previewFill = preview.querySelector( '.speechable-preview-fill' );
        if ( previewFill && progressEl ) {
            previewFill.style.background = progressEl.value;
        }

        const previewTime = preview.querySelector( '.speechable-preview-time' );
        if ( previewTime && textEl ) {
            previewTime.style.color = textEl.value;
        }

        // Update speed button text color
        const speedBtn = preview.querySelector( 'span[style*="border"]' );
        if ( speedBtn && textEl && borderEl ) {
            speedBtn.style.color = textEl.value;
            speedBtn.style.borderColor = borderEl.value;
        }
    }

    // Language filter for voices
    function initLanguageFilter() {
        const langSelect = document.getElementById( 'speechable-language' );
        const voiceSelect = document.getElementById( 'speechable-voice' );

        if ( ! langSelect || ! voiceSelect ) {
            return;
        }

        langSelect.addEventListener( 'change', function() {
            const selectedLang = this.value;
            const currentVoice = voiceSelect.value;
            let firstVisibleOption = null;
            let currentVoiceVisible = false;

            // Show/hide optgroups based on language
            const optgroups = voiceSelect.querySelectorAll( 'optgroup' );
            optgroups.forEach( function( group ) {
                const groupLang = group.getAttribute( 'data-lang' );
                if ( groupLang === selectedLang ) {
                    group.style.display = '';
                    group.querySelectorAll( 'option' ).forEach( function( opt ) {
                        opt.disabled = false;
                        if ( ! firstVisibleOption ) {
                            firstVisibleOption = opt;
                        }
                        if ( opt.value === currentVoice ) {
                            currentVoiceVisible = true;
                        }
                    } );
                } else {
                    group.style.display = 'none';
                    group.querySelectorAll( 'option' ).forEach( function( opt ) {
                        opt.disabled = true;
                    } );
                }
            } );

            // Select first visible voice if current is hidden
            if ( ! currentVoiceVisible && firstVisibleOption ) {
                voiceSelect.value = firstVisibleOption.value;
            }
        } );

        // Trigger initial filter
        langSelect.dispatchEvent( new Event( 'change' ) );
    }

    // Voice Preview functionality using Piper TTS
    function initVoicePreview() {
        const previewBtn = document.getElementById( 'speechable-voice-preview' );
        const voiceSelect = document.getElementById( 'speechable-voice' );
        const langSelectEl = document.getElementById( 'speechable-language' );

        if ( ! previewBtn || ! voiceSelect ) {
            return;
        }

        const playIcon = previewBtn.querySelector( '.speechable-preview-icon-play' );
        const stopIcon = previewBtn.querySelector( '.speechable-preview-icon-stop' );
        const loadingIcon = previewBtn.querySelector( '.speechable-preview-icon-loading' );

        let currentAudio = null;
        let isLoading = false;
        let isPlaying = false;
        let isPreloading = false;
        const cachedAudio = {}; // Cache: { "voiceId_lang": audioUrl }

        // Get preview texts from localized data
        const previewTexts = ( typeof speechableSettings !== 'undefined' && speechableSettings.previewTexts ) ?
            speechableSettings.previewTexts : { en: 'Hello! This is a preview of the selected voice.' };

        function getCacheKey( voiceId, lang ) {
            return voiceId + '_' + lang;
        }

        function updateIcons() {
            if ( playIcon ) {
                playIcon.style.display = ( ! isLoading && ! isPlaying && ! isPreloading ) ? 'block' : 'none';
            }
            if ( stopIcon ) {
                stopIcon.style.display = ( ! isLoading && isPlaying ) ? 'block' : 'none';
            }
            if ( loadingIcon ) {
                loadingIcon.style.display = ( isLoading || isPreloading ) ? 'block' : 'none';
            }
            previewBtn.classList.toggle( 'is-playing', isPlaying || isLoading );
            previewBtn.classList.toggle( 'is-preloading', isPreloading );
        }

        function setLoading( loading ) {
            isLoading = loading;
            previewBtn.disabled = false;
            updateIcons();
        }

        function setPlaying( playing ) {
            isPlaying = playing;
            updateIcons();
        }

        function setPreloading( preloading ) {
            isPreloading = preloading;
            updateIcons();
        }

        function stopCurrentAudio() {
            if ( currentAudio ) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                currentAudio = null;
            }
            setPlaying( false );
            setLoading( false );
        }

        async function loadTTS() {
            if ( ttsModule ) {
                return ttsModule;
            }
            // Load Piper TTS library via local loader
            ttsModule = await loadPiperTTS();
            return ttsModule;
        }

        // Pre-download model AND generate audio for instant playback
        async function preloadVoiceAudio( voiceId, lang ) {
            const cacheKey = getCacheKey( voiceId, lang );
            if ( cachedAudio[ cacheKey ] ) {
                return;
            }

            try {
                setPreloading( true );
                const tts = await loadTTS();

                // Download voice model
                await tts.download( voiceId, function() {} );

                // Pre-generate the audio
                const previewText = previewTexts[ lang ] || previewTexts.en;
                const wavBlob = await tts.predict( {
                    text: previewText,
                    voiceId: voiceId
                } );

                // Cache the audio URL
                cachedAudio[ cacheKey ] = URL.createObjectURL( wavBlob );
            } catch ( err ) {
                // eslint-disable-next-line no-console
                console.warn( 'Failed to preload voice audio:', err );
            } finally {
                setPreloading( false );
            }
        }

        // Get current selection
        function getCurrentVoice() {
            return voiceSelect.value;
        }

        function getCurrentLang() {
            return langSelectEl ? langSelectEl.value : 'en';
        }

        // Preload current voice on page load (delayed to not block initial render)
        setTimeout( function() {
            preloadVoiceAudio( getCurrentVoice(), getCurrentLang() );
        }, 1000 );

        // Preload when voice changes
        voiceSelect.addEventListener( 'change', function() {
            preloadVoiceAudio( getCurrentVoice(), getCurrentLang() );
        } );

        // Preload when language changes
        if ( langSelectEl ) {
            langSelectEl.addEventListener( 'change', function() {
                // Small delay to let voice select update first
                setTimeout( function() {
                    preloadVoiceAudio( getCurrentVoice(), getCurrentLang() );
                }, 100 );
            } );
        }

        previewBtn.addEventListener( 'click', async function() {
            // If playing, stop
            if ( isPlaying ) {
                stopCurrentAudio();
                return;
            }

            // If preloading, do nothing
            if ( isPreloading ) {
                return;
            }

            const selectedVoice = getCurrentVoice();
            const selectedLang = getCurrentLang();
            const cacheKey = getCacheKey( selectedVoice, selectedLang );

            // Check if audio is already cached
            if ( cachedAudio[ cacheKey ] ) {
                // Instant playback!
                currentAudio = new Audio( cachedAudio[ cacheKey ] );

                currentAudio.onended = function() {
                    currentAudio = null;
                    setPlaying( false );
                };

                currentAudio.onerror = function() {
                    currentAudio = null;
                    setPlaying( false );
                };

                setPlaying( true );
                await currentAudio.play();
                return;
            }

            // Fallback: generate on-demand if not cached
            setLoading( true );

            try {
                const tts = await loadTTS();
                await tts.download( selectedVoice, function() {} );

                const previewText = previewTexts[ selectedLang ] || previewTexts.en;
                const wavBlob = await tts.predict( {
                    text: previewText,
                    voiceId: selectedVoice
                } );

                const audioUrl = URL.createObjectURL( wavBlob );
                cachedAudio[ cacheKey ] = audioUrl; // Cache for next time

                currentAudio = new Audio( audioUrl );

                currentAudio.onended = function() {
                    currentAudio = null;
                    setPlaying( false );
                };

                currentAudio.onerror = function() {
                    currentAudio = null;
                    setPlaying( false );
                };

                setLoading( false );
                setPlaying( true );
                await currentAudio.play();
            } catch ( err ) {
                // eslint-disable-next-line no-console
                console.error( 'Voice preview error:', err );
                setLoading( false );
                setPlaying( false );
                const failText = ( typeof speechableSettings !== 'undefined' && speechableSettings.previewFailText ) ?
                    speechableSettings.previewFailText : 'Failed to generate voice preview. Please try again.';
                // eslint-disable-next-line no-alert
                alert( failText );
            }
        } );
    }

    // Initialize all functionality when DOM is ready
    function init() {
        initVoicePresets();
        initRangeInputs();
        initColorInputs();
        initColorScheme();
        initPreviewToggle();
        initLanguageFilter();
        initVoicePreview();
        updatePreview( false );
    }

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', init );
    } else {
        init();
    }
} )();
