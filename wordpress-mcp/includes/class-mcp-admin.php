<?php
/**
 * Admin settings page: keys, toggles, connection help.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class MCP_Bridge_Admin {

    private static $instance = null;
    private $revealed_key = '';

    public static function instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action( 'admin_menu', array( $this, 'menu' ) );
        add_action( 'admin_init', array( $this, 'handle_actions' ) );
        add_filter( 'plugin_action_links_' . plugin_basename( MCP_BRIDGE_FILE ), array( $this, 'action_links' ) );
    }

    public function action_links( $links ) {
        $links[] = '<a href="' . esc_url( admin_url( 'options-general.php?page=mcp-bridge' ) ) . '">Settings</a>';
        return $links;
    }

    public function menu() {
        add_options_page(
            'MCP Bridge',
            'MCP Bridge',
            'manage_options',
            'mcp-bridge',
            array( $this, 'page' )
        );
    }

    public function handle_actions() {
        if ( ! isset( $_GET['page'] ) || $_GET['page'] !== 'mcp-bridge' ) {
            return;
        }
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }
        // Create key.
        if ( isset( $_POST['mcp_new_key'] ) && check_admin_referer( 'mcp_bridge_keys' ) ) {
            $name = sanitize_text_field( wp_unslash( $_POST['mcp_key_name'] ?? 'Agent key' ) );
            $uid  = (int) ( $_POST['mcp_key_user'] ?? get_current_user_id() );
            $res  = MCP_Bridge_Auth::instance()->create_key( $name, $uid );
            if ( is_wp_error( $res ) ) {
                add_settings_error( 'mcp_bridge', 'mcp_err', $res->get_error_message(), 'error' );
            } else {
                $this->revealed_key = $res['key'];
                add_settings_error( 'mcp_bridge', 'mcp_ok', 'Key created. Copy it NOW — it will never be shown again.', 'success' );
            }
        }
        // Revoke.
        if ( isset( $_GET['revoke'] ) && check_admin_referer( 'mcp_revoke_' . $_GET['revoke'] ) ) {
            MCP_Bridge_Auth::instance()->revoke_key( sanitize_text_field( wp_unslash( $_GET['revoke'] ) ) );
            wp_safe_redirect( admin_url( 'options-general.php?page=mcp-bridge' ) );
            exit;
        }
        // Settings.
        if ( isset( $_POST['mcp_save_settings'] ) && check_admin_referer( 'mcp_bridge_settings' ) ) {
            $s = array(
                'enabled'            => ! empty( $_POST['enabled'] ) ? 1 : 0,
                'allow_cors'         => ! empty( $_POST['allow_cors'] ) ? 1 : 0,
                'allow_sql_write'    => ! empty( $_POST['allow_sql_write'] ) ? 1 : 0,
                'allow_php'          => ! empty( $_POST['allow_php'] ) ? 1 : 0,
                'allow_plugin_admin' => ! empty( $_POST['allow_plugin_admin'] ) ? 1 : 0,
                'rate_limit'         => max( 10, min( 2000, (int) ( $_POST['rate_limit'] ?? 120 ) ) ),
                'log_last'           => max( 20, min( 1000, (int) ( $_POST['log_last'] ?? 200 ) ) ),
            );
            update_option( 'mcp_bridge_settings', $s, false );
            update_option( 'mcp_bridge_allow_cors', $s['allow_cors'], false );
            add_settings_error( 'mcp_bridge', 'mcp_ok', 'Settings saved.', 'success' );
        }
    }

    public function page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized.' );
        }
        settings_errors( 'mcp_bridge' );
        $auth     = MCP_Bridge_Auth::instance();
        $keys     = $auth->get_keys();
        $settings = mcp_bridge_get_settings();
        $admins   = get_users( array( 'role' => 'administrator', 'number' => 50 ) );
        $endpoint = rest_url( MCP_BRIDGE_NAMESPACE . '/' );
        $log      = array_reverse( (array) get_option( 'mcp_bridge_log', array() ) );
        ?>
        <div class="wrap">
            <h1>MCP Bridge — Agent Connect</h1>
            <p>Give <strong>any MCP-compatible agent</strong> full abilities on this site via a secure API key. The key acts as the selected admin user.</p>

            <?php if ( $this->revealed_key ) : ?>
                <div class="notice notice-warning"><p><strong>New API key (copy now):</strong></p>
                <p><code id="mcp-new-key" style="font-size:15px;user-select:all"><?php echo esc_html( $this->revealed_key ); ?></code></p>
                <p>Header: <code>Authorization: Bearer <?php echo esc_html( $this->revealed_key ); ?></code> &nbsp; or &nbsp; <code>X-MCP-Key: <?php echo esc_html( $this->revealed_key ); ?></code></p></div>
            <?php endif; ?>

            <h2>1. Endpoint</h2>
            <p><code><?php echo esc_html( $endpoint ); ?></code></p>
            <p>Manifest: <code><?php echo esc_html( rest_url( MCP_BRIDGE_NAMESPACE . '/manifest' ) ); ?></code> &nbsp;•&nbsp; Simple call API: <code><?php echo esc_html( rest_url( MCP_BRIDGE_NAMESPACE . '/call' ) ); ?></code></p>

            <h2>2. API keys (full access)</h2>
            <table class="widefat striped" style="max-width:900px">
                <thead><tr><th>Name</th><th>Prefix</th><th>User</th><th>Created</th><th>Last used</th><th>Uses</th><th></th></tr></thead>
                <tbody>
                <?php if ( ! $keys ) : ?><tr><td colspan="7">No keys yet — create one below.</td></tr><?php endif; ?>
                <?php foreach ( $keys as $k ) :
                    $u = get_user_by( 'id', (int) $k['user_id'] ); ?>
                    <tr>
                        <td><?php echo esc_html( $k['name'] ); ?></td>
                        <td><code><?php echo esc_html( $k['prefix'] ?? '' ); ?></code></td>
                        <td><?php echo $u ? esc_html( $u->user_login . ' (#' . $u->ID . ')' ) : '—'; ?></td>
                        <td><?php echo esc_html( gmdate( 'Y-m-d', (int) ( $k['created'] ?? 0 ) ) ); ?></td>
                        <td><?php echo ! empty( $k['last_used'] ) ? esc_html( human_time_diff( (int) $k['last_used'] ) . ' ago' ) : 'never'; ?></td>
                        <td><?php echo esc_html( (string) ( $k['use_count'] ?? 0 ) ); ?></td>
                        <td><a class="button button-small" onclick="return confirm('Revoke this key? Agents using it stop immediately.')" href="<?php echo esc_url( wp_nonce_url( admin_url( 'options-general.php?page=mcp-bridge&revoke=' . urlencode( $k['id'] ) ), 'mcp_revoke_' . $k['id'] ) ); ?>">Revoke</a></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>

            <h3>Create key</h3>
            <form method="post">
                <?php wp_nonce_field( 'mcp_bridge_keys' ); ?>
                <input type="text" name="mcp_key_name" placeholder="e.g. Claude Desktop" class="regular-text" required>
                <select name="mcp_key_user">
                    <?php foreach ( $admins as $a ) : ?>
                        <option value="<?php echo esc_attr( $a->ID ); ?>" <?php selected( $a->ID, get_current_user_id() ); ?>><?php echo esc_html( $a->user_login ); ?> (admin)</option>
                    <?php endforeach; ?>
                </select>
                <button class="button button-primary" name="mcp_new_key" value="1">Generate full-access key</button>
            </form>

            <h2>3. Connect any agent</h2>
            <p><strong>Claude Desktop / Cursor / MCP Inspector</strong> — Streamable HTTP transport, URL = endpoint above, header <code>Authorization: Bearer KEY</code>.</p>
            <pre style="background:#fff;border:1px solid #ccd0d4;padding:12px;max-width:900px;overflow:auto">{
  "mcpServers": {
    "wordpress": {
      "type": "http",
      "url": "<?php echo esc_html( $endpoint ); ?>",
      "headers": { "Authorization": "Bearer mcp_live_..." }
    }
  }
}</pre>
            <p><strong>cURL test:</strong></p>
            <pre style="background:#fff;border:1px solid #ccd0d4;padding:12px;max-width:900px;overflow:auto">curl -X POST <?php echo esc_html( $endpoint ); ?> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mcp_live_..." \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'</pre>

            <h2>4. Safety switches</h2>
            <form method="post">
                <?php wp_nonce_field( 'mcp_bridge_settings' ); ?>
                <table class="form-table"><tbody>
                    <tr><th>Enabled</th><td><label><input type="checkbox" name="enabled" value="1" <?php checked( $settings['enabled'] ); ?>> MCP endpoint on</label></td></tr>
                    <tr><th>CORS</th><td><label><input type="checkbox" name="allow_cors" value="1" <?php checked( $settings['allow_cors'] ); ?>> Allow browser agents (Access-Control-Allow-Origin: *)</label></td></tr>
                    <tr><th>Plugins/themes</th><td><label><input type="checkbox" name="allow_plugin_admin" value="1" <?php checked( $settings['allow_plugin_admin'] ); ?>> Expose plugin/theme activate tools</label></td></tr>
                    <tr><th>SQL writes</th><td><label><input type="checkbox" name="allow_sql_write" value="1" <?php checked( $settings['allow_sql_write'] ); ?>> Allow INSERT/UPDATE/DELETE via sql_query (else read-only). <em>wp-config MCP_ALLOW_SQL_WRITE overrides.</em></label></td></tr>
                    <tr><th>PHP eval</th><td><label><input type="checkbox" name="allow_php" value="1" <?php checked( $settings['allow_php'] ); ?>> Expose eval_php tool. <strong style="color:#b32d2e">Dangerous — only for staging.</strong></label></td></tr>
                    <tr><th>Rate limit</th><td><input type="number" name="rate_limit" value="<?php echo esc_attr( $settings['rate_limit'] ); ?>" min="10" max="2000"> req/min/key</td></tr>
                </tbody></table>
                <button class="button button-primary" name="mcp_save_settings" value="1">Save settings</button>
            </form>

            <h2>5. Recent calls</h2>
            <table class="widefat striped" style="max-width:900px">
                <thead><tr><th>Time</th><th>Tool/method</th><th>OK</th><th>User</th></tr></thead>
                <tbody>
                <?php foreach ( array_slice( $log, 0, 30 ) as $e ) : ?>
                    <tr><td><?php echo esc_html( gmdate( 'H:i:s', (int) $e['t'] ) ); ?></td><td><code><?php echo esc_html( $e['tool'] ); ?></code></td><td><?php echo ! empty( $e['ok'] ) ? '✓' : '✗'; ?></td><td><?php echo esc_html( (string) ( $e['user'] ?? '' ) ); ?></td></tr>
                <?php endforeach; ?>
                <?php if ( ! $log ) : ?><tr><td colspan="4">No calls yet.</td></tr><?php endif; ?>
                </tbody>
            </table>
            <p class="description">Security note: keys grant <strong>full admin abilities</strong>. Create one key per agent, revoke when done, never commit keys to git, rotate if leaked. For emergencies add <code>define('MCP_DISABLE', true);</code> to wp-config.php.</p>
        </div>
        <?php
    }
}
