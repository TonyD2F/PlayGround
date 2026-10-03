<?php
/**
 * MCP JSON-RPC server over WordPress REST (Streamable HTTP style).
 *
 * Endpoint:  POST /wp-json/mcp/v1        (primary)
 *            POST /wp-json/mcp/v1/mcp    (alias)
 *            GET  /wp-json/mcp/v1        (server info, auth optional)
 *            GET  /wp-json/mcp/v1/manifest (agent discovery)
 *
 * Implements: initialize, ping, tools/list, tools/call,
 *             resources/list, resources/read, prompts/list, prompts/get
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class MCP_Bridge_Server {

    private static $instance = null;

    public static function instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action( 'rest_api_init', array( $this, 'routes' ) );
    }

    public function routes() {
        // Primary Streamable-HTTP style single endpoint.
        register_rest_route( MCP_BRIDGE_NAMESPACE, '/', array(
            array(
                'methods'             => 'POST',
                'callback'            => array( $this, 'handle_rpc' ),
                'permission_callback' => array( $this, 'can_access' ),
            ),
            array(
                'methods'             => 'GET',
                'callback'            => array( $this, 'server_info' ),
                'permission_callback' => '__return_true',
            ),
        ) );
        // Explicit alias many clients prefer.
        register_rest_route( MCP_BRIDGE_NAMESPACE, '/mcp', array(
            array(
                'methods'             => 'POST',
                'callback'            => array( $this, 'handle_rpc' ),
                'permission_callback' => array( $this, 'can_access' ),
            ),
            array(
                'methods'             => 'GET',
                'callback'            => array( $this, 'server_info' ),
                'permission_callback' => '__return_true',
            ),
        ) );
        // Simple non-JSON-RPC helper for dumb HTTP agents: { tool, arguments }.
        register_rest_route( MCP_BRIDGE_NAMESPACE, '/call', array(
            'methods'             => 'POST',
            'callback'            => array( $this, 'handle_simple_call' ),
            'permission_callback' => array( $this, 'can_access' ),
        ) );
        register_rest_route( MCP_BRIDGE_NAMESPACE, '/manifest', array(
            'methods'             => 'GET',
            'callback'            => array( $this, 'manifest' ),
            'permission_callback' => '__return_true',
        ) );
    }

    public function can_access() {
        // Auth already resolved via determine_current_user; re-check admin.
        if ( current_user_can( 'manage_options' ) || current_user_can( 'edit_posts' ) ) {
            return true;
        }
        return new WP_Error(
            'mcp_unauthorized',
            'Missing or invalid MCP key. Send "Authorization: Bearer KEY" or "X-MCP-Key: KEY".',
            array( 'status' => 401 )
        );
    }

    public function server_info() {
        return rest_ensure_response( array(
            'name'             => 'wordpress-mcp-full-bridge',
            'version'          => MCP_BRIDGE_VERSION,
            'protocolVersion'  => MCP_BRIDGE_PROTOCOL_VERSION,
            'transport'        => 'streamable-http',
            'endpoint'         => rest_url( MCP_BRIDGE_NAMESPACE . '/' ),
            'requires_auth'    => true,
            'auth'             => 'Send header Authorization: Bearer <mcp_live_...> or X-MCP-Key: <key>',
            'docs'             => rest_url( MCP_BRIDGE_NAMESPACE . '/manifest' ),
        ) );
    }

    public function manifest() {
        return rest_ensure_response( array(
            'name'        => 'wordpress-mcp-full-bridge',
            'version'     => MCP_BRIDGE_VERSION,
            'mcp'         => array( 'protocolVersion' => MCP_BRIDGE_PROTOCOL_VERSION ),
            'transports'  => array( 'streamable-http' ),
            'endpoints'   => array(
                'rpc'      => rest_url( MCP_BRIDGE_NAMESPACE . '/' ),
                'rpcAlias' => rest_url( MCP_BRIDGE_NAMESPACE . '/mcp' ),
                'simple'   => rest_url( MCP_BRIDGE_NAMESPACE . '/call' ),
            ),
            'auth'        => array( 'type' => 'bearer', 'header' => 'Authorization', 'alt_header' => 'X-MCP-Key' ),
            'tools_count' => count( MCP_Bridge_Tools::definitions() ),
            'tools'       => array_map( function ( $t ) {
                return array( 'name' => $t['name'], 'description' => $t['description'] );
            }, MCP_Bridge_Tools::definitions() ),
        ) );
    }

    /**
     * Dumb-agent helper: POST { "tool": "posts_list", "arguments": {...} }
     */
    public function handle_simple_call( WP_REST_Request $req ) {
        $tool = sanitize_text_field( $req->get_param( 'tool' ) ?? '' );
        $args = $req->get_param( 'arguments' );
        if ( ! is_array( $args ) ) {
            $args = array();
        }
        if ( $tool === '' ) {
            return new WP_Error( 'mcp_bad_request', 'Provide { "tool": "...", "arguments": {...} }.', array( 'status' => 400 ) );
        }
        try {
            $result = MCP_Bridge_Tools::call( $tool, $args );
            $this->log_call( $tool, true );
            return rest_ensure_response( array( 'tool' => $tool, 'result' => $result ) );
        } catch ( Exception $e ) {
            $this->log_call( $tool, false );
            return new WP_Error( 'mcp_tool_error', $e->getMessage(), array( 'status' => $this->code( $e ) ) );
        }
    }

    /**
     * Main JSON-RPC 2.0 handler. Supports single object + batch array.
     */
    public function handle_rpc( WP_REST_Request $req ) {
        $body = $req->get_json_params();
        if ( empty( $body ) ) {
            // Fall back to raw body parse (some clients send text/plain).
            $raw  = $req->get_body();
            $body = json_decode( $raw, true );
        }
        if ( empty( $body ) ) {
            return $this->rpc_error( null, -32700, 'Parse error: send JSON-RPC 2.0 {jsonrpc, id, method, params}.' );
        }
        // Batch?
        if ( is_array( $body ) && array_keys( $body ) === range( 0, count( $body ) - 1 ) ) {
            $out = array();
            foreach ( $body as $single ) {
                $r = $this->dispatch( $single );
                if ( $r !== null ) {
                    $out[] = $r;
                }
            }
            return rest_ensure_response( $out );
        }
        $res = $this->dispatch( $body );
        if ( $res === null ) {
            // Notification — 202 empty.
            return new WP_REST_Response( null, 202 );
        }
        // MCP Streamable HTTP wants JSON; WP REST will encode.
        return rest_ensure_response( $res );
    }

    private function dispatch( $msg ) {
        if ( ! is_array( $msg ) ) {
            return $this->rpc_error( null, -32600, 'Invalid Request.' );
        }
        $id     = array_key_exists( 'id', $msg ) ? $msg['id'] : null;
        $method = $msg['method'] ?? '';
        $params = $msg['params'] ?? array();
        if ( ! is_array( $params ) ) {
            $params = array();
        }
        // Notifications (no id) -> no response, except initialize echo not needed.
        $is_notification = ! array_key_exists( 'id', $msg ) || $msg['id'] === null;

        try {
            switch ( $method ) {
                case 'initialize':
                    $result = array(
                        'protocolVersion' => MCP_BRIDGE_PROTOCOL_VERSION,
                        'capabilities'    => array(
                            'tools'     => array( 'listChanged' => false ),
                            'resources' => array( 'listChanged' => false ),
                            'prompts'   => array( 'listChanged' => false ),
                        ),
                        'serverInfo'      => array( 'name' => 'wordpress-mcp-full-bridge', 'version' => MCP_BRIDGE_VERSION ),
                    );
                    break;

                case 'notifications/initialized':
                    return null; // ack, no body.

                case 'ping':
                    $result = array( 'ok' => true, 'time' => gmdate( 'c' ) );
                    break;

                case 'tools/list':
                    $result = array( 'tools' => MCP_Bridge_Tools::definitions() );
                    break;

                case 'tools/call':
                    $tool = $params['name'] ?? '';
                    $args = $params['arguments'] ?? array();
                    if ( ! is_array( $args ) ) {
                        $args = array();
                    }
                    if ( $tool === '' ) {
                        throw new Exception( 'tools/call requires params.name.', -32602 );
                    }
                    $data   = MCP_Bridge_Tools::call( sanitize_text_field( $tool ), $args );
                    $this->log_call( $tool, true );
                    $result = array(
                        'content' => array(
                            array( 'type' => 'text', 'text' => wp_json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) ),
                        ),
                        'isError' => false,
                    );
                    break;

                case 'resources/list':
                    $result = array( 'resources' => $this->resources() );
                    break;

                case 'resources/read':
                    $result = $this->resource_read( $params['uri'] ?? '' );
                    break;

                case 'prompts/list':
                    $result = array( 'prompts' => $this->prompts() );
                    break;

                case 'prompts/get':
                    $result = $this->prompt_get( $params['name'] ?? '', $params['arguments'] ?? array() );
                    break;

                default:
                    if ( $is_notification && strpos( $method, 'notifications/' ) === 0 ) {
                        return null;
                    }
                    return $this->rpc_error( $id, -32601, 'Method not found: ' . $method );
            }
        } catch ( Exception $e ) {
            // Tool runtime errors should be returned as isError content, not JSON-RPC error,
            // per MCP spec — except auth/permission which stay transport errors.
            $code = $e->getCode();
            $msg  = $e->getMessage();
            if ( isset( $msg ) && ( $code === 401 || $code === 403 ) ) {
                return $this->rpc_error( $id, $code === 401 ? -32001 : -32003, $msg );
            }
            if ( $method === 'tools/call' ) {
                $this->log_call( $params['name'] ?? '?', false );
                return $this->rpc_ok( $id, array(
                    'content' => array( array( 'type' => 'text', 'text' => 'Error: ' . $msg ) ),
                    'isError' => true,
                ) );
            }
            $this->log_call( $method, false );
            return $this->rpc_error( $id, -32000, $msg );
        }

        if ( $is_notification ) {
            return null;
        }
        return $this->rpc_ok( $id, $result ?? array() );
    }

    private function rpc_ok( $id, $result ) {
        return array( 'jsonrpc' => '2.0', 'id' => $id, 'result' => $result );
    }

    private function rpc_error( $id, $code, $message ) {
        $resp = array( 'jsonrpc' => '2.0', 'id' => $id, 'error' => array( 'code' => (int) $code, 'message' => (string) $message ) );
        // Return as data; WP REST status stays 200 for JSON-RPC errors (spec), except auth.
        if ( $code === -32001 ) {
            return new WP_Error( 'mcp_unauthorized', $message, array( 'status' => 401 ) );
        }
        return $resp;
    }

    private function code( $e ) {
        $c = (int) $e->getCode();
        return ( $c >= 400 && $c < 599 ) ? $c : 400;
    }

    private function resources() {
        return array(
            array( 'uri' => 'site://info', 'name' => 'Site info', 'mimeType' => 'application/json', 'description' => 'Name, URLs, versions, counts.' ),
            array( 'uri' => 'posts://recent', 'name' => 'Recent posts', 'mimeType' => 'application/json', 'description' => '10 most recent published posts.' ),
            array( 'uri' => 'users://me', 'name' => 'Current agent identity', 'mimeType' => 'application/json', 'description' => 'The WP user this API key acts as.' ),
        );
    }

    private function resource_read( $uri ) {
        switch ( $uri ) {
            case 'site://info':
                $data = MCP_Bridge_Tools::call( 'site_info', array() );
                break;
            case 'posts://recent':
                $data = MCP_Bridge_Tools::call( 'posts_list', array( 'per_page' => 10 ) );
                break;
            case 'users://me':
                $u = wp_get_current_user();
                $data = $u ? array( 'id' => $u->ID, 'login' => $u->user_login, 'roles' => $u->roles ) : null;
                break;
            default:
                throw new Exception( 'Unknown resource URI: ' . $uri );
        }
        return array( 'contents' => array(
            array( 'uri' => $uri, 'mimeType' => 'application/json', 'text' => wp_json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) ),
        ) );
    }

    private function prompts() {
        return array(
            array( 'name' => 'write_post', 'description' => 'Draft a new blog post.', 'arguments' => array(
                array( 'name' => 'topic', 'description' => 'Post topic.', 'required' => true ),
            ) ),
            array( 'name' => 'site_audit', 'description' => 'Summarize site health + content stats.', 'arguments' => array() ),
        );
    }

    private function prompt_get( $name, $args ) {
        if ( $name === 'write_post' ) {
            $topic = sanitize_text_field( $args['topic'] ?? 'news' );
            return array( 'messages' => array(
                array( 'role' => 'user', 'content' => array( 'type' => 'text', 'text' => "Write a full WordPress post about: {$topic}. Then call posts_create with title+content, status=draft unless asked to publish." ) ),
            ) );
        }
        if ( $name === 'site_audit' ) {
            return array( 'messages' => array(
                array( 'role' => 'user', 'content' => array( 'type' => 'text', 'text' => 'Call site_info, health_check, posts_list (per_page=5), plugins_list and summarize health + next actions.' ) ),
            ) );
        }
        throw new Exception( 'Unknown prompt: ' . $name );
    }

    private function log_call( $tool, $ok ) {
        $settings = function_exists( 'mcp_bridge_get_settings' ) ? mcp_bridge_get_settings() : array( 'log_last' => 200 );
        $max = max( 20, min( 1000, (int) ( $settings['log_last'] ?? 200 ) ) );
        $log = get_option( 'mcp_bridge_log', array() );
        if ( ! is_array( $log ) ) {
            $log = array();
        }
        $log[] = array( 't' => time(), 'tool' => sanitize_text_field( $tool ), 'ok' => (bool) $ok, 'user' => get_current_user_id() );
        if ( count( $log ) > $max ) {
            $log = array_slice( $log, -$max );
        }
        update_option( 'mcp_bridge_log', $log, false );
    }

    private function code_unused() {}
}
