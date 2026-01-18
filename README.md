# Speechable - AI-Powered Text-to-Speech for WordPress

![Speechable Banner](https://github.com/tansihmittal/speechable/blob/main/speechable.png)

Convert your WordPress posts to natural-sounding audio with AI-powered text-to-speech technology. No API keys, no subscriptions, completely free.

[![WordPress](https://img.shields.io/badge/WordPress-5.8+-blue.svg)](https://wordpress.org/)
[![PHP](https://img.shields.io/badge/PHP-7.4+-purple.svg)](https://php.net/)
[![License](https://img.shields.io/badge/License-GPLv2-green.svg)](https://www.gnu.org/licenses/gpl-2.0.html)
[![Version](https://img.shields.io/badge/Version-1.0.1-orange.svg)](https://github.com/tansihmittal/speechable/releases)

---

<p align="center">
  <a href="https://github.com/tansihmittal/speechable/releases/download/V1.0.1/speechable.zip">
    <img src="https://img.shields.io/badge/⬇️_Download_Plugin-v1.0.1-2563eb?style=for-the-badge&logo=wordpress" alt="Download Plugin" />
  </a>
  &nbsp;&nbsp;
  <a href="https://wordpress.org/plugins/speechable/">
    <img src="https://img.shields.io/badge/View_on-WordPress.org-21759b?style=for-the-badge&logo=wordpress" alt="WordPress.org" />
  </a>
  &nbsp;&nbsp;
  <a href="https://github.com/tansihmittal/speechable/issues">
    <img src="https://img.shields.io/badge/Report-Issues-red?style=for-the-badge&logo=github" alt="Report Issues" />
  </a>
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎙️ **AI-Powered Voices** | Natural-sounding speech using Piper TTS neural network models |
| 🌍 **12 Languages** | English, German, French, Spanish, Italian, Portuguese, Dutch, Polish, Russian, Chinese, Japanese, Korean |
| 📖 **Word Highlighting** | Whisper-powered accurate word timestamps for precise synchronization |
| 🎨 **Customizable Player** | Match your theme with custom colors and styling |
| ⬇️ **Download Audio** | Let visitors download audio files for offline listening |
| 🎭 **Voice Presets** | Quick effects like Warm, Radio, Narrator, Deep, and more |
| 💰 **100% Free** | No premium version, no limits, no hidden costs |
| 🔒 **Privacy-First** | All processing happens locally in the browser |

---

## 🖼️ Screenshots

<details>
<summary>Click to view screenshots</summary>

### Audio Player on Frontend
The sleek audio player with word highlighting during playback.

### Settings Page
Configure voices, presets, colors, and display options.

### Block Editor Integration
Generate audio directly from the post editor sidebar.

</details>

---

## 🚀 Quick Start

### Installation

**Option 1: Download & Install**

<p align="center">
  <a href="https://github.com/tansihmittal/speechable/releases/download/V1.0.1/speechable.zip">
    <img src="https://img.shields.io/badge/⬇️_Download_ZIP-v1.0.1-2563eb?style=for-the-badge" alt="Download ZIP" />
  </a>
</p>

1. Download the ZIP file above
2. Go to **WordPress Admin → Plugins → Add New → Upload Plugin**
3. Upload the ZIP file and click **Install Now**
4. Activate the plugin

**Option 2: From WordPress Admin**
1. Go to **Plugins → Add New**
2. Search for **"Speechable"**
3. Click **"Install Now"** and then **"Activate"**

**Option 3: Manual Installation**
```bash
cd wp-content/plugins/
git clone https://github.com/tansihmittal/speechable.git
```

### How It Works

1. **Configure** - Go to **Settings → Speechable** to set your preferences
2. **Generate** - Edit any post and click **"Generate Audio"** in the sidebar
3. **Publish** - The audio player automatically appears on your published posts

---

## 🎭 Voice Presets

Transform your audio with one-click presets:

| Preset | Pitch | Reverb | Best For |
|--------|-------|--------|----------|
| 🎤 **Default** | 0 | 0% | Natural voice |
| ☀️ **Warm** | -1 | 10% | Friendly content |
| ✨ **Bright** | +1 | 5% | Energetic content |
| 📻 **Radio** | 0 | 15% | Broadcast quality |
| 📖 **Narrator** | -2 | 20% | Audiobook style |
| 🎙️ **Podcast** | 0 | 8% | Conversational |
| 🎸 **Deep** | -4 | 12% | Low bass voice |
| 🌸 **Soft** | +2 | 18% | Gentle content |
| 🏠 **Room** | 0 | 35% | Room ambience |
| 🏛️ **Hall** | 0 | 50% | Concert hall |
| � **hTelephone** | +2 | 3% | Phone quality |
| 📼 **Vintage** | -1 | 25% | Retro feel |

---

## 🌍 Supported Languages

<table>
<tr>
<td>🇺🇸 English (US)</td>
<td>🇬🇧 English (UK)</td>
<td>🇩🇪 German</td>
<td>🇫🇷 French</td>
</tr>
<tr>
<td>🇪🇸 Spanish</td>
<td>🇮🇹 Italian</td>
<td>🇵🇹 Portuguese</td>
<td>🇳🇱 Dutch</td>
</tr>
<tr>
<td>🇵🇱 Polish</td>
<td>🇷🇺 Russian</td>
<td>🇨🇳 Chinese</td>
<td>🇯🇵 Japanese</td>
</tr>
<tr>
<td>🇰🇷 Korean</td>
<td colspan="3"></td>
</tr>
</table>

---

## 💡 Perfect For

- **📝 Bloggers** - Give readers an audio option
- **📰 News Sites** - Accessibility for all visitors
- **🎓 Educational Content** - Help students learn
- **♿ Accessibility** - Support visually impaired users
- **🎧 Podcasters** - Quick audio versions of written content

---

## ⚙️ Requirements

| Requirement | Minimum |
|-------------|---------|
| WordPress | 5.8+ |
| PHP | 7.4+ |
| Browser | Chrome, Firefox, Safari, Edge |

---

## 🔌 Plugin Compatibility

Speechable is tested and compatible with popular WordPress plugins:

### Caching & Optimization Plugins
| Plugin | Status | Notes |
|--------|--------|-------|
| **WP Rocket** | ✅ Fully Compatible | JS automatically excluded from minification/delay |
| **LiteSpeed Cache** | ✅ Fully Compatible | JS excluded from optimization |
| **W3 Total Cache** | ✅ Fully Compatible | JS excluded from minification |
| **Autoptimize** | ✅ Fully Compatible | JS excluded from concatenation |
| **SG Optimizer** | ✅ Fully Compatible | JS excluded from combination |

### Page Builders
| Plugin | Status | Notes |
|--------|--------|-------|
| **Elementor** | ✅ Fully Compatible | Auto-reinitializes on widget render |
| **Beaver Builder** | ✅ Fully Compatible | Hooks into layout render events |
| **Divi Builder** | ✅ Fully Compatible | Supports dynamic module loading |
| **WPBakery** | ✅ Fully Compatible | Works with shortcode output |
| **Bricks Builder** | ✅ Fully Compatible | Supports AJAX page loading |
| **Oxygen Builder** | ✅ Fully Compatible | Reinitializes on AJAX load |

### Other Plugins
| Plugin | Status | Notes |
|--------|--------|-------|
| **WPML** | ✅ Compatible | Works with multilingual content |
| **Yoast SEO** | ✅ Compatible | No conflicts |
| **Rank Math** | ✅ Compatible | No conflicts |
| **WooCommerce** | ✅ Compatible | Works on product pages |

> **Note**: If you encounter issues with any plugin not listed here, please [report it](https://github.com/tansihmittal/speechable/issues).

---

## 🔧 Third-Party Services

This plugin uses the following third-party services for text-to-speech functionality:

### Piper TTS Web Library
- **Service**: [Piper TTS Web](https://github.com/Mintplex-Labs/piper-tts-web) by Mintplex Labs
- **CDN**: jsDelivr (`cdn.jsdelivr.net`)
- **License**: [MIT License](https://github.com/Mintplex-Labs/piper-tts-web/blob/main/LICENSE)

### Voice Models
- **Source**: [Hugging Face](https://huggingface.co/diffusionstudio/piper-voices)
- **Downloaded**: On first use of each voice
- **Cached**: Locally in browser storage

### Whisper (Word Timestamps)
- **Service**: [Hugging Face Transformers.js](https://huggingface.co/docs/transformers.js)
- **CDN**: jsDelivr (`cdn.jsdelivr.net/npm/@huggingface/transformers`)
- **Models Available**:
  - `Xenova/whisper-tiny.en` (~75MB) - Fastest, English only
  - `Xenova/whisper-tiny` (~75MB) - Fast, all languages
  - `Xenova/whisper-small.en` (~250MB) - Better accuracy, English only
  - `Xenova/whisper-small` (~250MB) - Better accuracy, all languages
- **Purpose**: Extracts accurate word-level timestamps for synchronized highlighting
- **License**: [Apache 2.0](https://github.com/huggingface/transformers.js/blob/main/LICENSE)

### ONNX Runtime
- **Service**: [ONNX Runtime Web](https://onnxruntime.ai/)
- **CDN**: Cloudflare (`cdnjs.cloudflare.com/ajax/libs/onnxruntime-web`)
- **Purpose**: Machine learning inference engine for TTS models

> **🔒 Privacy Note**: Your content is processed locally in your browser and is **NOT** sent to any external server. Voice models and Whisper models are downloaded once and cached locally.

---

## ❓ FAQ

<details>
<summary><strong>Does this plugin require an API key?</strong></summary>

No! Speechable uses Piper TTS which runs entirely in your browser. No API keys, no external services, no monthly fees.
</details>

<details>
<summary><strong>Will this slow down my website?</strong></summary>

No. The TTS processing happens in the browser when generating audio in the admin. The frontend player is lightweight and only loads on posts with audio.
</details>

<details>
<summary><strong>Can visitors download the audio?</strong></summary>

Yes! There's a download button on the player that lets visitors save the audio file.
</details>

<details>
<summary><strong>Does word highlighting work on all themes?</strong></summary>

Word highlighting works with most themes. It automatically detects your content area and highlights words as they're spoken.
</details>

<details>
<summary><strong>Is the audio stored on my server?</strong></summary>

Yes, the generated audio is stored as post meta data. This ensures fast playback without regenerating audio each time.
</details>

<details>
<summary><strong>Can I customize the player appearance?</strong></summary>

Yes! You can customize colors for the background, buttons, progress bar, text, and word highlighting. You can also adjust the border radius.
</details>

---

## 📝 Changelog

### v1.0.2
- Added compatibility with WP Rocket (JS exclusions from minification/delay)
- Added compatibility with LiteSpeed Cache, W3 Total Cache, Autoptimize, SG Optimizer
- Added compatibility with Elementor, Beaver Builder, Divi, WPBakery, Bricks, Oxygen
- Player now auto-reinitializes on dynamic content load (AJAX)
- Added MutationObserver for detecting dynamically added players
- Added AJAX endpoint for loading player HTML dynamically
- Fixed unused variable warning in player.js

### v1.0.1
- Added "How to Use" section in settings page
- Added Custom preset for manual pitch/reverb adjustments
- Fixed preset selection persistence after save
- Updated documentation

### v1.0.0
- Initial release
- AI-powered text-to-speech with Piper TTS
- 12 language support with multiple voices
- Word highlighting during playback
- Customizable audio player
- Voice effect presets
- Audio download functionality
- Block editor integration

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the GPLv2 or later - see the [LICENSE](LICENSE.txt) file for details.

---

## 👨‍💻 Credits

- **Developer**: [Tanish Mittal](https://tanishmittal.com)
- **TTS Engine**: [Piper TTS](https://github.com/rhasspy/piper) - A fast, local neural text-to-speech system
- **Web Library**: [Piper TTS Web](https://github.com/Mintplex-Labs/piper-tts-web) by Mintplex Labs
- **Word Timestamps**: [OpenAI Whisper](https://github.com/openai/whisper) via [Transformers.js](https://huggingface.co/docs/transformers.js)
- **Icons**: Lucide Icons (MIT License)

---

## 🔗 Links

<p align="center">
  <a href="https://wordpress.org/plugins/speechable/">WordPress Plugin Page</a> •
  <a href="https://tanishmittal.com?ref=speechable">Support</a> •
  <a href="https://github.com/tansihmittal/speechable/issues">Report Issues</a> •
  <a href="https://github.com/tansihmittal/speechable/releases">All Releases</a>
</p>

---

<p align="center">
  Made with ❤️ by <a href="https://tanishmittal.com">Tanish Mittal</a>
</p>

<p align="center">
  <a href="https://github.com/tansihmittal/speechable/stargazers">⭐ Star this repo if you find it useful!</a>
</p>
