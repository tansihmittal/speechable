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

// Delete plugin options.
delete_option( 'speechable_options' );

// Delete all post meta created by the plugin.
delete_post_meta_by_key( '_speechable_audio' );
delete_post_meta_by_key( '_speechable_word_timings' );

// Clear any cached data.
wp_cache_flush();
