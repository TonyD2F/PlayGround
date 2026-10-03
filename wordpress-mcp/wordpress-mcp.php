<?php
/**
 * Plugin Name:       MCP Full Bridge — Agent Connect
 * Plugin URI:        https://example.com/mcp-full-bridge
 * Description:       Model Context Protocol (MCP) server for WordPress. Lets any MCP-compatible AI agent (Claude Desktop, Cursor, OpenAI, custom scripts) connect with FULL site abilities via a secure API key. Posts, pages, media, users, comments, settings, plugins, themes + gated advanced tools.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            MCP Bridge
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       mcp-full-bridge
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'MCP_BRIDGE_VERSION', '1.0.0' );
define( 'MCP_BRIDGE_FILE', __FILE__ );
define( 'MCP_BRIDGE_DIR', plugin_dir_path( __FILE__ ) );
define( 'MCP_BRIDGE_URL', plugin_dir_url( __FILE__ ) );
define( 'MCP_BRIDGE_NAMESPACE', 'mcp/v1' );
define( 'MCP_BRIDGE_PROTOCOL_VERSION', '2024-11-05' );

// Optional hard kill-switches in wp-config.php:
// define( 'MCP_ALLOW_PHP', false );        // allow eval_php tool (default false, DANGEROUS)
// define( 'MCP_ALLOW_SQL_WRITE', false );  // allow INSERT/UPDATE/DELETE via sql_query (default false)
// define( 'MCP_DISABLE', true );            // disable the whole endpoint in an emergency
if ( ! defined( 'MCP_ALLOW_PHP' ) ) {
    define( 'MCP_ALLOW_PHP', false );
}
if ( ! defined( 'MCP_ALLOW_SQL_WRITE' ) ) {
    define( 'MCP_ALLOW_SQL_WRITE', false );
}

require_once MCP_BRIDGE_DIR . 'includes/class-mcp-auth.php';
require_once MCP_BRIDGE_DIR . 'includes/class-mcp-tools.php';
require_once MCP_BRIDGE_DIR . 'includes/class-mcp-server.php';
require_once MCP_BRIDGE_DIR . 'includes/class-mcp-admin.php';

/**
 * Boot.
 */
function mcp_bridge_boot() {
    MCP_Bridge_Auth::instance();
    MCP_Bridge_Server::instance();
    if ( is_admin() ) {
        MCP_Bridge_Admin::instance();
    }
    // CORS preflight support for browser-based agents.
    add_action( 'init', 'mcp_bridge_cors_headers', 5 );
}
add_action( 'plugins_loaded', 'mcp_bridge_boot' );

function mcp_bridge_cors_headers() {
    if ( ! get_option( 'mcp_bridge_allow_cors', 1 ) ) {
        return;
    }
    if ( ! isset( $_SERVER['REQUEST_URI'] ) ) {
        return;
    }
    $uri = sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) );
    if ( strpos( $uri, '/wp-json/mcp/' ) === false ) {
        return;
    }
    // Allow any agent origin by default (key still required). Lock down via filter if needed.
    $origin = apply_filters( 'mcp_bridge_cors_origin', '*' );
    header( 'Access-Control-Allow-Origin: ' . $origin );
    header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE' );
    header( 'Access-Control-Allow-Headers: Authorization, X-MCP-Key, Content-Type, Mcp-Session-Id' );
    header( 'Access-Control-Expose-Headers: Mcp-Session-Id' );
    if ( isset( $_SERVER['REQUEST_METHOD'] ) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS' ) {
        status_header( 200 );
        exit;
    }
}

/**
 * Activation: seed defaults.
 */
function mcp_bridge_activate() {
    if ( ! get_option( 'mcp_bridge_settings', false ) ) {
        add_option( 'mcp_bridge_settings', array(
            'enabled'            => 1,
            'allow_cors'         => 1,
            'allow_sql_write'    => 0,
            'allow_php'          => 0,
            'allow_plugin_admin' => 1,
            'rate_limit'         => 120, // requests per minute per key
            'log_last'           => 200,
        ) );
    }
    if ( get_option( 'mcp_bridge_allow_cors', null ) === null ) {
        add_option( 'mcp_bridge_allow_cors', 1 );
    }
}
register_activation_hook( __FILE__, 'mcp_bridge_activate' );

/**
 * Helper: get plugin settings merged with defaults.
 */
function mcp_bridge_get_settings() {
    $defaults = array(
        'enabled'            => 1,
        'allow_cors'         => 1,
        'allow_sql_write'    => 0,
        'allow_php'          => 0,
        'allow_plugin_admin' => 1,
        'rate_limit'         => 120,
        'log_last'           => 200,
    );
    $saved = get_option( 'mcp_bridge_settings', array() );
    if ( ! is_array( $saved ) ) {
        $saved = array();
    }
    return array_merge( $defaults, $saved );
}
