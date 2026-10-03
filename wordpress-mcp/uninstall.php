<?php
// Uninstall cleanup.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}
delete_option( 'mcp_bridge_keys' );
delete_option( 'mcp_bridge_settings' );
delete_option( 'mcp_bridge_allow_cors' );
delete_option( 'mcp_bridge_log' );
