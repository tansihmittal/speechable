<?php
/**
 * Speechable Uninstall
 *
 * Fired when the plugin is uninstalled.
 *
 * @package Speechable
 */

// If uninstall not called from WordPress, exit.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Security check - verify we're uninstalling this specific plugin.
if ( ! current_user_can( 'activate_plugins' ) ) {
	exit;
}

// Delete plugin options.
delete_option( 'speechable_options' );

// Delete all post meta created by the plugin.
delete_post_meta_by_key( '_speechable_audio' );
delete_post_meta_by_key( '_speechable_word_timings' );

// Also delete legacy meta keys if they exist.
delete_post_meta_by_key( 'piper_tts_audio' );
delete_post_meta_by_key( 'piper_tts_word_timings' );

// Clear any cached data.
wp_cache_flush();
