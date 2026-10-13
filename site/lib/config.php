<?php
declare(strict_types=1);

/**
 * Configuration loader. Env overrides file defaults (Hostinger-friendly).
 *
 * Env vars: HF_DB_HOST, HF_DB_NAME, HF_DB_USER, HF_DB_PASS, HF_VOTE_SALT,
 *           HF_POLL_MS, HF_MAP_LAT, HF_MAP_LNG, HF_MAP_ZOOM, HF_ADMIN_PATH
 */

/** @return array<string,mixed> */
function hf_config(array $env = []): array
{
    $e = static function (string $k, string $default = '') use ($env): string {
        if (array_key_exists($k, $env)) {
            return (string)$env[$k];
        }
        $v = getenv($k);
        return $v === false ? $default : (string)$v;
    };

    return [
        'db_host' => $e('HF_DB_HOST', 'localhost'),
        'db_name' => $e('HF_DB_NAME', 'hellfetty'),
        'db_user' => $e('HF_DB_USER', 'hellfetty'),
        'db_pass' => $e('HF_DB_PASS', ''),
        'vote_salt' => $e('HF_VOTE_SALT', 'change-me-in-production'),
        'poll_ms' => (int)$e('HF_POLL_MS', '15000'),
        'map_lat' => (float)$e('HF_MAP_LAT', '47.5480'),
        'map_lng' => (float)$e('HF_MAP_LNG', '-122.2280'),
        'map_zoom' => (int)$e('HF_MAP_ZOOM', '10'),
        'admin_path' => $e('HF_ADMIN_PATH', 'admin-panel-9x4k2'),
        'rate_limit_per_min' => 30,
        'tz' => 'America/Los_Angeles',
    ];
}
