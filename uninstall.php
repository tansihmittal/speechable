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
global $wpdb;

// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->delete(
	$wpdb->postmeta,
	array( 'meta_key' => '_speechable_audio' ),
	array( '%s' )
);

// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->delete(
	$wpdb->postmeta,
	array( 'meta_key' => '_speechable_word_timings' ),
	array( '%s' )
);

// Clear any cached data.
wp_cache_flush();
