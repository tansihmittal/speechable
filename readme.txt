=== Speechable ===
Contributors: glowdopera
Donate link: https://tanishmittal.com?ref=speechable
Tags: text-to-speech, tts, audio, accessibility, voice
Requires at least: 5.8
Tested up to: 6.9
Stable tag: 1.0.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Convert your WordPress posts to audio with AI-powered text-to-speech. Works in the browser with word highlighting.

== Description ==

**Speechable** transforms your WordPress content into natural-sounding audio using AI-powered text-to-speech technology. Speechable uses Piper TTS, an open-source neural text-to-speech engine that runs in your browser.

= Third-Party Service =

This plugin uses the following third-party service:

**Piper TTS Web Library**

* Service URL: [https://github.com/Mintplex-Labs/piper-tts-web](https://github.com/Mintplex-Labs/piper-tts-web)
* Voice Models: Downloaded from [Hugging Face](https://huggingface.co/rhasspy/piper-voices)
* Terms of Service: [MIT License](https://github.com/Mintplex-Labs/piper-tts-web/blob/main/LICENSE)
* Privacy: Voice models are downloaded to your browser's local storage. Your content is processed locally and is not sent to any external server.

The TTS engine and voice models are loaded from CDN (jsDelivr) and Hugging Face when generating audio. Once downloaded, models are cached locally in your browser.

= Key Features =

* **AI-Powered Voices** - Natural-sounding speech using Piper TTS neural network models
* **12 Languages** - English, German, French, Spanish, Italian, Portuguese, Dutch, Polish, Russian, Chinese, Japanese, Korean
* **Word Highlighting** - Follow along as words are highlighted during playback
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
