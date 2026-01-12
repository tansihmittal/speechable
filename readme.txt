=== Speechable ===
Contributors: glowdopera
Donate link: https://tanishmittal.com?ref=speechable
Tags: text-to-speech, tts, audio, accessibility, voice
Requires at least: 5.8
Tested up to: 6.9
Stable tag: 1.0.1
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Convert your WordPress posts to audio with AI-powered text-to-speech. Works in the browser with word highlighting.

== Description ==

**Speechable** transforms your WordPress content into natural-sounding audio using AI-powered text-to-speech technology. Speechable uses Piper TTS, an open-source neural text-to-speech engine that runs in your browser.

= Third-Party Service =

This plugin uses the following third-party services for text-to-speech functionality:

**Piper TTS Web Library**

* Service Provider: [Mintplex Labs](https://github.com/Mintplex-Labs/piper-tts-web)
* Library CDN: jsDelivr (https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web)
* ONNX Runtime CDN: Cloudflare (https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web)
* WASM Phonemizer CDN: jsDelivr (https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm)
* Voice Models: Downloaded from [Hugging Face](https://huggingface.co/diffusionstudio/piper-voices)
* Terms of Service: [MIT License](https://github.com/Mintplex-Labs/piper-tts-web/blob/main/LICENSE)

**Whisper (Word Timestamps)**

* Service Provider: [Hugging Face Transformers.js](https://huggingface.co/docs/transformers.js)
* Library CDN: jsDelivr (https://cdn.jsdelivr.net/npm/@huggingface/transformers)
* Model: Xenova/whisper-tiny.en (~75MB, downloaded on first use)
* Purpose: Provides accurate word-level timestamps for synchronized highlighting
* Terms of Service: [Apache 2.0 License](https://github.com/huggingface/transformers.js/blob/main/LICENSE)

**What data is transmitted:**

* The TTS library and ONNX runtime are loaded from CDN when generating audio
* Voice model files are downloaded from Hugging Face when first using a voice
* Whisper model is downloaded for word timestamp extraction (first use only)
* Your content text is processed locally in your browser and is NOT sent to any external server
* Once downloaded, all resources are cached locally in your browser

**Why external resources are required:**

The text-to-speech engine requires machine learning runtime (ONNX) and voice models that are too large to bundle with the plugin. These are loaded on-demand from CDN services, similar to how Google Fonts or other web services work. This is a service-based approach that keeps the plugin lightweight while providing high-quality AI voices.

= Key Features =

* **AI-Powered Voices** - Natural-sounding speech using Piper TTS neural network models
* **Accurate Word Highlighting** - Whisper-powered word timestamps for precise synchronization
* **12 Languages** - English, German, French, Spanish, Italian, Portuguese, Dutch, Polish, Russian, Chinese, Japanese, Korean
* **Customizable Player** - Match your theme with custom colors and styling
* **Download Audio** - Let visitors download audio files for offline listening
* **Voice Presets** - Quick effects like Radio, Stadium, Cave, Chipmunk, Robot, and more
* **Free** - No premium version, no limits, no hidden costs

= How It Works =

1. Install and activate the plugin
2. Go to Settings → Speechable to configure your preferences
3. Edit any post and click "Generate Audio" in the sidebar
4. The audio player automatically appears on your published posts

= Voice Presets =

Transform your audio with one-click presets:

* Default - Natural voice
* Radio - Broadcast quality
* Stadium - Echo effect
* Cave - Deep reverb
* Chipmunk - High-pitched fun
* Deep - Low bass voice
* Robot - Mechanical tone
* Telephone - Phone quality
* Megaphone - Announcement style
* Giant - Booming voice
* Fairy - Magical high voice
* Narrator - Audiobook style

= Perfect For =

* **Bloggers** - Give readers an audio option
* **News Sites** - Accessibility for all visitors
* **Educational Content** - Help students learn
* **Accessibility** - Support visually impaired users
* **Podcasters** - Quick audio versions of written content

= Privacy =

Your content is processed locally in the browser. Text is not sent to external servers. Voice models are downloaded once and cached locally.

== Installation ==

1. Upload the `speechable` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to Settings → Speechable to configure options
4. Edit a post and use the "Audio Generation" panel to create audio

= Minimum Requirements =

* WordPress 5.8 or higher
* PHP 7.4 or higher
* Modern browser (Chrome, Firefox, Safari, Edge)

== Usage ==

= Getting Started =

1. After activation, go to **Settings → Speechable** to configure your default options
2. Select your preferred language and voice
3. Choose which post types should have audio (posts, pages, etc.)
4. Customize the player colors to match your theme

= Generating Audio for a Post =

**Method 1: Block Editor (Single Post)**

1. Edit any post or page in the WordPress block editor
2. Look for the **"Speechable"** panel in the right sidebar (under Document settings)
3. Select your preferred voice and quality settings
4. Click **"Generate Audio"** and wait for processing
5. Once complete, you can preview the audio before publishing
6. Publish or update your post - the audio player will appear automatically

**Method 2: Posts List (Quick Access)**

1. Go to **Posts → All Posts**
2. Hover over any post to see the **"Audio"** button in the row actions
3. Click it to open the audio generation modal
4. Configure settings and click **"Generate"**
5. The audio will be saved to that post

= Configuring Settings =

**Voice Settings**

* **Language** - Choose from 12 supported languages
* **Voice** - Select a voice for the chosen language (preview available)
* **Quality** - Low (faster), Medium (balanced), or High (best sync accuracy)
* **Whisper Model** - Controls word timestamp accuracy (Tiny is fastest, Small is more accurate)

**Voice Presets**

Click any preset to quickly apply pitch and reverb effects:

* Default, Warm, Bright, Radio, Narrator, Podcast, Deep, Soft, Room, Hall, Telephone, Vintage

**Display Settings**

* **Post Types** - Enable audio for posts, pages, or custom post types
* **Player Position** - Show player before or after content
* **Word Highlighting** - Enable/disable word-by-word highlighting during playback
* **Auto-scroll** - Automatically scroll to keep highlighted word visible

**Player Appearance**

* Customize background, text, button, progress bar, and highlight colors
* Adjust border radius for rounded or square corners
* Live preview shows your changes instantly

= Managing Audio =

* **Regenerate** - Click "Regenerate" in the editor panel to create new audio with different settings
* **Delete** - Remove audio from a post using the "Delete" button
* **Download** - Visitors can download the audio file using the player's download button

= Tips for Best Results =

1. **Use High quality** for important content where word sync matters
2. **Preview voices** in Settings before generating to find the best match
3. **Shorter posts** generate faster - consider breaking very long content into parts
4. **First generation** takes longer as voice models are downloaded and cached
5. **Word highlighting** works best with standard theme content areas

== Frequently Asked Questions ==

= Does this plugin require an API key? =

No! Speechable uses Piper TTS which runs entirely in your browser. No API keys, no external services, no monthly fees.

= What languages are supported? =

Speechable supports 12 languages: English (US & UK), German, French, Spanish, Italian, Portuguese, Dutch, Polish, Russian, Chinese, Japanese, and Korean.

= Will this slow down my website? =

No. The TTS processing happens in the browser when generating audio in the admin. The frontend player is lightweight and only loads on posts with audio.

= Can visitors download the audio? =

Yes! There's a download button on the player that lets visitors save the audio file.

= Does word highlighting work on all themes? =

Word highlighting works with most themes. It automatically detects your content area and highlights words as they're spoken.

= Is the audio stored on my server? =

Yes, the generated audio is stored as post meta data. This ensures fast playback without regenerating audio each time.

= Can I customize the player appearance? =

Yes! You can customize colors for the background, buttons, progress bar, text, and word highlighting. You can also adjust the border radius.

== Screenshots ==

1. Audio player on the frontend with word highlighting
2. Settings page with voice selection and presets
3. Block editor panel for generating audio
4. Voice presets for quick transformations
5. Player customization options

== Changelog ==

= 1.0.1 =
* Added "How to Use" section in settings page
* Added Custom preset for manual pitch/reverb adjustments
* Fixed preset selection persistence after save
* Updated documentation

= 1.0.0 =
* Initial release
* AI-powered text-to-speech with Piper TTS
* 12 language support with multiple voices
* Word highlighting during playback
* Customizable audio player
* Voice effect presets
* Audio download functionality
* Block editor integration

== Upgrade Notice ==

= 1.0.0 =
Initial release of Speechable - Text to Speech for WordPress.

== Credits ==

* **Developer**: [Tanish Mittal](https://tanishmittal.com)
* **TTS Engine**: [Piper TTS](https://github.com/rhasspy/piper) - A fast, local neural text-to-speech system
* **Icons**: Lucide Icons (MIT License)
