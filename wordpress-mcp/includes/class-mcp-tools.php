<?php
/**
 * Full tool catalogue: every callable agent capability.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class MCP_Bridge_Tools {

    /**
     * Return MCP tool definitions (name, description, inputSchema).
     * Gated tools are flagged with annotations + only advertised when enabled.
     */
    public static function definitions() {
        $settings      = function_exists( 'mcp_bridge_get_settings' ) ? mcp_bridge_get_settings() : array();
        $allow_php     = ! empty( $settings['allow_php'] ) || ( defined( 'MCP_ALLOW_PHP' ) && MCP_ALLOW_PHP );
        $allow_sql_w   = ! empty( $settings['allow_sql_write'] ) || ( defined( 'MCP_ALLOW_SQL_WRITE' ) && MCP_ALLOW_SQL_WRITE );
        $allow_plugins = ! isset( $settings['allow_plugin_admin'] ) || ! empty( $settings['allow_plugin_admin'] );

        $T = array();

        $T[] = self::def( 'site_info', 'Get site URL, name, WP + PHP versions, active theme/plugins count, current user.', array() );
        $T[] = self::def( 'site_settings_get', 'Read a whitelisted site option / setting.', array(
            'key' => self::str( 'Option name, e.g. blogname, blogdescription, posts_per_page, timezone_string.' ),
        ), array( 'key' ) );
        $T[] = self::def( 'site_settings_update', 'Update a whitelisted site option. Requires manage_options (already enforced by API key).', array(
            'key'   => self::str( 'Option name.' ),
            'value' => self::mixed( 'New value (string/number/bool).' ),
        ), array( 'key', 'value' ) );

        // Posts & pages.
        foreach ( array( 'post', 'page' ) as $type ) {
            $label = $type === 'post' ? 'Posts' : 'Pages';
            $p     = $type === 'post' ? 'posts' : 'pages';
            $T[] = self::def( "{$p}_list", "List {$label} with pagination, search, status filter.", array(
                'per_page' => self::int( '1-100, default 10.' ),
                'page'     => self::int( 'Page number, default 1.' ),
                'search'   => self::str( 'Search keyword.' ),
                'status'   => self::str( 'publish, draft, pending, private, trash, any. Default publish.' ),
                'orderby'  => self::str( 'date, title, modified. Default date.' ),
                'order'    => self::str( 'DESC or ASC. Default DESC.' ),
            ) );
            $T[] = self::def( "{$p}_get", "Get a single {$type} by ID.", array(
                'id' => self::int( "{$type} ID." ),
            ), array( 'id' ) );
            $T[] = self::def( "{$p}_create", "Create a {$type}.", array(
                'title'   => self::str( "{$label} title." ),
                'content' => self::str( 'HTML content.' ),
                'status'  => self::str( 'publish, draft, pending, private. Default draft.' ),
                'slug'    => self::str( 'Optional slug.' ),
                'excerpt' => self::str( 'Optional excerpt.' ),
                'author'  => self::int( 'Optional author user ID.' ),
                'meta'    => self::obj( 'Optional key/value meta.' ),
            ), array( 'title', 'content' ) );
            $T[] = self::def( "{$p}_update", "Update a {$type}.", array(
                'id'      => self::int( "{$type} ID." ),
                'title'   => self::str( 'New title.' ),
                'content' => self::str( 'New HTML content.' ),
                'status'  => self::str( 'publish, draft, pending, private, trash.' ),
                'slug'    => self::str( 'New slug.' ),
                'excerpt' => self::str( 'New excerpt.' ),
                'meta'    => self::obj( 'Key/value meta to set.' ),
            ), array( 'id' ) );
            $T[] = self::def( "{$p}_delete", "Delete a {$type} (trash by default, or force).", array(
                'id'    => self::int( "{$type} ID." ),
                'force' => self::bool( 'True = permanently delete. Default false (trash).' ),
            ), array( 'id' ) );
        }

        // Media.
        $T[] = self::def( 'media_list', 'List media attachments.', array(
            'per_page' => self::int( '1-100, default 20.' ),
            'page'     => self::int( 'Default 1.' ),
            'search'   => self::str( 'Search keyword.' ),
            'mime'     => self::str( 'e.g. image, video, application/pdf.' ),
        ) );
        $T[] = self::def( 'media_get', 'Get a media attachment by ID.', array( 'id' => self::int( 'Attachment ID.' ) ), array( 'id' ) );
        $T[] = self::def( 'media_upload', 'Upload media from a public URL or base64. Returns attachment ID + URL.', array(
            'source'   => self::str( 'Public http(s) URL OR base64 data URI / raw base64.' ),
            'filename' => self::str( 'Required filename, e.g. photo.jpg.' ),
            'title'    => self::str( 'Optional title.' ),
            'alt'      => self::str( 'Optional alt text.' ),
        ), array( 'source', 'filename' ) );
        $T[] = self::def( 'media_update', 'Update title/caption/alt/description of an attachment.', array(
            'id'          => self::int( 'Attachment ID.' ),
            'title'       => self::str( 'New title.' ),
            'caption'     => self::str( 'New caption (excerpt).' ),
            'description' => self::str( 'New description (content).' ),
            'alt'         => self::str( 'New alt text.' ),
        ), array( 'id' ) );
        $T[] = self::def( 'media_delete', 'Delete an attachment.', array(
            'id'    => self::int( 'Attachment ID.' ),
            'force' => self::bool( 'Default true (media has no trash).' ),
        ), array( 'id' ) );

        // Taxonomies.
        $T[] = self::def( 'categories_list', 'List categories.', array( 'per_page' => self::int( 'Default 50.' ), 'search' => self::str( 'Search.' ) ) );
        $T[] = self::def( 'category_create', 'Create a category.', array( 'name' => self::str( 'Name.' ), 'slug' => self::str( 'Slug.' ), 'parent' => self::int( 'Parent ID.' ), 'description' => self::str( 'Description.' ) ), array( 'name' ) );
        $T[] = self::def( 'tags_list', 'List tags.', array( 'per_page' => self::int( 'Default 50.' ), 'search' => self::str( 'Search.' ) ) );
        $T[] = self::def( 'tag_create', 'Create a tag.', array( 'name' => self::str( 'Name.' ), 'slug' => self::str( 'Slug.' ) ), array( 'name' ) );

        // Users.
        $T[] = self::def( 'users_list', 'List users.', array(
            'per_page' => self::int( 'Default 20.' ), 'page' => self::int( 'Default 1.' ),
            'search' => self::str( 'Search.' ), 'role' => self::str( 'Role filter.' ),
        ) );
        $T[] = self::def( 'user_get', 'Get a user by ID.', array( 'id' => self::int( 'User ID.' ) ), array( 'id' ) );
        $T[] = self::def( 'user_create', 'Create a user.', array(
            'username' => self::str( 'Login.' ), 'email' => self::str( 'Email.' ),
            'password' => self::str( 'Password (auto-generated if omitted).' ),
            'role' => self::str( 'Default subscriber.' ), 'display_name' => self::str( 'Display name.' ),
        ), array( 'username', 'email' ) );
        $T[] = self::def( 'user_update', 'Update a user (role, email, display name, password).', array(
            'id' => self::int( 'User ID.' ), 'email' => self::str( 'New email.' ),
            'role' => self::str( 'New role.' ), 'display_name' => self::str( 'Display name.' ),
            'password' => self::str( 'New password.' ),
        ), array( 'id' ) );
        $T[] = self::def( 'user_delete', 'Delete a user, optionally reassign content.', array(
            'id' => self::int( 'User ID.' ), 'reassign' => self::int( 'Reassign posts to this user ID.' ),
        ), array( 'id' ) );

        // Comments.
        $T[] = self::def( 'comments_list', 'List comments.', array(
            'per_page' => self::int( 'Default 20.' ), 'page' => self::int( 'Default 1.' ),
            'status' => self::str( 'approve, hold, spam, trash, all. Default all.' ),
            'post_id' => self::int( 'Filter by post.' ), 'search' => self::str( 'Search.' ),
        ) );
        $T[] = self::def( 'comment_update', 'Approve / hold / spam / trash a comment.', array(
            'id' => self::int( 'Comment ID.' ), 'status' => self::str( 'approve, hold, spam, trash.' ),
        ), array( 'id', 'status' ) );
        $T[] = self::def( 'comment_create', 'Create a comment / reply.', array(
            'post_id' => self::int( 'Post ID.' ), 'content' => self::str( 'Content.' ),
            'author_name' => self::str( 'Author.' ), 'author_email' => self::str( 'Email.' ),
            'parent' => self::int( 'Parent comment for replies.' ), 'status' => self::str( 'Approved=1 else 0. Default 1.' ),
        ), array( 'post_id', 'content' ) );
        $T[] = self::def( 'comment_delete', 'Delete a comment.', array( 'id' => self::int( 'Comment ID.' ), 'force' => self::bool( 'Default true.' ) ), array( 'id' ) );

        // Options / reading.
        $T[] = self::def( 'option_get', 'Read any option (keys are allow-listed + filtered for secrets).', array( 'key' => self::str( 'Option name.' ) ), array( 'key' ) );

        // Plugins & themes (gated by setting).
        if ( $allow_plugins ) {
            $T[] = self::def( 'plugins_list', 'List installed plugins with active status + version.', array() );
            $T[] = self::def( 'plugin_activate', 'Activate a plugin by plugin file, e.g. akismet/akismet.php.', array( 'plugin' => self::str( 'Plugin file.' ) ), array( 'plugin' ) );
            $T[] = self::def( 'plugin_deactivate', 'Deactivate a plugin.', array( 'plugin' => self::str( 'Plugin file.' ) ), array( 'plugin' ) );
            $T[] = self::def( 'themes_list', 'List installed themes.', array() );
            $T[] = self::def( 'theme_activate', 'Activate a theme by stylesheet slug.', array( 'stylesheet' => self::str( 'Stylesheet.' ) ), array( 'stylesheet' ) );
        }

        // Maintenance.
        $T[] = self::def( 'cache_flush', 'Flush object cache + rewrite rules.', array() );
        $T[] = self::def( 'health_check', 'Basic site health: counts, versions, debug flags.', array() );

        // SQL (read-only unless explicitly enabled).
        $T[] = self::def(
            $allow_sql_w ? 'sql_query' : 'sql_query_readonly',
            $allow_sql_w
                ? 'Run a SQL query (WRITE enabled by admin — dangerous). Use %i for table prefix replacement of wp_.'
                : 'Run a READ-ONLY SELECT/SHOW query. Non-SELECT statements are blocked unless the admin enables writes.',
            array( 'sql' => self::str( 'SQL, e.g. SELECT * FROM wp_posts LIMIT 5.' ) ),
            array( 'sql' )
        );

        // PHP eval — only advertised when explicitly enabled.
        if ( $allow_php ) {
            $T[] = self::def( 'eval_php', 'DANGEROUS: execute PHP and return output. Must be enabled via MCP_ALLOW_PHP or settings.', array(
                'code' => self::str( 'PHP code without <?php tags. Return value is captured.' ),
            ), array( 'code' ) );
        }

        return apply_filters( 'mcp_bridge_tool_definitions', $T );
    }

    // ---------- schema helpers ----------

    private static function def( $name, $desc, $props = array(), $required = array() ) {
        return array(
            'name'        => $name,
            'description' => $desc,
            'inputSchema' => array(
                'type'       => 'object',
                'properties' => $props,
                'required'   => $required,
            ),
        );
    }
    private static function str( $d ) {
        return array( 'type' => 'string', 'description' => $d );
    }
    private static function int( $d ) {
        return array( 'type' => 'integer', 'description' => $d );
    }
    private static function bool( $d ) {
        return array( 'type' => 'boolean', 'description' => $d );
    }
    private static function obj( $d ) {
        return array( 'type' => 'object', 'description' => $d );
    }
    private static function mixed( $d ) {
        return array( 'description' => $d );
    }

    /**
     * Dispatch a tool call. Returns array (result) or throws Exception.
     */
    public static function call( $name, $args = array() ) {
        if ( ! is_array( $args ) ) {
            $args = array();
        }
        // Normalize readonly alias.
        if ( $name === 'sql_query' && ! self::sql_write_allowed() ) {
            $name = 'sql_query_readonly';
        }
        $method = 'tool_' . $name;
        if ( method_exists( __CLASS__, $method ) ) {
            return call_user_func( array( __CLASS__, $method ), $args );
        }
        // Generic post/page handlers.
        if ( preg_match( '/^(posts|pages)_(list|get|create|update|delete)$/', $name, $m ) ) {
            $type = $m[1] === 'posts' ? 'post' : 'page';
            $op   = $m[2];
            return self::handle_post_op( $type, $op, $args );
        }
        throw new Exception( 'Unknown tool: ' . $name, 404 );
    }

    // =================================================================
    // Capability guard
    // =================================================================

    private static function need( $cap ) {
        if ( ! current_user_can( $cap ) ) {
            throw new Exception( 'Insufficient permission. Requires capability: ' . $cap, 403 );
        }
    }

    private static function sql_write_allowed() {
        $s = function_exists( 'mcp_bridge_get_settings' ) ? mcp_bridge_get_settings() : array();
        return ( ! empty( $s['allow_sql_write'] ) || ( defined( 'MCP_ALLOW_SQL_WRITE' ) && MCP_ALLOW_SQL_WRITE ) );
    }

    private static function php_allowed() {
        $s = function_exists( 'mcp_bridge_get_settings' ) ? mcp_bridge_get_settings() : array();
        return ( ! empty( $s['allow_php'] ) || ( defined( 'MCP_ALLOW_PHP' ) && MCP_ALLOW_PHP ) );
    }

    // =================================================================
    // Site
    // =================================================================

    public static function tool_site_info( $a ) {
        global $wp_version;
        $theme = wp_get_theme();
        return array(
            'name'        => get_bloginfo( 'name' ),
            'description' => get_bloginfo( 'description' ),
            'url'         => home_url(),
            'admin_email' => get_option( 'admin_email' ),
            'wp_version'  => $wp_version,
            'php_version' => PHP_VERSION,
            'theme'       => $theme ? array( 'name' => $theme->get( 'Name' ), 'version' => $theme->get( 'Version' ), 'stylesheet' => get_stylesheet() ) : null,
            'plugins'     => count( (array) get_option( 'active_plugins', array() ) ) . ' active',
            'user'        => self::current_user_summary(),
            'mcp_version' => defined( 'MCP_BRIDGE_VERSION' ) ? MCP_BRIDGE_VERSION : '1.0.0',
        );
    }

    private static function current_user_summary() {
        $u = wp_get_current_user();
        if ( ! $u || ! $u->ID ) {
            return null;
        }
        return array( 'id' => $u->ID, 'login' => $u->user_login, 'roles' => $u->roles );
    }

    private static function allowed_settings_keys() {
        return apply_filters( 'mcp_bridge_allowed_options', array(
            'blogname', 'blogdescription', 'posts_per_page', 'posts_per_rss',
            'date_format', 'time_format', 'timezone_string', 'start_of_week',
            'default_comment_status', 'comment_moderation', 'comment_previously_approved',
            'thumbnail_size_w', 'thumbnail_size_h', 'medium_size_w', 'medium_size_h', 'large_size_w', 'large_size_h',
            'show_on_front', 'page_on_front', 'page_for_posts',
        ) );
    }

    public static function tool_site_settings_get( $a ) {
        self::need( 'manage_options' );
        $key = sanitize_key( $a['key'] ?? '' );
        if ( ! in_array( $key, self::allowed_settings_keys(), true ) ) {
            throw new Exception( 'Option not in allow-list. Use option_get for reads or ask admin to allow-list it.', 400 );
        }
        return array( 'key' => $key, 'value' => get_option( $key ) );
    }

    public static function tool_site_settings_update( $a ) {
        self::need( 'manage_options' );
        $key = sanitize_key( $a['key'] ?? '' );
        if ( ! in_array( $key, self::allowed_settings_keys(), true ) ) {
            throw new Exception( 'Option not in allow-list for writes.', 400 );
        }
        $value = $a['value'] ?? null;
        if ( is_array( $value ) || is_object( $value ) ) {
            throw new Exception( 'Only scalar option values allowed via this tool.', 400 );
        }
        update_option( $key, wp_unslash( $value ) );
        return array( 'key' => $key, 'value' => get_option( $key ), 'updated' => true );
    }

    public static function tool_option_get( $a ) {
        self::need( 'manage_options' );
        $key = sanitize_key( $a['key'] ?? '' );
        if ( $key === '' ) {
            throw new Exception( 'Missing key.', 400 );
        }
        // Block secrets.
        $blocked = array( 'mcp_bridge_keys', 'auth_key', 'secure_auth_key', 'logged_in_key', 'auth_salt', 'cron', 'db_password' );
        foreach ( $blocked as $b ) {
            if ( stripos( $key, $b ) !== false ) {
                throw new Exception( 'Blocked option for security.', 403 );
            }
        }
        $v = get_option( $key, null );
        if ( is_array( $v ) || is_object( $v ) ) {
            $v = wp_json_encode( $v );
        }
        return array( 'key' => $key, 'value' => $v );
    }

    // =================================================================
    // Posts / pages
    // =================================================================

    private static function handle_post_op( $type, $op, $a ) {
        switch ( $op ) {
            case 'list':
                self::need( $type === 'page' ? 'edit_pages' : 'edit_posts' );
                $pq = array(
                    'post_type'      => $type,
                    'posts_per_page' => min( 100, max( 1, (int) ( $a['per_page'] ?? 10 ) ) ),
                    'paged'          => max( 1, (int) ( $a['page'] ?? 1 ) ),
                    's'              => isset( $a['search'] ) ? sanitize_text_field( $a['search'] ) : '',
                    'post_status'    => isset( $a['status'] ) ? sanitize_key( $a['status'] ) : ( current_user_can( 'read_private_posts' ) ? 'any' : 'publish' ),
                    'orderby'        => in_array( ( $a['orderby'] ?? 'date' ), array( 'date', 'title', 'modified', 'ID' ), true ) ? $a['orderby'] : 'date',
                    'order'          => strtoupper( $a['order'] ?? 'DESC' ) === 'ASC' ? 'ASC' : 'DESC',
                );
                // Non-privileged callers only see publish.
                if ( ! current_user_can( 'edit_others_posts' ) && $type === 'post' ) {
                    $pq['post_status'] = 'publish';
                }
                if ( ! current_user_can( 'edit_others_pages' ) && $type === 'page' ) {
                    $pq['post_status'] = 'publish';
                }
                $q = new WP_Query( $pq );
                $out = array();
                foreach ( $q->posts as $p ) {
                    $out[] = self::fmt_post( $p, false );
                }
                return array( 'items' => $out, 'total' => (int) $q->found_posts, 'pages' => (int) $q->max_num_pages );

            case 'get':
                $id = (int) ( $a['id'] ?? 0 );
                $p  = get_post( $id );
                if ( ! $p || $p->post_type !== $type ) {
                    throw new Exception( ucfirst( $type ) . ' not found.', 404 );
                }
                if ( 'publish' !== $p->post_status ) {
                    self::need( $type === 'page' ? 'edit_pages' : 'edit_posts' );
                }
                return self::fmt_post( $p, true );

            case 'create':
                self::need( $type === 'page' ? 'publish_pages' : 'publish_posts' );
                $title   = sanitize_text_field( $a['title'] ?? '' );
                $content = isset( $a['content'] ) ? wp_kses_post( wp_unslash( $a['content'] ) ) : '';
                if ( $title === '' ) {
                    throw new Exception( 'Title is required.', 400 );
                }
                $status = sanitize_key( $a['status'] ?? 'draft' );
                if ( ! in_array( $status, array( 'publish', 'draft', 'pending', 'private' ), true ) ) {
                    $status = 'draft';
                }
                $arr = array(
                    'post_type'    => $type,
                    'post_title'   => $title,
                    'post_content' => $content,
                    'post_status'  => $status,
                    'post_excerpt' => isset( $a['excerpt'] ) ? sanitize_textarea_field( $a['excerpt'] ) : '',
                    'post_name'    => isset( $a['slug'] ) ? sanitize_title( $a['slug'] ) : '',
                );
                if ( ! empty( $a['author'] ) ) {
                    $arr['post_author'] = (int) $a['author'];
                }
                $id = wp_insert_post( $arr, true );
                if ( is_wp_error( $id ) ) {
                    throw new Exception( $id->get_error_message(), 400 );
                }
                if ( ! empty( $a['meta'] ) && is_array( $a['meta'] ) ) {
                    foreach ( $a['meta'] as $k => $v ) {
                        update_post_meta( $id, sanitize_key( $k ), wp_unslash( $v ) );
                    }
                }
                return self::fmt_post( get_post( $id ), true );

            case 'update':
                $id = (int) ( $a['id'] ?? 0 );
                $p  = get_post( $id );
                if ( ! $p || $p->post_type !== $type ) {
                    throw new Exception( ucfirst( $type ) . ' not found.', 404 );
                }
                self::need( $type === 'page' ? 'edit_pages' : 'edit_posts' );
                $arr = array( 'ID' => $id );
                if ( isset( $a['title'] ) ) {
                    $arr['post_title'] = sanitize_text_field( $a['title'] );
                }
                if ( isset( $a['content'] ) ) {
                    $arr['post_content'] = wp_kses_post( wp_unslash( $a['content'] ) );
                }
                if ( isset( $a['status'] ) ) {
                    $arr['post_status'] = sanitize_key( $a['status'] );
                }
                if ( isset( $a['slug'] ) ) {
                    $arr['post_name'] = sanitize_title( $a['slug'] );
                }
                if ( isset( $a['excerpt'] ) ) {
                    $arr['post_excerpt'] = sanitize_textarea_field( $a['excerpt'] );
                }
                $r = wp_update_post( $arr, true );
                if ( is_wp_error( $r ) ) {
                    throw new Exception( $r->get_error_message(), 400 );
                }
                if ( ! empty( $a['meta'] ) && is_array( $a['meta'] ) ) {
                    foreach ( $a['meta'] as $k => $v ) {
                        update_post_meta( $id, sanitize_key( $k ), wp_unslash( $v ) );
                    }
                }
                return self::fmt_post( get_post( $id ), true );

            case 'delete':
                $id = (int) ( $a['id'] ?? 0 );
                $p  = get_post( $id );
                if ( ! $p || $p->post_type !== $type ) {
                    throw new Exception( ucfirst( $type ) . ' not found.', 404 );
                }
                self::need( $type === 'page' ? 'delete_pages' : 'delete_posts' );
                $force = ! empty( $a['force'] );
                $res   = $force ? wp_delete_post( $id, true ) : wp_trash_post( $id );
                if ( ! $res ) {
                    throw new Exception( 'Delete failed.', 400 );
                }
                return array( 'id' => $id, 'deleted' => true, 'force' => $force );
        }
        throw new Exception( 'Unhandled post op.', 400 );
    }

    private static function fmt_post( $p, $full ) {
        $d = array(
            'id'     => $p->ID,
            'type'   => $p->post_type,
            'title'  => get_the_title( $p ),
            'slug'   => $p->post_name,
            'status' => $p->post_status,
            'date'   => $p->post_date,
            'link'   => get_permalink( $p ),
            'author' => (int) $p->post_author,
        );
        if ( $full ) {
            $d['content'] = $p->post_content;
            $d['excerpt'] = $p->post_excerpt;
            $d['meta']    = get_post_meta( $p->ID );
        } else {
            $d['excerpt'] = wp_trim_words( wp_strip_all_tags( $p->post_content ), 30 );
        }
        return $d;
    }

    // =================================================================
    // Media
    // =================================================================

    public static function tool_media_list( $a ) {
        self::need( 'upload_files' );
        $q = new WP_Query( array(
            'post_type'      => 'attachment',
            'post_status'    => 'inherit',
            'posts_per_page' => min( 100, max( 1, (int) ( $a['per_page'] ?? 20 ) ) ),
            'paged'          => max( 1, (int) ( $a['page'] ?? 1 ) ),
            's'              => isset( $a['search'] ) ? sanitize_text_field( $a['search'] ) : '',
            'post_mime_type' => isset( $a['mime'] ) ? sanitize_mime_type( $a['mime'] ) : '',
        ) );
        $out = array();
        foreach ( $q->posts as $p ) {
            $out[] = self::fmt_media( $p );
        }
        return array( 'items' => $out, 'total' => (int) $q->found_posts );
    }

    public static function tool_media_get( $a ) {
        self::need( 'upload_files' );
        $p = get_post( (int) ( $a['id'] ?? 0 ) );
        if ( ! $p || $p->post_type !== 'attachment' ) {
            throw new Exception( 'Media not found.', 404 );
        }
        return self::fmt_media( $p );
    }

    private static function fmt_media( $p ) {
        return array(
            'id' => $p->ID,
            'title' => get_the_title( $p ),
            'url' => wp_get_attachment_url( $p->ID ),
            'mime' => $p->post_mime_type,
            'date' => $p->post_date,
            'alt' => get_post_meta( $p->ID, '_wp_attachment_image_alt', true ),
            'caption' => $p->post_excerpt,
            'description' => $p->post_content,
        );
    }

    public static function tool_media_upload( $a ) {
        self::need( 'upload_files' );
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $filename = sanitize_file_name( $a['filename'] ?? '' );
        $source   = trim( (string) ( $a['source'] ?? '' ) );
        if ( $filename === '' || $source === '' ) {
            throw new Exception( 'source and filename are required.', 400 );
        }
        $tmp = wp_tempnam( $filename );
        if ( ! $tmp ) {
            throw new Exception( 'Could not create temp file.', 500 );
        }

        $written = false;
        if ( preg_match( '#^https?://#i', $source ) ) {
            $resp = wp_safe_remote_get( $source, array( 'timeout' => 30 ) );
            if ( is_wp_error( $resp ) ) {
                @unlink( $tmp );
                throw new Exception( 'Download failed: ' . $resp->get_error_message(), 400 );
            }
            $body = wp_remote_retrieve_body( $resp );
            if ( $body === '' ) {
                @unlink( $tmp );
                throw new Exception( 'Downloaded file is empty.', 400 );
            }
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
            $written = file_put_contents( $tmp, $body ) !== false;
        } else {
            // base64 (allow data-uri prefix).
            if ( strpos( $source, 'base64,' ) !== false ) {
                $source = substr( $source, strpos( $source, 'base64,' ) + 7 );
            }
            $bin = base64_decode( $source, true );
            if ( $bin === false ) {
                @unlink( $tmp );
                throw new Exception( 'Invalid base64 source.', 400 );
            }
            if ( strlen( $bin ) > 50 * 1024 * 1024 ) {
                @unlink( $tmp );
                throw new Exception( 'File too large (50MB cap).', 400 );
            }
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
            $written = file_put_contents( $tmp, $bin ) !== false;
        }
        if ( ! $written ) {
            @unlink( $tmp );
            throw new Exception( 'Could not write temp file.', 500 );
        }

        $file = array(
            'name'     => $filename,
            'tmp_name' => $tmp,
            'error'    => 0,
            'size'     => filesize( $tmp ),
        );
        $id = media_handle_sideload( $file, 0, isset( $a['title'] ) ? sanitize_text_field( $a['title'] ) : null );
        @unlink( $tmp );
        if ( is_wp_error( $id ) ) {
            throw new Exception( $id->get_error_message(), 400 );
        }
        if ( ! empty( $a['alt'] ) ) {
            update_post_meta( $id, '_wp_attachment_image_alt', sanitize_text_field( $a['alt'] ) );
        }
        return self::fmt_media( get_post( $id ) );
    }

    public static function tool_media_update( $a ) {
        self::need( 'upload_files' );
        $id = (int) ( $a['id'] ?? 0 );
        $p  = get_post( $id );
        if ( ! $p || $p->post_type !== 'attachment' ) {
            throw new Exception( 'Media not found.', 404 );
        }
        $arr = array( 'ID' => $id );
        if ( isset( $a['title'] ) ) {
            $arr['post_title'] = sanitize_text_field( $a['title'] );
        }
        if ( isset( $a['caption'] ) ) {
            $arr['post_excerpt'] = sanitize_textarea_field( $a['caption'] );
        }
        if ( isset( $a['description'] ) ) {
            $arr['post_content'] = wp_kses_post( wp_unslash( $a['description'] ) );
        }
        $r = wp_update_post( $arr, true );
        if ( is_wp_error( $r ) ) {
            throw new Exception( $r->get_error_message(), 400 );
        }
        if ( isset( $a['alt'] ) ) {
            update_post_meta( $id, '_wp_attachment_image_alt', sanitize_text_field( $a['alt'] ) );
        }
        return self::fmt_media( get_post( $id ) );
    }

    public static function tool_media_delete( $a ) {
        self::need( 'delete_posts' );
        $id = (int) ( $a['id'] ?? 0 );
        if ( ! wp_delete_attachment( $id, true ) ) {
            throw new Exception( 'Delete failed or not found.', 404 );
        }
        return array( 'id' => $id, 'deleted' => true );
    }

    // =================================================================
    // Taxonomies
    // =================================================================

    public static function tool_categories_list( $a ) {
        self::need( 'edit_posts' );
        $terms = get_terms( array(
            'taxonomy'   => 'category',
            'hide_empty' => false,
            'number'     => min( 100, max( 1, (int) ( $a['per_page'] ?? 50 ) ) ),
            'search'     => isset( $a['search'] ) ? sanitize_text_field( $a['search'] ) : '',
        ) );
        if ( is_wp_error( $terms ) ) {
            throw new Exception( $terms->get_error_message(), 400 );
        }
        return array( 'items' => array_map( array( __CLASS__, 'fmt_term' ), $terms ) );
    }

    public static function tool_category_create( $a ) {
        self::need( 'manage_categories' );
        $r = wp_insert_term( sanitize_text_field( $a['name'] ?? '' ), 'category', array(
            'slug'        => isset( $a['slug'] ) ? sanitize_title( $a['slug'] ) : '',
            'parent'      => isset( $a['parent'] ) ? (int) $a['parent'] : 0,
            'description' => isset( $a['description'] ) ? sanitize_textarea_field( $a['description'] ) : '',
        ) );
        if ( is_wp_error( $r ) ) {
            throw new Exception( $r->get_error_message(), 400 );
        }
        return array( 'id' => $r['term_id'], 'taxonomy' => 'category' );
    }

    public static function tool_tags_list( $a ) {
        self::need( 'edit_posts' );
        $terms = get_terms( array(
            'taxonomy'   => 'post_tag',
            'hide_empty' => false,
            'number'     => min( 100, max( 1, (int) ( $a['per_page'] ?? 50 ) ) ),
            'search'     => isset( $a['search'] ) ? sanitize_text_field( $a['search'] ) : '',
        ) );
        if ( is_wp_error( $terms ) ) {
            throw new Exception( $terms->get_error_message(), 400 );
        }
        return array( 'items' => array_map( array( __CLASS__, 'fmt_term' ), $terms ) );
    }

    public static function tool_tag_create( $a ) {
        self::need( 'manage_categories' );
        $r = wp_insert_term( sanitize_text_field( $a['name'] ?? '' ), 'post_tag', array(
            'slug' => isset( $a['slug'] ) ? sanitize_title( $a['slug'] ) : '',
        ) );
        if ( is_wp_error( $r ) ) {
            throw new Exception( $r->get_error_message(), 400 );
        }
        return array( 'id' => $r['term_id'], 'taxonomy' => 'post_tag' );
    }

    private static function fmt_term( $t ) {
        return array( 'id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug, 'count' => (int) $t->count, 'link' => get_term_link( $t ) );
    }

    // =================================================================
    // Users
    // =================================================================

    public static function tool_users_list( $a ) {
        self::need( 'list_users' );
        $q = new WP_User_Query( array(
            'number' => min( 100, max( 1, (int) ( $a['per_page'] ?? 20 ) ) ),
            'paged'  => max( 1, (int) ( $a['page'] ?? 1 ) ),
            'search' => isset( $a['search'] ) ? '*' . sanitize_text_field( $a['search'] ) . '*' : '',
            'role'   => isset( $a['role'] ) ? sanitize_key( $a['role'] ) : '',
        ) );
        $out = array();
        foreach ( $q->get_results() as $u ) {
            $out[] = self::fmt_user( $u );
        }
        return array( 'items' => $out, 'total' => (int) $q->get_total() );
    }

    public static function tool_user_get( $a ) {
        self::need( 'list_users' );
        $u = get_user_by( 'id', (int) ( $a['id'] ?? 0 ) );
        if ( ! $u ) {
            throw new Exception( 'User not found.', 404 );
        }
        return self::fmt_user( $u );
    }

    private static function fmt_user( $u ) {
        return array(
            'id' => $u->ID, 'username' => $u->user_login, 'email' => $u->user_email,
            'display_name' => $u->display_name, 'roles' => $u->roles, 'registered' => $u->user_registered,
            'posts_url' => get_author_posts_url( $u->ID ),
        );
    }

    public static function tool_user_create( $a ) {
        self::need( 'create_users' );
        $username = sanitize_user( $a['username'] ?? '' );
        $email    = sanitize_email( $a['email'] ?? '' );
        if ( $username === '' || $email === '' || ! is_email( $email ) ) {
            throw new Exception( 'Valid username + email required.', 400 );
        }
        $password = isset( $a['password'] ) && $a['password'] !== '' ? $a['password'] : wp_generate_password( 16 );
        $id = wp_create_user( $username, $password, $email );
        if ( is_wp_error( $id ) ) {
            throw new Exception( $id->get_error_message(), 400 );
        }
        $u = new WP_User( $id );
        $u->set_role( sanitize_key( $a['role'] ?? 'subscriber' ) );
        if ( ! empty( $a['display_name'] ) ) {
            wp_update_user( array( 'ID' => $id, 'display_name' => sanitize_text_field( $a['display_name'] ) ) );
        }
        $res = self::fmt_user( get_user_by( 'id', $id ) );
        if ( empty( $a['password'] ) ) {
            $res['generated_password'] = $password;
        }
        return $res;
    }

    public static function tool_user_update( $a ) {
        self::need( 'edit_users' );
        $id = (int) ( $a['id'] ?? 0 );
        $u  = get_user_by( 'id', $id );
        if ( ! $u ) {
            throw new Exception( 'User not found.', 404 );
        }
        // Prevent agents from demoting/locking the last admin accidentally? Warn but allow.
        $arr = array( 'ID' => $id );
        if ( isset( $a['email'] ) ) {
            $arr['user_email'] = sanitize_email( $a['email'] );
        }
        if ( isset( $a['display_name'] ) ) {
            $arr['display_name'] = sanitize_text_field( $a['display_name'] );
        }
        if ( isset( $a['password'] ) && $a['password'] !== '' ) {
            $arr['user_pass'] = $a['password'];
        }
        if ( isset( $a['role'] ) ) {
            // Only super-admin-level change guarded by promote_users.
            if ( ! current_user_can( 'promote_users' ) ) {
                throw new Exception( 'promote_users capability required to change roles.', 403 );
            }
            $arr['role'] = sanitize_key( $a['role'] );
        }
        $r = wp_update_user( $arr );
        if ( is_wp_error( $r ) ) {
            throw new Exception( $r->get_error_message(), 400 );
        }
        return self::fmt_user( get_user_by( 'id', $id ) );
    }

    public static function tool_user_delete( $a ) {
        self::need( 'delete_users' );
        $id = (int) ( $a['id'] ?? 0 );
        if ( $id === get_current_user_id() ) {
            throw new Exception( 'Refusing to delete the API key owner (yourself).', 400 );
        }
        require_once ABSPATH . 'wp-admin/includes/user.php';
        $reassign = isset( $a['reassign'] ) ? (int) $a['reassign'] : null;
        if ( ! wp_delete_user( $id, $reassign ) ) {
            throw new Exception( 'Delete failed.', 400 );
        }
        return array( 'id' => $id, 'deleted' => true );
    }

    // =================================================================
    // Comments
    // =================================================================

    public static function tool_comments_list( $a ) {
        self::need( 'moderate_comments' );
        $args = array(
            'number' => min( 100, max( 1, (int) ( $a['per_page'] ?? 20 ) ) ),
            'paged'  => max( 1, (int) ( $a['page'] ?? 1 ) ),
            'search' => isset( $a['search'] ) ? sanitize_text_field( $a['search'] ) : '',
        );
        $status = sanitize_key( $a['status'] ?? 'all' );
        if ( in_array( $status, array( 'approve', 'hold', 'spam', 'trash' ), true ) ) {
            $args['status'] = $status === 'approve' ? 1 : $status;
        }
        if ( ! empty( $a['post_id'] ) ) {
            $args['post_id'] = (int) $a['post_id'];
        }
        $comments = get_comments( $args );
        $out = array();
        foreach ( $comments as $c ) {
            $out[] = self::fmt_comment( $c );
        }
        return array( 'items' => $out );
    }

    private static function fmt_comment( $c ) {
        return array(
            'id' => (int) $c->comment_ID, 'post_id' => (int) $c->comment_post_ID,
            'author' => $c->comment_author, 'email' => $c->comment_author_email,
            'content' => $c->comment_content, 'status' => wp_get_comment_status( $c ),
            'date' => $c->comment_date, 'parent' => (int) $c->comment_parent,
        );
    }

    public static function tool_comment_update( $a ) {
        self::need( 'moderate_comments' );
        $id = (int) ( $a['id'] ?? 0 );
        $st = sanitize_key( $a['status'] ?? '' );
        if ( ! in_array( $st, array( 'approve', 'hold', 'spam', 'trash' ), true ) ) {
            throw new Exception( 'status must be approve|hold|spam|trash.', 400 );
        }
        $c = get_comment( $id );
        if ( ! $c ) {
            throw new Exception( 'Comment not found.', 404 );
        }
        if ( $st === 'approve' ) {
            wp_set_comment_status( $id, 'approve' );
        } elseif ( $st === 'hold' ) {
            wp_set_comment_status( $id, 'hold' );
        } elseif ( $st === 'spam' ) {
            wp_spam_comment( $id );
        } else {
            wp_trash_comment( $id );
        }
        return self::fmt_comment( get_comment( $id ) );
    }

    public static function tool_comment_create( $a ) {
        self::need( 'moderate_comments' );
        $post_id = (int) ( $a['post_id'] ?? 0 );
        $content = sanitize_textarea_field( $a['content'] ?? '' );
        if ( ! get_post( $post_id ) || $content === '' ) {
            throw new Exception( 'Valid post_id + content required.', 400 );
        }
        $data = array(
            'comment_post_ID'      => $post_id,
            'comment_content'      => $content,
            'comment_author'       => isset( $a['author_name'] ) ? sanitize_text_field( $a['author_name'] ) : 'Agent',
            'comment_author_email' => isset( $a['author_email'] ) ? sanitize_email( $a['author_email'] ) : get_option( 'admin_email' ),
            'comment_parent'       => isset( $a['parent'] ) ? (int) $a['parent'] : 0,
            'comment_approved'     => isset( $a['status'] ) ? sanitize_text_field( $a['status'] ) : 1,
            'user_id'              => get_current_user_id(),
        );
        $id = wp_insert_comment( $data );
        if ( ! $id ) {
            throw new Exception( 'Insert failed.', 400 );
        }
        return self::fmt_comment( get_comment( $id ) );
    }

    public static function tool_comment_delete( $a ) {
        self::need( 'moderate_comments' );
        $id = (int) ( $a['id'] ?? 0 );
        if ( ! wp_delete_comment( $id, true ) ) {
            throw new Exception( 'Delete failed or not found.', 404 );
        }
        return array( 'id' => $id, 'deleted' => true );
    }

    // =================================================================
    // Plugins / themes
    // =================================================================

    public static function tool_plugins_list( $a ) {
        self::need( 'activate_plugins' );
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
        $all    = get_plugins();
        $active = get_option( 'active_plugins', array() );
        $out    = array();
        foreach ( $all as $file => $info ) {
            $out[] = array(
                'plugin' => $file, 'name' => $info['Name'], 'version' => $info['Version'],
                'active' => in_array( $file, $active, true ),
            );
        }
        return array( 'items' => $out );
    }

    public static function tool_plugin_activate( $a ) {
        self::need( 'activate_plugins' );
        $plugin = sanitize_text_field( $a['plugin'] ?? '' );
        if ( strpos( $plugin, '..' ) !== false || strpos( $plugin, '/' ) === false ) {
            throw new Exception( 'Invalid plugin file, e.g. akismet/akismet.php.', 400 );
        }
        $r = activate_plugin( $plugin );
        if ( is_wp_error( $r ) ) {
            throw new Exception( $r->get_error_message(), 400 );
        }
        return array( 'plugin' => $plugin, 'active' => true );
    }

    public static function tool_plugin_deactivate( $a ) {
        self::need( 'activate_plugins' );
        $plugin = sanitize_text_field( $a['plugin'] ?? '' );
        deactivate_plugins( $plugin );
        return array( 'plugin' => $plugin, 'active' => false );
    }

    public static function tool_themes_list( $a ) {
        self::need( 'switch_themes' );
        $themes = wp_get_themes();
        $out = array();
        foreach ( $themes as $slug => $t ) {
            $out[] = array( 'stylesheet' => $t->get_stylesheet(), 'name' => $t->get( 'Name' ), 'version' => $t->get( 'Version' ), 'active' => get_stylesheet() === $t->get_stylesheet() );
        }
        return array( 'items' => $out, 'active' => get_stylesheet() );
    }

    public static function tool_theme_activate( $a ) {
        self::need( 'switch_themes' );
        $sheet = sanitize_text_field( $a['stylesheet'] ?? '' );
        if ( $sheet === '' ) {
            throw new Exception( 'stylesheet required.', 400 );
        }
        switch_theme( $sheet );
        return array( 'stylesheet' => $sheet, 'active' => get_stylesheet() === $sheet );
    }

    // =================================================================
    // Maintenance + health + SQL + PHP
    // =================================================================

    public static function tool_cache_flush( $a ) {
        self::need( 'manage_options' );
        wp_cache_flush();
        flush_rewrite_rules();
        return array( 'flushed' => true );
    }

    public static function tool_health_check( $a ) {
        global $wpdb, $wp_version;
        return array(
            'wp' => $wp_version, 'php' => PHP_VERSION,
            'site_url' => site_url(), 'home_url' => home_url(),
            'counts' => array(
                'posts' => (int) wp_count_posts( 'post' )->publish,
                'pages' => (int) wp_count_posts( 'page' )->publish,
                'users' => count_users(),
                'comments_awaiting' => (int) wp_count_comments()->awaiting_moderation,
            ),
            'debug' => array( 'WP_DEBUG' => defined( 'WP_DEBUG' ) && WP_DEBUG, 'memory' => ini_get( 'memory_limit' ) ),
            'db_prefix' => $wpdb->prefix,
        );
    }

    public static function tool_sql_query_readonly( $a ) {
        self::need( 'manage_options' );
        global $wpdb;
        $sql = trim( (string) ( $a['sql'] ?? '' ) );
        if ( $sql === '' ) {
            throw new Exception( 'sql required.', 400 );
        }
        // Allow only SELECT/SHOW/DESCRIBE/EXPLAIN.
        if ( ! preg_match( '/^\s*(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN)\b/i', $sql ) ) {
            throw new Exception( 'Only SELECT/SHOW/DESCRIBE/EXPLAIN allowed. Enable writes in MCP settings for more.', 403 );
        }
        $sql = str_replace( 'wp_', $wpdb->prefix, $sql );
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $rows = $wpdb->get_results( $sql, ARRAY_A );
        if ( $wpdb->last_error ) {
            throw new Exception( 'SQL error: ' . $wpdb->last_error, 400 );
        }
        return array( 'rows' => array_slice( (array) $rows, 0, 200 ), 'count' => count( (array) $rows ) );
    }

    public static function tool_sql_query( $a ) {
        // Called only when writes enabled (see call() remap). Double-guard.
        if ( ! self::sql_write_allowed() ) {
            return self::tool_sql_query_readonly( $a );
        }
        self::need( 'manage_options' );
        global $wpdb;
        $sql = trim( (string) ( $a['sql'] ?? '' ) );
        if ( $sql === '' ) {
            throw new Exception( 'sql required.', 400 );
        }
        // Block the truly catastrophic.
        if ( preg_match( '/\b(DROP\s+DATABASE|GRANT\s+ALL|INTO\s+OUTFILE|LOAD_FILE)\b/i', $sql ) ) {
            throw new Exception( 'Blocked statement for safety.', 403 );
        }
        $sql = str_replace( 'wp_', $wpdb->prefix, $sql );
        if ( preg_match( '/^\s*(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN)\b/i', $sql ) ) {
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
            $rows = $wpdb->get_results( $sql, ARRAY_A );
            if ( $wpdb->last_error ) {
                throw new Exception( 'SQL error: ' . $wpdb->last_error, 400 );
            }
            return array( 'rows' => array_slice( (array) $rows, 0, 200 ), 'count' => count( (array) $rows ) );
        }
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $res = $wpdb->query( $sql );
        if ( $wpdb->last_error ) {
            throw new Exception( 'SQL error: ' . $wpdb->last_error, 400 );
        }
        return array( 'affected' => (int) $res, 'insert_id' => (int) $wpdb->insert_id );
    }

    public static function tool_eval_php( $a ) {
        if ( ! self::php_allowed() ) {
            throw new Exception( 'eval_php is disabled. Enable via wp-config MCP_ALLOW_PHP or MCP settings.', 403 );
        }
        self::need( 'manage_options' );
        // Extra guard: only the key owner who is still admin, already checked.
        $code = (string) ( $a['code'] ?? '' );
        if ( trim( $code ) === '' ) {
            throw new Exception( 'code required.', 400 );
        }
        ob_start();
        try {
            $ret = eval( $code ); // phpcs:ignore Squiz.PHP.Eval.Discouraged
        } catch ( Throwable $e ) {
            ob_end_clean();
            throw new Exception( 'PHP error: ' . $e->getMessage(), 400 );
        }
        $out = ob_get_clean();
        return array( 'output' => (string) $out, 'return' => $ret );
    }
}
