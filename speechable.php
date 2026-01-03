<?php
/**
 * Plugin Name: Speechable
 * Plugin URI: https://github.com/tansihmittal/speechable/
 * Description: Convert posts to audio using AI-powered text-to-speech with word highlighting.
 * Version: 1.0.0
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * Author: Tanish Mittal
 * Author URI: https://tanishmittal.com
 * Developer: Tanish Mittal
 * Developer URI: https://tanishmittal.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: speechable
 * Domain Path: /languages
 *
 * @package Speechable
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'SPEECHABLE_VERSION', '1.0.0' );
define( 'SPEECHABLE_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'SPEECHABLE_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'SPEECHABLE_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

/**
 * Main Speechable class.
 *
 * @since 1.0.0
 */
final class Speechable {

    /**
     * Single instance of the class.
     *
     * @var Speechable
     */
    private static $instance = null;

    /**
     * Get the single instance.
     *
     * @return Speechable
     */
    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor.
     */
    private function __construct() {
        add_action( 'init', array( $this, 'init' ) );
        add_action( 'init', array( $this, 'load_textdomain' ) );
        add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );
        add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_editor_assets' ) );
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_frontend_assets' ) );
        add_filter( 'the_content', array( $this, 'add_audio_player' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
        add_filter( 'plugin_action_links_' . SPEECHABLE_PLUGIN_BASENAME, array( $this, 'add_settings_link' ) );

        // AJAX handlers.
        add_action( 'wp_ajax_speechable_save_audio', array( $this, 'ajax_save_audio' ) );
        add_action( 'wp_ajax_speechable_get_post_content', array( $this, 'ajax_get_post_content' ) );
        add_action( 'wp_ajax_speechable_delete_audio', array( $this, 'ajax_delete_audio' ) );
    }

    /**
     * Prevent cloning.
     */
    private function __clone() {}

    /**
     * Prevent unserializing.
     */
    public function __wakeup() {
        throw new \Exception( 'Cannot unserialize singleton' );
    }

    /**
     * Load plugin textdomain.
     *
     * Note: Since WordPress 4.6, plugins hosted on WordPress.org have translations
     * loaded automatically. This function is kept for backwards compatibility
     * and for plugins not hosted on WordPress.org.
     */
    public function load_textdomain() {
        // Translations are loaded automatically by WordPress for plugins on WordPress.org.
        // This is intentionally left empty for forward compatibility.
    }

    /**
     * Initialize plugin.
     */
    public function init() {
        register_post_meta(
            '',
            '_speechable_audio',
            array(
                'show_in_rest'  => true,
                'single'        => true,
                'type'          => 'string',
                'auth_callback' => function() {
                    return current_user_can( 'edit_posts' );
                },
            )
        );

        register_post_meta(
            '',
            '_speechable_word_timings',
            array(
                'show_in_rest'  => true,
                'single'        => true,
                'type'          => 'string',
                'auth_callback' => function() {
                    return current_user_can( 'edit_posts' );
                },
            )
        );
    }

    /**
     * Add settings link to plugins page.
     *
     * @param array $links Plugin action links.
     * @return array
     */
    public function add_settings_link( $links ) {
        $settings_link = sprintf(
            '<a href="%s">%s</a>',
            esc_url( admin_url( 'options-general.php?page=speechable' ) ),
            esc_html__( 'Settings', 'speechable' )
        );
        array_unshift( $links, $settings_link );
        return $links;
    }

    /**
     * Get default settings.
     *
     * @return array
     */
    public function get_default_settings() {
        return array(
            'voice'             => 'en_US-hfc_female-medium',
            'language'          => 'en',
            'quality'           => 'medium',
            'speed'             => 1.0,
            'post_types'        => array( 'post' ),
            'player_position'   => 'before',
            'word_highlighting' => true,
            'auto_scroll'       => true,
            'pitch_shift'       => 0,
            'reverb'            => 0,
            'voice_preset'      => 'default',
            'color_player_bg'   => '#ffffff',
            'color_text'        => '#1a1a1a',
            'color_button'      => '#2563eb',
            'color_progress'    => '#2563eb',
            'color_highlight'   => '#fef08a',
            'border_radius'     => 8,
        );
    }

    /**
     * Get available voices.
     *
     * @return array
     */
    public function get_voices() {
        return array(
            // English US.
            'en_US-hfc_female-medium' => array( 'name' => __( 'Female (US)', 'speechable' ), 'lang' => 'en' ),
            'en_US-hfc_male-medium'   => array( 'name' => __( 'Male (US)', 'speechable' ), 'lang' => 'en' ),
            'en_US-lessac-medium'     => array( 'name' => __( 'Lessac (US)', 'speechable' ), 'lang' => 'en' ),
            'en_US-amy-medium'        => array( 'name' => __( 'Amy (US)', 'speechable' ), 'lang' => 'en' ),
            'en_US-ryan-medium'       => array( 'name' => __( 'Ryan (US)', 'speechable' ), 'lang' => 'en' ),
            // English UK.
            'en_GB-alan-medium'           => array( 'name' => __( 'Alan (UK)', 'speechable' ), 'lang' => 'en' ),
            'en_GB-alba-medium'           => array( 'name' => __( 'Alba (UK)', 'speechable' ), 'lang' => 'en' ),
            'en_GB-jenny_dioco-medium'    => array( 'name' => __( 'Jenny (UK)', 'speechable' ), 'lang' => 'en' ),
            // German.
            'de_DE-thorsten-medium' => array( 'name' => 'Thorsten', 'lang' => 'de' ),
            'de_DE-eva_k-x_low'     => array( 'name' => 'Eva', 'lang' => 'de' ),
            // French.
            'fr_FR-upmc-medium'  => array( 'name' => 'UPMC', 'lang' => 'fr' ),
            'fr_FR-siwis-medium' => array( 'name' => 'Siwis', 'lang' => 'fr' ),
            // Spanish.
            'es_ES-sharvard-medium' => array( 'name' => 'Sharvard', 'lang' => 'es' ),
            'es_MX-ald-medium'      => array( 'name' => 'Ald (MX)', 'lang' => 'es' ),
            // Italian.
            'it_IT-riccardo-x_low' => array( 'name' => 'Riccardo', 'lang' => 'it' ),
            // Portuguese.
            'pt_BR-edresson-low' => array( 'name' => 'Edresson (BR)', 'lang' => 'pt' ),
            // Dutch.
            'nl_NL-mls-medium' => array( 'name' => 'MLS', 'lang' => 'nl' ),
            // Polish.
            'pl_PL-darkman-medium' => array( 'name' => 'Darkman', 'lang' => 'pl' ),
            // Russian.
            'ru_RU-irina-medium' => array( 'name' => 'Irina', 'lang' => 'ru' ),
            // Chinese.
            'zh_CN-huayan-medium' => array( 'name' => 'Huayan', 'lang' => 'zh' ),
            // Japanese.
            'ja_JP-kokoro-medium' => array( 'name' => 'Kokoro', 'lang' => 'ja' ),
            // Korean.
            'ko_KR-kagayaki-medium' => array( 'name' => 'Kagayaki', 'lang' => 'ko' ),
        );
    }

    /**
     * Get available languages.
     *
     * @return array
     */
    public function get_languages() {
        return array(
            'en' => __( 'English', 'speechable' ),
            'de' => __( 'German', 'speechable' ),
            'fr' => __( 'French', 'speechable' ),
            'es' => __( 'Spanish', 'speechable' ),
            'it' => __( 'Italian', 'speechable' ),
            'pt' => __( 'Portuguese', 'speechable' ),
            'nl' => __( 'Dutch', 'speechable' ),
            'pl' => __( 'Polish', 'speechable' ),
            'ru' => __( 'Russian', 'speechable' ),
            'zh' => __( 'Chinese', 'speechable' ),
            'ja' => __( 'Japanese', 'speechable' ),
            'ko' => __( 'Korean', 'speechable' ),
        );
    }

    /**
     * Add settings page.
     */
    public function add_settings_page() {
        add_options_page(
            __( 'Speechable Settings', 'speechable' ),
            __( 'Speechable', 'speechable' ),
            'manage_options',
            'speechable',
            array( $this, 'render_settings_page' )
        );
    }

    /**
     * Register settings.
     */
    public function register_settings() {
        register_setting(
            'speechable_settings',
            'speechable_options',
            array(
                'type'              => 'array',
                'sanitize_callback' => array( $this, 'sanitize_settings' ),
                'default'           => $this->get_default_settings(),
            )
        );
    }

    /**
     * Sanitize settings.
     *
     * @param array $input Raw input.
     * @return array Sanitized input.
     */
    public function sanitize_settings( $input ) {
        $defaults  = $this->get_default_settings();
        $sanitized = array();

        $sanitized['voice']             = sanitize_text_field( $input['voice'] ?? $defaults['voice'] );
        $sanitized['language']          = sanitize_text_field( $input['language'] ?? $defaults['language'] );
        $sanitized['quality']           = in_array( $input['quality'] ?? '', array( 'low', 'medium', 'high' ), true ) ? $input['quality'] : $defaults['quality'];
        $sanitized['speed']             = floatval( $input['speed'] ?? 1.0 );
        $sanitized['speed']             = max( 0.5, min( 2.0, $sanitized['speed'] ) );
        $sanitized['post_types']        = isset( $input['post_types'] ) ? array_map( 'sanitize_text_field', (array) $input['post_types'] ) : $defaults['post_types'];
        $sanitized['player_position']   = in_array( $input['player_position'] ?? '', array( 'before', 'after' ), true ) ? $input['player_position'] : $defaults['player_position'];
        $sanitized['word_highlighting'] = ! empty( $input['word_highlighting'] );
        $sanitized['auto_scroll']       = ! empty( $input['auto_scroll'] );
        $sanitized['pitch_shift']       = intval( $input['pitch_shift'] ?? 0 );
        $sanitized['pitch_shift']       = max( -12, min( 12, $sanitized['pitch_shift'] ) );
        $sanitized['reverb']            = intval( $input['reverb'] ?? 0 );
        $sanitized['reverb']            = max( 0, min( 100, $sanitized['reverb'] ) );
        $sanitized['voice_preset']      = sanitize_text_field( $input['voice_preset'] ?? $defaults['voice_preset'] );
        $sanitized['color_player_bg']   = sanitize_hex_color( $input['color_player_bg'] ?? '' ) ?: $defaults['color_player_bg'];
        $sanitized['color_text']        = sanitize_hex_color( $input['color_text'] ?? '' ) ?: $defaults['color_text'];
        $sanitized['color_button']      = sanitize_hex_color( $input['color_button'] ?? '' ) ?: $defaults['color_button'];
        $sanitized['color_progress']    = sanitize_hex_color( $input['color_progress'] ?? '' ) ?: $defaults['color_progress'];
        $sanitized['color_highlight']   = sanitize_hex_color( $input['color_highlight'] ?? '' ) ?: $defaults['color_highlight'];
        $sanitized['border_radius']     = absint( $input['border_radius'] ?? $defaults['border_radius'] );
        $sanitized['border_radius']     = min( 24, $sanitized['border_radius'] );

        return $sanitized;
    }

    /**
     * Render settings page.
     */
    public function render_settings_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $options    = wp_parse_args( get_option( 'speechable_options', array() ), $this->get_default_settings() );
        $voices     = $this->get_voices();
        $languages  = $this->get_languages();
        $post_types = get_post_types( array( 'public' => true ), 'objects' );
        ?>
        <div class="wrap speechable-settings">
            <style>
                .speechable-settings { max-width: 900px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                .speechable-settings h1 { font-size: 24px; font-weight: 600; margin-bottom: 24px; }
                .speechable-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px; }
                .speechable-card-header { padding: 16px 20px; border-bottom: 1px solid #e5e7eb; }
                .speechable-card-header h2 { margin: 0; font-size: 15px; font-weight: 600; color: #111827; }
                .speechable-card-header p { margin: 4px 0 0; font-size: 13px; color: #6b7280; }
                .speechable-card-body { padding: 20px; }
                .speechable-field { margin-bottom: 20px; }
                .speechable-field:last-child { margin-bottom: 0; }
                .speechable-field > label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; }
                .speechable-field .description { font-size: 12px; color: #6b7280; margin-top: 6px; }
                .speechable-field select, .speechable-field input[type="number"] { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: #fff; min-width: 200px; }
                .speechable-field select:focus, .speechable-field input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
                .speechable-field input[type="color"] { width: 50px; height: 36px; padding: 2px; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; }
                .speechable-range-wrap { display: flex; align-items: center; gap: 12px; }
                .speechable-range-wrap input[type="range"] { flex: 1; max-width: 300px; height: 6px; -webkit-appearance: none; background: #e5e7eb; border-radius: 3px; }
                .speechable-range-wrap input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; background: #2563eb; border-radius: 50%; cursor: pointer; }
                .speechable-range-value { min-width: 50px; font-size: 14px; font-weight: 500; color: #374151; }
                .speechable-checkbox-group label { display: flex; align-items: center; gap: 8px; font-weight: 400; margin-bottom: 8px; cursor: pointer; }
                .speechable-checkbox-group input[type="checkbox"] { width: 16px; height: 16px; accent-color: #2563eb; }
                .speechable-color-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
                .speechable-color-item { display: flex; align-items: center; gap: 10px; }
                .speechable-color-item span { font-size: 13px; color: #374151; }
                .speechable-settings .submit { margin-top: 24px; padding: 0; }
                .speechable-settings .button-primary { background: #2563eb; border: none; border-radius: 6px; padding: 10px 20px; font-size: 14px; font-weight: 500; cursor: pointer; }
                .speechable-settings .button-primary:hover { background: #1d4ed8; }
                .speechable-preview-box { margin-top: 16px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
                .speechable-preview-player { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; }
                .speechable-voice-selector { display: flex; align-items: center; gap: 8px; }
                .speechable-voice-selector select { flex: 1; min-width: 200px; }
                .speechable-voice-preview-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 0; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; }
                .speechable-voice-preview-btn:hover { background: #f3f4f6; border-color: #2563eb; color: #2563eb; }
                .speechable-voice-preview-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .speechable-voice-preview-btn.is-playing { background: #2563eb; border-color: #2563eb; color: #fff; }
                .speechable-voice-preview-btn.is-preloading { background: #f3f4f6; border-color: #d1d5db; color: #9ca3af; }
                .speechable-presets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
                .speechable-preset { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; border: 2px solid #e5e7eb; border-radius: 8px; background: #fff; cursor: pointer; transition: all 0.15s; }
                .speechable-preset:hover { border-color: #2563eb; background: #f0f7ff; }
                .speechable-preset.active { border-color: #2563eb; background: #eff6ff; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
                .speechable-preset-icon { font-size: 24px; line-height: 1; }
                .speechable-preset-name { font-size: 11px; font-weight: 500; color: #374151; text-align: center; }
                .speechable-preview-btn { width: 40px; height: 40px; border-radius: 50%; border: none; background: #2563eb; color: #fff; font-size: 14px; cursor: default; }
                .speechable-preview-bar { flex: 1; height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden; }
                .speechable-preview-fill { width: 35%; height: 100%; background: #2563eb; }
                .speechable-preview-time { font-size: 13px; color: #1a1a1a; }
            </style>

            <h1><?php esc_html_e( 'Speechable', 'speechable' ); ?></h1>

            <form method="post" action="options.php">
                <?php settings_fields( 'speechable_settings' ); ?>

                <div class="speechable-card">
                    <div class="speechable-card-header">
                        <h2><?php esc_html_e( 'Voice Settings', 'speechable' ); ?></h2>
                        <p><?php esc_html_e( 'Configure the default voice and audio effects.', 'speechable' ); ?></p>
                    </div>
                    <div class="speechable-card-body">
                        <div class="speechable-field">
                            <label for="speechable-language"><?php esc_html_e( 'Default Language', 'speechable' ); ?></label>
                            <select name="speechable_options[language]" id="speechable-language">
                                <?php foreach ( $languages as $lang_code => $lang_name ) : ?>
                                    <option value="<?php echo esc_attr( $lang_code ); ?>" <?php selected( $options['language'], $lang_code ); ?>>
                                        <?php echo esc_html( $lang_name ); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        
                        <div class="speechable-field">
                            <label for="speechable-voice"><?php esc_html_e( 'Default Voice', 'speechable' ); ?></label>
                            <div class="speechable-voice-selector">
                                <select name="speechable_options[voice]" id="speechable-voice">
                                    <?php foreach ( $languages as $lang_code => $lang_name ) : ?>
                                        <optgroup label="<?php echo esc_attr( $lang_name ); ?>" data-lang="<?php echo esc_attr( $lang_code ); ?>">
                                            <?php foreach ( $voices as $value => $voice ) :
                                                if ( $voice['lang'] !== $lang_code ) continue;
                                            ?>
                                                <option value="<?php echo esc_attr( $value ); ?>" <?php selected( $options['voice'], $value ); ?>>
                                                    <?php echo esc_html( $voice['name'] ); ?>
                                                </option>
                                            <?php endforeach; ?>
                                        </optgroup>
                                    <?php endforeach; ?>
                                </select>
                                <button type="button" class="speechable-voice-preview-btn" id="speechable-voice-preview" title="<?php esc_attr_e( 'Preview this voice', 'speechable' ); ?>">
                                    <svg class="speechable-preview-icon-play" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                    <svg class="speechable-preview-icon-stop" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><rect x="6" y="6" width="12" height="12"/></svg>
                                    <svg class="speechable-preview-icon-loading" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></path></svg>
                                </button>
                            </div>
                            <p class="description"><?php esc_html_e( 'Click the play button to preview the selected voice.', 'speechable' ); ?></p>
                        </div>
                        
                        <div class="speechable-field">
                            <label for="speechable-quality"><?php esc_html_e( 'Audio Quality', 'speechable' ); ?></label>
                            <select name="speechable_options[quality]" id="speechable-quality">
                                <option value="low" <?php selected( $options['quality'], 'low' ); ?>><?php esc_html_e( 'Low (Smaller file)', 'speechable' ); ?></option>
                                <option value="medium" <?php selected( $options['quality'], 'medium' ); ?>><?php esc_html_e( 'Medium', 'speechable' ); ?></option>
                                <option value="high" <?php selected( $options['quality'], 'high' ); ?>><?php esc_html_e( 'High (Best quality)', 'speechable' ); ?></option>
                            </select>
                            <p class="description"><?php esc_html_e( 'Higher quality = better sync accuracy but slower generation.', 'speechable' ); ?></p>
                        </div>

                        <div class="speechable-field">
                            <label><?php esc_html_e( 'Voice Presets', 'speechable' ); ?></label>
                            <p class="description" style="margin-bottom: 10px;"><?php esc_html_e( 'Quick presets for instant voice transformations. Click to apply and save as default.', 'speechable' ); ?></p>
                            <input type="hidden" name="speechable_options[voice_preset]" id="speechable-voice-preset" value="<?php echo esc_attr( $options['voice_preset'] ); ?>">
                            <div class="speechable-presets-grid">
                                <button type="button" class="speechable-preset<?php echo $options['voice_preset'] === 'default' ? ' active' : ''; ?>" data-preset="default" data-pitch="0" data-reverb="0" data-speed="1.0">
                                    <span class="speechable-preset-icon">🎤</span>
                                    <span class="speechable-preset-name"><?php esc_html_e( 'Default', 'speechable' ); ?></span>
                                </button>
                                <button type="button" class="speechable-preset<?php echo $options['voice_preset'] === 'radio' ? ' active' : ''; ?>" data-preset="radio" data-pitch="0" data-reverb="15" data-speed="1.0">
                                    <span class="speechable-preset-icon">📻</span>
                                    <span class="speechable-preset-name"><?php esc_html_e( 'Radio', 'speechable' ); ?></span>
                                </button>
                                <button type="button" class="speechable-preset<?php echo $options['voice_preset'] === 'stadium' ? ' active' : ''; ?>" data-preset="stadium" data-pitch="0" data-reverb="70" data-speed="1.0">
                                    <span class="speechable-preset-icon">🏟️</span>
                                    <span class="speechable-preset-name"><?php esc_html_e( 'Stadium', 'speechable' ); ?></span>
                                </button>
                                <button type="button" class="speechable-preset<?php echo $options['voice_preset'] === 'cave' ? ' active' : ''; ?>" data-preset="cave" data-pitch="-2" data-reverb="85" data-speed="0.95">
                                    <span class="speechable-preset-icon">🕳️</span>
                                    <span class="speechable-preset-name"><?php esc_html_e( 'Cave', 'speechable' ); ?></span>
                                </button>
                                <button type="button" class="speechable-preset<?php echo $options['voice_preset'] === 'chipmunk' ? ' active' : ''; ?>" data-preset="chipmunk" data-pitch="8" data-reverb="0" data-speed="1.3">
                                    <span class="speechable-preset-icon">🐿️</span>
                                    <span class="speechable-preset-name"><?php esc_html_e( 'Chipmunk', 'speechable' ); ?></span>
                                </button>
                                <button type="button" class="speechable-preset<?php echo $options['voice_preset'] === 'deep' ? ' active' : ''; ?>" data-preset="deep" data-pitch="-6" data-reverb="10" data-speed="0.9">
                                    <span class="speechable-preset-icon">🎸</span>
                                    <span class="speechable-preset-name"><?php esc_html_e( 'Deep', 'speechable' ); ?></span>
                                </button>
                                <button type="button" class="speechable-preset<?php echo $options['voice_preset'] === 'robot' ? ' active' : ''; ?>" data-preset="robot" data-pitch="0" data-reverb="30" data-speed="0.95">
                                    <span class="speechable-preset-icon">🤖</span>
                                    <span class="speechable-preset-name"><?php esc_html_e( 'Robot', 'speechable' ); ?></span>
                                </button>
                                <button type="button" class="speechable-preset<?php echo $options['voice_preset'] === 'telephone' ? ' active' : ''; ?>" data-preset="telephone" data-pitch="2" data-reverb="5" data-speed="1.0">
                                    <span class="speechable-preset-icon">📞</span>
                                    <span class="speechable-preset-name"><?php esc_html_e( 'Telephone', 'speechable' ); ?></span>
                                </button>
                                <button type="button" class="speechable-preset<?php echo $options['voice_preset'] === 'megaphone' ? ' active' : ''; ?>" data-preset="megaphone" data-pitch="1" data-reverb="25" data-speed="1.1">
                                    <span class="speechable-preset-icon">📢</span>
                                    <span class="speechable-preset-name"><?php esc_html_e( 'Megaphone', 'speechable' ); ?></span>
                                </button>
                                <button type="button" class="speechable-preset<?php echo $options['voice_preset'] === 'giant' ? ' active' : ''; ?>" data-preset="giant" data-pitch="-10" data-reverb="40" data-speed="0.8">
                                    <span class="speechable-preset-icon">🦣</span>
                                    <span class="speechable-preset-name"><?php esc_html_e( 'Giant', 'speechable' ); ?></span>
                                </button>
                                <button type="button" class="speechable-preset<?php echo $options['voice_preset'] === 'fairy' ? ' active' : ''; ?>" data-preset="fairy" data-pitch="10" data-reverb="20" data-speed="1.2">
                                    <span class="speechable-preset-icon">🧚</span>
                                    <span class="speechable-preset-name"><?php esc_html_e( 'Fairy', 'speechable' ); ?></span>
                                </button>
                                <button type="button" class="speechable-preset<?php echo $options['voice_preset'] === 'narrator' ? ' active' : ''; ?>" data-preset="narrator" data-pitch="-2" data-reverb="20" data-speed="0.85">
                                    <span class="speechable-preset-icon">📖</span>
                                    <span class="speechable-preset-name"><?php esc_html_e( 'Narrator', 'speechable' ); ?></span>
                                </button>
                            </div>
                        </div>

                        <div class="speechable-field">
                            <label><?php esc_html_e( 'Speech Speed', 'speechable' ); ?></label>
                            <div class="speechable-range-wrap">
                                <input type="range" name="speechable_options[speed]" value="<?php echo esc_attr( $options['speed'] ); ?>" min="0.5" max="2.0" step="0.1" id="speechable-speed">
                                <span class="speechable-range-value" id="speechable-speed-value"><?php echo esc_html( $options['speed'] ); ?>x</span>
                            </div>
                            <p class="description"><?php esc_html_e( 'Default playback speed (0.5x - 2.0x).', 'speechable' ); ?></p>
                        </div>

                        <div class="speechable-field">
                            <label><?php esc_html_e( 'Pitch Shift', 'speechable' ); ?></label>
                            <div class="speechable-range-wrap">
                                <input type="range" name="speechable_options[pitch_shift]" value="<?php echo esc_attr( $options['pitch_shift'] ); ?>" min="-12" max="12" step="1" id="speechable-pitch">
                                <span class="speechable-range-value" id="speechable-pitch-value"><?php echo esc_html( $options['pitch_shift'] ); ?> st</span>
                            </div>
                            <p class="description"><?php esc_html_e( 'Adjust voice pitch in semitones (-12 to +12).', 'speechable' ); ?></p>
                        </div>

                        <div class="speechable-field">
                            <label><?php esc_html_e( 'Reverb', 'speechable' ); ?></label>
                            <div class="speechable-range-wrap">
                                <input type="range" name="speechable_options[reverb]" value="<?php echo esc_attr( $options['reverb'] ); ?>" min="0" max="100" step="5" id="speechable-reverb">
                                <span class="speechable-range-value" id="speechable-reverb-value"><?php echo esc_html( $options['reverb'] ); ?>%</span>
                            </div>
                            <p class="description"><?php esc_html_e( 'Add reverb effect to the audio.', 'speechable' ); ?></p>
                        </div>
                    </div>
                </div>

                <div class="speechable-card">
                    <div class="speechable-card-header">
                        <h2><?php esc_html_e( 'Display Settings', 'speechable' ); ?></h2>
                        <p><?php esc_html_e( 'Configure where and how the player appears.', 'speechable' ); ?></p>
                    </div>
                    <div class="speechable-card-body">
                        <div class="speechable-field">
                            <label><?php esc_html_e( 'Enable for Post Types', 'speechable' ); ?></label>
                            <div class="speechable-checkbox-group">
                                <?php foreach ( $post_types as $pt ) : ?>
                                    <label>
                                        <input type="checkbox" name="speechable_options[post_types][]" value="<?php echo esc_attr( $pt->name ); ?>" <?php checked( in_array( $pt->name, $options['post_types'], true ) ); ?>>
                                        <?php echo esc_html( $pt->labels->name ); ?>
                                    </label>
                                <?php endforeach; ?>
                            </div>
                        </div>

                        <div class="speechable-field">
                            <label for="speechable-position"><?php esc_html_e( 'Player Position', 'speechable' ); ?></label>
                            <select name="speechable_options[player_position]" id="speechable-position">
                                <option value="before" <?php selected( $options['player_position'], 'before' ); ?>><?php esc_html_e( 'Before Content', 'speechable' ); ?></option>
                                <option value="after" <?php selected( $options['player_position'], 'after' ); ?>><?php esc_html_e( 'After Content', 'speechable' ); ?></option>
                            </select>
                        </div>

                        <div class="speechable-field">
                            <div class="speechable-checkbox-group">
                                <label>
                                    <input type="checkbox" name="speechable_options[word_highlighting]" value="1" <?php checked( $options['word_highlighting'] ); ?>>
                                    <?php esc_html_e( 'Enable word highlighting during playback', 'speechable' ); ?>
                                </label>
                                <label>
                                    <input type="checkbox" name="speechable_options[auto_scroll]" value="1" <?php checked( $options['auto_scroll'] ); ?>>
                                    <?php esc_html_e( 'Auto-scroll to highlighted word', 'speechable' ); ?>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="speechable-card">
                    <div class="speechable-card-header">
                        <h2><?php esc_html_e( 'Player Appearance', 'speechable' ); ?></h2>
                        <p><?php esc_html_e( 'Customize the player colors and style.', 'speechable' ); ?></p>
                    </div>
                    <div class="speechable-card-body">
                        <div class="speechable-field">
                            <label><?php esc_html_e( 'Colors', 'speechable' ); ?></label>
                            <div class="speechable-color-grid">
                                <div class="speechable-color-item">
                                    <input type="color" name="speechable_options[color_player_bg]" value="<?php echo esc_attr( $options['color_player_bg'] ); ?>" id="speechable-color-bg">
                                    <span><?php esc_html_e( 'Background', 'speechable' ); ?></span>
                                </div>
                                <div class="speechable-color-item">
                                    <input type="color" name="speechable_options[color_text]" value="<?php echo esc_attr( $options['color_text'] ); ?>" id="speechable-color-text">
                                    <span><?php esc_html_e( 'Text', 'speechable' ); ?></span>
                                </div>
                                <div class="speechable-color-item">
                                    <input type="color" name="speechable_options[color_button]" value="<?php echo esc_attr( $options['color_button'] ); ?>" id="speechable-color-button">
                                    <span><?php esc_html_e( 'Button', 'speechable' ); ?></span>
                                </div>
                                <div class="speechable-color-item">
                                    <input type="color" name="speechable_options[color_progress]" value="<?php echo esc_attr( $options['color_progress'] ); ?>" id="speechable-color-progress">
                                    <span><?php esc_html_e( 'Progress Bar', 'speechable' ); ?></span>
                                </div>
                                <div class="speechable-color-item">
                                    <input type="color" name="speechable_options[color_highlight]" value="<?php echo esc_attr( $options['color_highlight'] ); ?>" id="speechable-color-highlight">
                                    <span><?php esc_html_e( 'Word Highlight', 'speechable' ); ?></span>
                                </div>
                            </div>
                        </div>

                        <div class="speechable-field">
                            <label><?php esc_html_e( 'Border Radius', 'speechable' ); ?></label>
                            <div class="speechable-range-wrap">
                                <input type="range" name="speechable_options[border_radius]" value="<?php echo esc_attr( $options['border_radius'] ); ?>" min="0" max="24" step="2" id="speechable-radius">
                                <span class="speechable-range-value" id="speechable-radius-value"><?php echo esc_html( $options['border_radius'] ); ?>px</span>
                            </div>
                        </div>

                        <div class="speechable-preview-box">
                            <label style="font-size: 12px; color: #6b7280; margin-bottom: 10px; display: block;"><?php esc_html_e( 'Preview', 'speechable' ); ?></label>
                            <div class="speechable-preview-player" id="speechable-preview">
                                <button type="button" class="speechable-preview-btn">▶</button>
                                <div class="speechable-preview-bar"><div class="speechable-preview-fill"></div></div>
                                <span class="speechable-preview-time">1:23 / 3:45</span>
                                <span style="padding: 4px 8px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 12px;">1x</span>
                            </div>
                        </div>
                    </div>
                </div>

                <?php submit_button( __( 'Save Settings', 'speechable' ) ); ?>
            </form>

            <!-- Credits Section -->
            <div class="speechable-card" style="margin-top: 24px;">
                <div class="speechable-card-header">
                    <h2><?php esc_html_e( 'Credits', 'speechable' ); ?></h2>
                </div>
                <div class="speechable-card-body">
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 14px; color: #374151;"><?php esc_html_e( 'Made by', 'speechable' ); ?></span>
                            <a href="https://tanishmittal.com?ref=speechable" target="_blank" rel="noopener noreferrer" style="font-size: 14px; font-weight: 600; color: #2563eb; text-decoration: none;">
                                Tanish Mittal
                                <svg style="display: inline-block; width: 12px; height: 12px; margin-left: 4px; vertical-align: middle;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                            </a>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 14px; color: #374151;"><?php esc_html_e( 'TTS Model', 'speechable' ); ?></span>
                            <a href="https://github.com/OHF-Voice/piper1-gpl" target="_blank" rel="noopener noreferrer" style="font-size: 14px; font-weight: 600; color: #2563eb; text-decoration: none;">
                                Piper TTS
                                <svg style="display: inline-block; width: 12px; height: 12px; margin-left: 4px; vertical-align: middle;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                // Voice Presets functionality
                (function() {
                    var presets = document.querySelectorAll('.speechable-preset');
                    var pitchInput = document.getElementById('speechable-pitch');
                    var reverbInput = document.getElementById('speechable-reverb');
                    var speedInput = document.getElementById('speechable-speed');
                    var presetInput = document.getElementById('speechable-voice-preset');
                    var pitchValue = document.getElementById('speechable-pitch-value');
                    var reverbValue = document.getElementById('speechable-reverb-value');
                    var speedValue = document.getElementById('speechable-speed-value');

                    function updateActivePreset() {
                        var currentPitch = parseInt(pitchInput.value);
                        var currentReverb = parseInt(reverbInput.value);
                        var currentSpeed = parseFloat(speedInput.value);

                        presets.forEach(function(preset) {
                            var presetPitch = parseInt(preset.dataset.pitch);
                            var presetReverb = parseInt(preset.dataset.reverb);
                            var presetSpeed = parseFloat(preset.dataset.speed);

                            var isMatch = currentPitch === presetPitch && 
                                          currentReverb === presetReverb && 
                                          Math.abs(currentSpeed - presetSpeed) < 0.05;

                            preset.classList.toggle('active', isMatch);
                            if (isMatch) {
                                presetInput.value = preset.dataset.preset;
                            }
                        });
                    }

                    presets.forEach(function(preset) {
                        preset.addEventListener('click', function() {
                            var pitch = this.dataset.pitch;
                            var reverb = this.dataset.reverb;
                            var speed = this.dataset.speed;
                            var presetName = this.dataset.preset;

                            // Update inputs
                            pitchInput.value = pitch;
                            reverbInput.value = reverb;
                            speedInput.value = speed;
                            presetInput.value = presetName;

                            // Update display values
                            pitchValue.textContent = pitch + ' st';
                            reverbValue.textContent = reverb + '%';
                            speedValue.textContent = speed + 'x';

                            // Update active state
                            presets.forEach(function(p) { p.classList.remove('active'); });
                            this.classList.add('active');

                            // Trigger preview update
                            updatePreview();
                        });
                    });

                    // Update active preset when sliders change
                    pitchInput.addEventListener('input', updateActivePreset);
                    reverbInput.addEventListener('input', updateActivePreset);
                    speedInput.addEventListener('input', updateActivePreset);

                    // Initial check
                    updateActivePreset();
                })();

                document.getElementById('speechable-pitch').addEventListener('input', function() {
                    document.getElementById('speechable-pitch-value').textContent = this.value + ' st';
                });
                document.getElementById('speechable-reverb').addEventListener('input', function() {
                    document.getElementById('speechable-reverb-value').textContent = this.value + '%';
                });
                document.getElementById('speechable-speed').addEventListener('input', function() {
                    document.getElementById('speechable-speed-value').textContent = this.value + 'x';
                });
                document.getElementById('speechable-radius').addEventListener('input', function() {
                    document.getElementById('speechable-radius-value').textContent = this.value + 'px';
                    updatePreview();
                });

                ['speechable-color-bg', 'speechable-color-text', 'speechable-color-button', 'speechable-color-progress'].forEach(function(id) {
                    var el = document.getElementById(id);
                    if (el) el.addEventListener('input', updatePreview);
                });

                function updatePreview() {
                    var preview = document.getElementById('speechable-preview');
                    if (!preview) return;
                    preview.style.background = document.getElementById('speechable-color-bg').value;
                    preview.style.borderRadius = document.getElementById('speechable-radius').value + 'px';
                    preview.querySelector('.speechable-preview-btn').style.background = document.getElementById('speechable-color-button').value;
                    preview.querySelector('.speechable-preview-fill').style.background = document.getElementById('speechable-color-progress').value;
                    preview.querySelector('.speechable-preview-time').style.color = document.getElementById('speechable-color-text').value;
                }
                updatePreview();

                // Filter voices by selected language
                var langSelect = document.getElementById('speechable-language');
                var voiceSelect = document.getElementById('speechable-voice');
                
                langSelect.addEventListener('change', function() {
                    var selectedLang = this.value;
                    var currentVoice = voiceSelect.value;
                    var firstVisibleOption = null;
                    var currentVoiceVisible = false;
                    
                    // Show/hide optgroups based on language
                    var optgroups = voiceSelect.querySelectorAll('optgroup');
                    optgroups.forEach(function(group) {
                        var groupLang = group.getAttribute('data-lang');
                        if (groupLang === selectedLang) {
                            group.style.display = '';
                            group.querySelectorAll('option').forEach(function(opt) {
                                opt.disabled = false;
                                if (!firstVisibleOption) firstVisibleOption = opt;
                                if (opt.value === currentVoice) currentVoiceVisible = true;
                            });
                        } else {
                            group.style.display = 'none';
                            group.querySelectorAll('option').forEach(function(opt) {
                                opt.disabled = true;
                            });
                        }
                    });
                    
                    // Select first visible voice if current is hidden
                    if (!currentVoiceVisible && firstVisibleOption) {
                        voiceSelect.value = firstVisibleOption.value;
                    }
                });
                
                // Trigger initial filter
                langSelect.dispatchEvent(new Event('change'));

                // Voice Preview functionality using Piper TTS
                (function() {
                    var previewBtn = document.getElementById('speechable-voice-preview');
                    var voiceSelect = document.getElementById('speechable-voice');
                    var langSelectEl = document.getElementById('speechable-language');
                    var playIcon = previewBtn.querySelector('.speechable-preview-icon-play');
                    var stopIcon = previewBtn.querySelector('.speechable-preview-icon-stop');
                    var loadingIcon = previewBtn.querySelector('.speechable-preview-icon-loading');
                    var currentAudio = null;
                    var isLoading = false;
                    var isPlaying = false;
                    var isPreloading = false;
                    var ttsModule = null;
                    var cachedAudio = {}; // Cache: { "voiceId_lang": audioUrl }

                    // Preview text samples for different languages
                    var previewTexts = {
                        'en': 'Hello! This is a preview of the selected voice.',
                        'de': 'Hallo! Dies ist eine Vorschau der ausgewählten Stimme.',
                        'fr': 'Bonjour! Ceci est un aperçu de la voix sélectionnée.',
                        'es': 'Hola! Esta es una vista previa de la voz seleccionada.',
                        'it': 'Ciao! Questa è un anteprima della voce selezionata.',
                        'pt': 'Olá! Esta é uma prévia da voz selecionada.',
                        'nl': 'Hallo! Dit is een voorbeeld van de geselecteerde stem.',
                        'pl': 'Cześć! To jest podgląd wybranego głosu.',
                        'ru': 'Привет! Это предварительный просмотр выбранного голоса.',
                        'zh': '你好！这是所选语音的预览。',
                        'ja': 'こんにちは！これは選択した音声のプレビューです。',
                        'ko': '안녕하세요! 선택한 음성의 미리보기입니다.'
                    };

                    function getCacheKey(voiceId, lang) {
                        return voiceId + '_' + lang;
                    }

                    function updateIcons() {
                        playIcon.style.display = (!isLoading && !isPlaying && !isPreloading) ? 'block' : 'none';
                        stopIcon.style.display = (!isLoading && isPlaying) ? 'block' : 'none';
                        loadingIcon.style.display = (isLoading || isPreloading) ? 'block' : 'none';
                        previewBtn.classList.toggle('is-playing', isPlaying || isLoading);
                        previewBtn.classList.toggle('is-preloading', isPreloading);
                    }

                    function setLoading(loading) {
                        isLoading = loading;
                        previewBtn.disabled = false;
                        updateIcons();
                    }

                    function setPlaying(playing) {
                        isPlaying = playing;
                        updateIcons();
                    }

                    function setPreloading(preloading) {
                        isPreloading = preloading;
                        updateIcons();
                    }

                    function stopCurrentAudio() {
                        if (currentAudio) {
                            currentAudio.pause();
                            currentAudio.currentTime = 0;
                            currentAudio = null;
                        }
                        setPlaying(false);
                        setLoading(false);
                    }

                    async function loadTTS() {
                        if (ttsModule) return ttsModule;
                        ttsModule = await import('https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/+esm');
                        return ttsModule;
                    }

                    // Pre-download model AND generate audio for instant playback
                    async function preloadVoiceAudio(voiceId, lang) {
                        var cacheKey = getCacheKey(voiceId, lang);
                        if (cachedAudio[cacheKey]) return;
                        
                        try {
                            setPreloading(true);
                            var tts = await loadTTS();
                            
                            // Download voice model
                            await tts.download(voiceId, function(prog) {});
                            
                            // Pre-generate the audio
                            var previewText = previewTexts[lang] || previewTexts['en'];
                            var wavBlob = await tts.predict({ 
                                text: previewText, 
                                voiceId: voiceId 
                            });
                            
                            // Cache the audio URL
                            cachedAudio[cacheKey] = URL.createObjectURL(wavBlob);
                            
                        } catch (err) {
                            console.warn('Failed to preload voice audio:', err);
                        } finally {
                            setPreloading(false);
                        }
                    }

                    // Get current selection
                    function getCurrentVoice() {
                        return voiceSelect.value;
                    }
                    
                    function getCurrentLang() {
                        return langSelectEl ? langSelectEl.value : 'en';
                    }

                    // Preload current voice on page load
                    preloadVoiceAudio(getCurrentVoice(), getCurrentLang());

                    // Preload when voice changes
                    voiceSelect.addEventListener('change', function() {
                        preloadVoiceAudio(getCurrentVoice(), getCurrentLang());
                    });

                    // Preload when language changes
                    if (langSelectEl) {
                        langSelectEl.addEventListener('change', function() {
                            // Small delay to let voice select update first
                            setTimeout(function() {
                                preloadVoiceAudio(getCurrentVoice(), getCurrentLang());
                            }, 100);
                        });
                    }

                    previewBtn.addEventListener('click', async function() {
                        // If playing, stop
                        if (isPlaying) {
                            stopCurrentAudio();
                            return;
                        }

                        // If preloading, do nothing
                        if (isPreloading) return;

                        var selectedVoice = getCurrentVoice();
                        var selectedLang = getCurrentLang();
                        var cacheKey = getCacheKey(selectedVoice, selectedLang);

                        // Check if audio is already cached
                        if (cachedAudio[cacheKey]) {
                            // Instant playback!
                            currentAudio = new Audio(cachedAudio[cacheKey]);
                            
                            currentAudio.onended = function() {
                                currentAudio = null;
                                setPlaying(false);
                            };
                            
                            currentAudio.onerror = function() {
                                currentAudio = null;
                                setPlaying(false);
                            };

                            setPlaying(true);
                            await currentAudio.play();
                            return;
                        }

                        // Fallback: generate on-demand if not cached
                        setLoading(true);

                        try {
                            var tts = await loadTTS();
                            await tts.download(selectedVoice, function(prog) {});

                            var previewText = previewTexts[selectedLang] || previewTexts['en'];
                            var wavBlob = await tts.predict({ 
                                text: previewText, 
                                voiceId: selectedVoice 
                            });

                            var audioUrl = URL.createObjectURL(wavBlob);
                            cachedAudio[cacheKey] = audioUrl; // Cache for next time
                            
                            currentAudio = new Audio(audioUrl);
                            
                            currentAudio.onended = function() {
                                currentAudio = null;
                                setPlaying(false);
                            };
                            
                            currentAudio.onerror = function() {
                                currentAudio = null;
                                setPlaying(false);
                            };

                            setLoading(false);
                            setPlaying(true);
                            await currentAudio.play();
                            
                        } catch (err) {
                            console.error('Voice preview error:', err);
                            setLoading(false);
                            setPlaying(false);
                            alert('<?php echo esc_js( __( 'Failed to generate voice preview. Please try again.', 'speechable' ) ); ?>');
                        }
                    });
                })();
            </script>
        </div>
        <?php
    }

    /**
     * Enqueue editor assets.
     */
    public function enqueue_editor_assets() {
        global $post;
        if ( ! $post ) {
            return;
        }

        $options = wp_parse_args( get_option( 'speechable_options', array() ), $this->get_default_settings() );

        wp_enqueue_script(
            'speechable-editor',
            SPEECHABLE_PLUGIN_URL . 'assets/js/editor.js',
            array( 'wp-plugins', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-data' ),
            SPEECHABLE_VERSION,
            true
        );

        wp_localize_script(
            'speechable-editor',
            'speechableEditor',
            array(
                'ajaxUrl'   => admin_url( 'admin-ajax.php' ),
                'nonce'     => wp_create_nonce( 'speechable_nonce' ),
                'options'   => $options,
                'voices'    => $this->get_voices(),
                'languages' => $this->get_languages(),
                'pluginUrl' => SPEECHABLE_PLUGIN_URL,
            )
        );
    }

    /**
     * Enqueue admin assets.
     *
     * @param string $hook Current admin page.
     */
    public function enqueue_admin_assets( $hook ) {
        if ( 'edit.php' !== $hook ) {
            return;
        }

        $options = wp_parse_args( get_option( 'speechable_options', array() ), $this->get_default_settings() );

        wp_enqueue_style(
            'speechable-admin',
            SPEECHABLE_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            SPEECHABLE_VERSION
        );

        wp_enqueue_script(
            'speechable-list',
            SPEECHABLE_PLUGIN_URL . 'assets/js/list.js',
            array( 'jquery' ),
            SPEECHABLE_VERSION,
            true
        );

        wp_localize_script(
            'speechable-list',
            'speechableList',
            array(
                'ajaxUrl'   => admin_url( 'admin-ajax.php' ),
                'nonce'     => wp_create_nonce( 'speechable_nonce' ),
                'options'   => $options,
                'voices'    => $this->get_voices(),
                'languages' => $this->get_languages(),
            )
        );
    }

    /**
     * Enqueue frontend assets.
     */
    public function enqueue_frontend_assets() {
        if ( ! is_singular() ) {
            return;
        }

        $options   = wp_parse_args( get_option( 'speechable_options', array() ), $this->get_default_settings() );
        $post_type = get_post_type();
        
        // Ensure post_types is an array
        $enabled_types = isset( $options['post_types'] ) ? (array) $options['post_types'] : array( 'post' );

        if ( ! in_array( $post_type, $enabled_types, true ) ) {
            return;
        }

        $post_id = get_the_ID();
        
        // Check both new and old meta keys for backward compatibility
        $audio_data = get_post_meta( $post_id, '_speechable_audio', true );
        if ( empty( $audio_data ) ) {
            $audio_data = get_post_meta( $post_id, 'piper_tts_audio', true );
        }

        if ( empty( $audio_data ) ) {
            return;
        }

        wp_enqueue_style(
            'speechable-player',
            SPEECHABLE_PLUGIN_URL . 'assets/css/player.css',
            array(),
            SPEECHABLE_VERSION
        );

        wp_enqueue_script(
            'speechable-player',
            SPEECHABLE_PLUGIN_URL . 'assets/js/player.js',
            array(),
            SPEECHABLE_VERSION,
            true
        );

        wp_localize_script(
            'speechable-player',
            'speechablePlayer',
            array(
                'options' => $options,
                'postId'  => $post_id,
            )
        );

        $custom_css = sprintf(
            '.speechable-player {
                --speechable-bg: %s;
                --speechable-text: %s;
                --speechable-button: %s;
                --speechable-progress: %s;
                --speechable-highlight: %s;
                --speechable-radius: %dpx;
            }',
            esc_attr( $options['color_player_bg'] ),
            esc_attr( $options['color_text'] ),
            esc_attr( $options['color_button'] ),
            esc_attr( $options['color_progress'] ),
            esc_attr( $options['color_highlight'] ),
            absint( $options['border_radius'] )
        );

        wp_add_inline_style( 'speechable-player', $custom_css );
    }

    /**
     * Add audio player to content.
     *
     * @param string $content Post content.
     * @return string Modified content.
     */
    public function add_audio_player( $content ) {
        if ( ! is_singular() ) {
            return $content;
        }

        $options   = wp_parse_args( get_option( 'speechable_options', array() ), $this->get_default_settings() );
        $post_type = get_post_type();
        
        // Ensure post_types is an array
        $enabled_types = isset( $options['post_types'] ) ? (array) $options['post_types'] : array( 'post' );

        if ( ! in_array( $post_type, $enabled_types, true ) ) {
            return $content;
        }

        $post_id = get_the_ID();
        
        // Check both new and old meta keys for backward compatibility
        $audio_data = get_post_meta( $post_id, '_speechable_audio', true );
        if ( empty( $audio_data ) ) {
            $audio_data = get_post_meta( $post_id, 'piper_tts_audio', true );
        }

        if ( empty( $audio_data ) ) {
            return $content;
        }

        // Get word timings (check both keys)
        $word_timings = get_post_meta( $post_id, '_speechable_word_timings', true );
        if ( empty( $word_timings ) ) {
            $word_timings = get_post_meta( $post_id, 'piper_tts_word_timings', true );
        }

        $player_html = sprintf(
            '<div class="speechable-player" data-audio="%s" data-timings="%s" data-highlighting="%s" data-autoscroll="%s">
                <button class="speechable-play" aria-label="%s">
                    <svg class="icon-play" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    <svg class="icon-pause" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                </button>
                <div class="speechable-progress-wrap">
                    <div class="speechable-progress-bar"><div class="speechable-progress-fill"></div></div>
                </div>
                <span class="speechable-time">0:00</span>
                <span class="speechable-duration">0:00</span>
                <button class="speechable-speed" aria-label="%s">1x</button>
                <button class="speechable-download" aria-label="%s" title="%s">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
            </div>',
            esc_attr( $audio_data ),
            esc_attr( $word_timings ),
            esc_attr( $options['word_highlighting'] ? 'true' : 'false' ),
            esc_attr( $options['auto_scroll'] ? 'true' : 'false' ),
            esc_attr__( 'Play audio', 'speechable' ),
            esc_attr__( 'Playback speed', 'speechable' ),
            esc_attr__( 'Download audio', 'speechable' ),
            esc_attr__( 'Download audio', 'speechable' )
        );

        if ( 'before' === $options['player_position'] ) {
            return $player_html . $content;
        }

        return $content . $player_html;
    }

    /**
     * AJAX: Save audio.
     */
    public function ajax_save_audio() {
        check_ajax_referer( 'speechable_nonce', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_send_json_error( __( 'Permission denied.', 'speechable' ) );
        }

        $post_id = isset( $_POST['post_id'] ) ? absint( $_POST['post_id'] ) : 0;

        if ( ! $post_id || ! current_user_can( 'edit_post', $post_id ) ) {
            wp_send_json_error( __( 'Invalid post.', 'speechable' ) );
        }

        // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Base64 audio data.
        $audio_data   = isset( $_POST['audio_data'] ) ? wp_unslash( $_POST['audio_data'] ) : '';
        $word_timings = isset( $_POST['word_timings'] ) ? sanitize_text_field( wp_unslash( $_POST['word_timings'] ) ) : '';

        update_post_meta( $post_id, '_speechable_audio', $audio_data );

        if ( ! empty( $word_timings ) ) {
            update_post_meta( $post_id, '_speechable_word_timings', $word_timings );
        }

        wp_send_json_success( array( 'message' => __( 'Audio saved.', 'speechable' ) ) );
    }

    /**
     * AJAX: Delete audio.
     */
    public function ajax_delete_audio() {
        check_ajax_referer( 'speechable_nonce', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_send_json_error( __( 'Permission denied.', 'speechable' ) );
        }

        $post_id = isset( $_POST['post_id'] ) ? absint( $_POST['post_id'] ) : 0;

        if ( ! $post_id || ! current_user_can( 'edit_post', $post_id ) ) {
            wp_send_json_error( __( 'Invalid post.', 'speechable' ) );
        }

        delete_post_meta( $post_id, '_speechable_audio' );
        delete_post_meta( $post_id, '_speechable_word_timings' );

        wp_send_json_success( array( 'message' => __( 'Audio deleted.', 'speechable' ) ) );
    }

    /**
     * AJAX: Get post content.
     */
    public function ajax_get_post_content() {
        check_ajax_referer( 'speechable_nonce', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_send_json_error( __( 'Permission denied.', 'speechable' ) );
        }

        $post_id = isset( $_POST['post_id'] ) ? absint( $_POST['post_id'] ) : 0;
        $post    = get_post( $post_id );

        if ( ! $post || ! current_user_can( 'edit_post', $post_id ) ) {
            wp_send_json_error( __( 'Post not found.', 'speechable' ) );
        }

        $content  = $post->post_title . '. ';
        $content .= wp_strip_all_tags( $post->post_content );
        $content  = preg_replace( '/\s+/', ' ', $content );
        $content  = trim( $content );

        $has_audio = ! empty( get_post_meta( $post_id, '_speechable_audio', true ) );

        wp_send_json_success(
            array(
                'content'  => $content,
                'title'    => $post->post_title,
                'hasAudio' => $has_audio,
            )
        );
    }
}

// Initialize plugin.
Speechable::get_instance();
