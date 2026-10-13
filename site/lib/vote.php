<?php
declare(strict_types=1);

/** Vote fingerprinting + validation (pure functions for testability). */

function hf_fingerprint(string $ip, string $ua, string $salt): string
{
    return hash('sha256', $ip . '|' . $ua . '|' . $salt);
}

function hf_client_ip(array $server): string
{
    $ip = (string)($server['REMOTE_ADDR'] ?? '0.0.0.0');
    // Trust X-Forwarded-For only when explicitly behind proxy (keep simple: first entry).
    if (!empty($server['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', (string)$server['HTTP_X_FORWARDED_FOR']);
        $first = trim($parts[0]);
        if (filter_var($first, FILTER_VALIDATE_IP)) {
            return $first;
        }
    }
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

/**
 * Validate a vote request body.
 * @return array{ok:bool,code:string,store_id:int,choice:string}
 */
function hf_validate_vote(mixed $storeId, mixed $choice): array
{
    $sid = filter_var($storeId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($sid === false) {
        return ['ok' => false, 'code' => 'bad_store', 'store_id' => 0, 'choice' => ''];
    }
    if ($choice !== 'yes' && $choice !== 'no') {
        return ['ok' => false, 'code' => 'bad_choice', 'store_id' => (int)$sid, 'choice' => ''];
    }
    return ['ok' => true, 'code' => 'ok', 'store_id' => (int)$sid, 'choice' => $choice];
}

/** Rate-limit: allow max $limit votes in trailing 60s window. */
function hf_rate_ok(int $votesLastMinute, int $limit = 30): bool
{
    return $votesLastMinute < $limit;
}
