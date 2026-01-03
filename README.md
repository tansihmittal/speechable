# Speechable - AI-Powered Text-to-Speech for WordPress

![Speechable Banner](https://github.com/tansihmittal/speechable/blob/main/speechable.png)

Convert your WordPress posts to natural-sounding audio with AI-powered text-to-speech technology. No API keys, no subscriptions, completely free.

[![WordPress](https://img.shields.io/badge/WordPress-5.8+-blue.svg)](https://wordpress.org/)
[![PHP](https://img.shields.io/badge/PHP-7.4+-purple.svg)](https://php.net/)
[![License](https://img.shields.io/badge/License-GPLv2-green.svg)](https://www.gnu.org/licenses/gpl-2.0.html)

## ✨ Features

- **🎙️ AI-Powered Voices** - Natural-sounding speech using Piper TTS neural network models
- **🌍 12 Languages** - English, German, French, Spanish, Italian, Portuguese, Dutch, Polish, Russian, Chinese, Japanese, Korean
- **📖 Word Highlighting** - Follow along as words are highlighted during playback
- **🎨 Customizable Player** - Match your theme with custom colors and styling
- **⬇️ Download Audio** - Let visitors download audio files for offline listening
- **🎭 Voice Presets** - Quick effects like Radio, Stadium, Cave, Chipmunk, Robot, and more
- **💰 100% Free** - No premium version, no limits, no hidden costs
- **🔒 Privacy-First** - All processing happens locally in the browser

## 🚀 How It Works

1. Install and activate the plugin
2. Go to **Settings → Speechable** to configure your preferences
3. Edit any post and click **"Generate Audio"** in the sidebar
4. The audio player automatically appears on your published posts

## 🎭 Voice Presets

Transform your audio with one-click presets:

| Preset | Effect |
|--------|--------|
| **Default** | Natural voice |
| **Radio** | Broadcast quality |
| **Stadium** | Echo effect |
| **Cave** | Deep reverb |
| **Chipmunk** | High-pitched fun |
| **Deep** | Low bass voice |
| **Robot** | Mechanical tone |
| **Telephone** | Phone quality |
| **Megaphone** | Announcement style |
| **Giant** | Booming voice |
| **Fairy** | Magical high voice |
| **Narrator** | Audiobook style |

## 💡 Perfect For

- **Bloggers** - Give readers an audio option
- **News Sites** - Accessibility for all visitors
- **Educational Content** - Help students learn
- **Accessibility** - Support visually impaired users
- **Podcasters** - Quick audio versions of written content

## 📦 Installation

### From WordPress Admin

1. Go to **Plugins → Add New**
2. Search for **"Speechable"**
3. Click **"Install Now"** and then **"Activate"**
4. Go to **Settings → Speechable** to configure

### Manual Installation

1. Download the latest release
2. Upload the `speechable` folder to `/wp-content/plugins/`
3. Activate the plugin through the **'Plugins'** menu in WordPress
4. Go to **Settings → Speechable** to configure options

## ⚙️ Requirements

- WordPress 5.8 or higher
- PHP 7.4 or higher
- Modern browser (Chrome, Firefox, Safari, Edge)

## 🔧 Third-Party Services

This plugin uses the following third-party services:

### Piper TTS Web Library
- **Service**: [Piper TTS Web](https://github.com/Mintplex-Labs/piper-tts-web)
- **Voice Models**: Downloaded from [Hugging Face](https://huggingface.co/rhasspy/piper-voices)
- **License**: [MIT License](https://github.com/Mintplex-Labs/piper-tts-web/blob/main/LICENSE)
- **Privacy**: Voice models are downloaded to your browser's local storage. Your content is processed locally and is not sent to any external server.

## ❓ FAQ

### Does this plugin require an API key?
No! Speechable uses Piper TTS which runs entirely in your browser. No API keys, no external services, no monthly fees.

### What languages are supported?
Speechable supports 12 languages: English (US & UK), German, French, Spanish, Italian, Portuguese, Dutch, Polish, Russian, Chinese, Japanese, and Korean.

### Will this slow down my website?
No. The TTS processing happens in the browser when generating audio in the admin. The frontend player is lightweight and only loads on posts with audio.

### Can visitors download the audio?
Yes! There's a download button on the player that lets visitors save the audio file.

### Does word highlighting work on all themes?
Word highlighting works with most themes. It automatically detects your content area and highlights words as they're spoken.

### Is the audio stored on my server?
Yes, the generated audio is stored as post meta data. This ensures fast playback without regenerating audio each time.

### Can I customize the player appearance?
Yes! You can customize colors for the background, buttons, progress bar, text, and word highlighting. You can also adjust the border radius.

## 🔒 Privacy

Your content is processed locally in the browser. Text is not sent to external servers. Voice models are downloaded once and cached locally.

## 📝 Changelog

### 1.0.0
- Initial release
- AI-powered text-to-speech with Piper TTS
- 12 language support with multiple voices
- Word highlighting during playback
- Customizable audio player
- Voice effect presets
- Audio download functionality
- Block editor integration

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the GPLv2 or later - see the [LICENSE](https://www.gnu.org/licenses/gpl-2.0.html) for details.

## 👨‍💻 Credits

- **Developer**: [Tanish Mittal](https://tanishmittal.com)
- **TTS Engine**: [Piper TTS](https://github.com/rhasspy/piper) - A fast, local neural text-to-speech system
- **Icons**: Lucide Icons (MIT License)

## 🔗 Links

- [WordPress Plugin Page](https://wordpress.org/plugins/speechable/)
- [Support](https://tanishmittal.com?ref=speechable)
- [Report Issues](https://github.com/yourusername/speechable/issues)

---

Made with ❤️ by [Tanish Mittal](https://tanishmittal.com)
