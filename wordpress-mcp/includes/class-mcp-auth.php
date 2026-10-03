<?php
/**
 * API-key authentication for MCP agents.
 *
 * Keys are shown ONCE at creation:  mcp_live_<random>.
 * Only a SHA-256 hash is stored in `mcp_bridge_keys` option.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class MCP_Bridge_Auth {

    private static $instance = null;
    private $authed_key = null;
    private $authed_user_id = 0;

    public static function instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        // Run early on REST requests so wp_get_current_user() is correct.
        add_filter( 'determine_current_user', array( $this, 'authenticate' ), 20 );
        add_filter( 'rest_authentication_errors', array( $this, 'check_auth_error' ), 20 );
    }

    /**
     * Extract raw key from request.
     */
    public function get_raw_key() {
        // 1. Authorization: Bearer xxx
        if ( isset( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
            $h = trim( wp_unslash( $_SERVER['HTTP_AUTHORIZATION'] ) );
            if ( stripos( $h, 'Bearer ' ) === 0 ) {
                return trim( substr( $h, 7 ) );
            }
        }
        // Some hosts strip Authorization -> check X-HTTP variant + getallheaders fallback.
        if ( function_exists( 'getallheaders' ) ) {
            $headers = getallheaders();
            foreach ( array( 'Authorization', 'authorization', 'X-MCP-Key', 'x-mcp-key' ) as $k ) {
                if ( isset( $headers[ $k ] ) ) {
                    $v = trim( $headers[ $k ] );
                    if ( stripos( $v, 'Bearer ' ) === 0 ) {
                        return trim( substr( $v, 7 ) );
                    }
                    if ( strpos( $k, 'MCP' ) !== false || strpos( $k, 'mcp' ) !== false ) {
                        return $v;
                    }
                }
            }
        }
        if ( isset( $_SERVER['HTTP_X_MCP_KEY'] ) ) {
            return trim( wp_unslash( $_SERVER['HTTP_X_MCP_KEY'] ) );
        }
        // 2. Query param fallback (convenient for quick scripts; prefer header).
        if ( isset( $_REQUEST['mcp_key'] ) ) {
            return trim( sanitize_text_field( wp_unslash( $_REQUEST['mcp_key'] ) ) );
        }
        return '';
    }

    /**
     * WordPress hook: resolve user from API key.
     */
    public function authenticate( $user_id ) {
        if ( ! $this->is_mcp_request() ) {
            return $user_id;
        }
        if ( defined( 'MCP_DISABLE' ) && MCP_DISABLE ) {
            return $user_id;
        }
        $settings = function_exists( 'mcp_bridge_get_settings' ) ? mcp_bridge_get_settings() : array( 'enabled' => 1 );
        if ( empty( $settings['enabled'] ) ) {
            return $user_id;
        }

        // Logged-in admins (cookie + nonce) are already fine — let WP handle them.
        if ( $user_id && user_can( $user_id, 'manage_options' ) ) {
            $this->authed_user_id = (int) $user_id;
            return $user_id;
        }

        $raw = $this->get_raw_key();
        if ( $raw === '' ) {
            return $user_id; // Let permission_callback return 401 with helpful message.
        }

        $match = $this->find_key( $raw );
        if ( ! $match ) {
            return $user_id;
        }

        $uid = (int) $match['user_id'];
        $u   = get_user_by( 'id', $uid );
        if ( ! $u ) {
            return $user_id;
        }
        // Key owner must still be an admin. Prevents privilege persistence after demotion.
        if ( ! user_can( $uid, 'manage_options' ) ) {
            return $user_id;
        }

        // Rate limit.
        if ( ! $this->rate_limit_ok( $match ) ) {
            // Store flag so check_auth_error can surface 429.
            $this->authed_key = array_merge( $match, array( '_rate_limited' => true ) );
            return $user_id;
        }

        $this->authed_key     = $match;
        $this->authed_user_id = $uid;
        $this->touch_key( $match['id'] );

        wp_set_current_user( $uid );
        return $uid;
    }

    public function check_auth_error( $error ) {
        if ( ! $this->is_mcp_request() ) {
            return $error;
        }
        if ( ! empty( $error ) ) {
            return $error;
        }
        if ( $this->authed_user_id && user_can( $this->authed_user_id, 'manage_options' ) ) {
            return $error;
        }
        // Rate limited?
        if ( $this->authed_key && ! empty( $this->authed_key['_rate_limited'] ) ) {
            return new WP_Error( 'mcp_rate_limited', 'MCP rate limit exceeded. Slow down.', array( 'status' => 429 ) );
        }
        return new WP_Error(
            'mcp_unauthorized',
            'Missing or invalid MCP key. Add header "Authorization: Bearer YOUR_KEY" or "X-MCP-Key: YOUR_KEY". Create one under WP Admin > Settings > MCP Bridge.',
            array( 'status' => 401 )
        );
    }

    public function is_mcp_request() {
        if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
            // Check route if available.
            if ( isset( $GLOBALS['wp']->query_vars['rest_route'] ) ) {
                $r = $GLOBALS['wp']->query_vars['rest_route'];
                if ( is_string( $r ) && strpos( $r, '/mcp/' ) !== false ) {
                    return true;
                }
            }
            if ( isset( $_SERVER['REQUEST_URI'] ) ) {
                $uri = wp_unslash( $_SERVER['REQUEST_URI'] );
                if ( strpos( $uri, '/mcp/' ) !== false ) {
                    return true;
                }
            }
            return false;
        }
        if ( isset( $_SERVER['REQUEST_URI'] ) ) {
            $uri = wp_unslash( $_SERVER['REQUEST_URI'] );
            if ( strpos( $uri, '/wp-json/mcp' ) !== false || strpos( $uri, 'rest_route=/mcp' ) !== false ) {
                return true;
            }
        }
        return false;
    }

    public function current_key() {
        return $this->authed_key;
    }

    // ---------- key storage ----------

    public function get_keys() {
        $keys = get_option( 'mcp_bridge_keys', array() );
        return is_array( $keys ) ? $keys : array();
    }

    public function find_key( $raw ) {
        $keys = $this->get_keys();
        $hash = hash( 'sha256', $raw );
        foreach ( $keys as $k ) {
            if ( isset( $k['hash'] ) && hash_equals( (string) $k['hash'], $hash ) ) {
                return $k;
            }
            // Back-compat: prefix match for older plain-prefix keys (never store plain).
            if ( isset( $k['prefix'] ) && $k['prefix'] !== '' && strpos( $raw, $k['prefix'] ) === 0 && isset( $k['hash'] ) && $k['hash'] === $hash ) {
                return $k;
            }
        }
        return null;
    }

    /**
     * Create a new key. Returns array with 'key' (show once) + 'record'.
     */
    public function create_key( $name, $user_id ) {
        $name    = sanitize_text_field( $name );
        $user_id = (int) $user_id;
        if ( $name === '' ) {
            $name = 'Agent key ' . gmdate( 'Y-m-d H:i' );
        }
        $u = get_user_by( 'id', $user_id );
        if ( ! $u ) {
            return new WP_Error( 'mcp_bad_user', 'User not found.' );
        }
        if ( ! user_can( $user_id, 'manage_options' ) ) {
            return new WP_Error( 'mcp_not_admin', 'Key owner must be an administrator (manage_options).' );
        }
        try {
            $rand = bin2hex( random_bytes( 24 ) ); // 48 hex chars
        } catch ( Exception $e ) {
            $rand = md5( uniqid( wp_rand(), true ) . microtime( true ) );
        }
        $raw    = 'mcp_live_' . $rand;
        $record = array(
            'id'         => 'key_' . substr( md5( $raw ), 0, 12 ) . '_' . time(),
            'name'       => $name,
            'hash'       => hash( 'sha256', $raw ),
            'prefix'     => substr( $raw, 0, 12 ) . '…',
            'user_id'    => $user_id,
            'created'    => time(),
            'last_used'  => 0,
            'use_count'  => 0,
        );
        $keys     = $this->get_keys();
        $keys[]   = $record;
        update_option( 'mcp_bridge_keys', $keys, false );
        return array( 'key' => $raw, 'record' => $record );
    }

    public function revoke_key( $id ) {
        $keys = $this->get_keys();
        $kept = array();
        foreach ( $keys as $k ) {
            if ( (string) $k['id'] !== (string) $id ) {
                $kept[] = $k;
            }
        }
        update_option( 'mcp_bridge_keys', array_values( $kept ), false );
        return true;
    }

    private function touch_key( $id ) {
        $keys = $this->get_keys();
        foreach ( $keys as &$k ) {
            if ( (string) $k['id'] === (string) $id ) {
                $k['last_used'] = time();
                $k['use_count'] = isset( $k['use_count'] ) ? (int) $k['use_count'] + 1 : 1;
            }
        }
        update_option( 'mcp_bridge_keys', $keys, false );
    }

    private function rate_limit_ok( $key ) {
        $settings = function_exists( 'mcp_bridge_get_settings' ) ? mcp_bridge_get_settings() : array( 'rate_limit' => 120 );
        $limit    = max( 10, (int) ( $settings['rate_limit'] ?? 120 ) );
        $bucket   = 'mcp_rl_' . md5( $key['id'] );
        $window   = 60;
        $data     = get_transient( $bucket );
        $now      = time();
        if ( ! is_array( $data ) ) {
            $data = array( 'count' => 0, 'start' => $now );
        }
        if ( $now - (int) $data['start'] >= $window ) {
            $data = array( 'count' => 0, 'start' => $now );
        }
        $data['count']++;
        set_transient( $bucket, $data, $window );
        return $data['count'] <= $limit;
    }
}
