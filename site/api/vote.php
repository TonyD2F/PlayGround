<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    hf_json(['ok' => false, 'code' => 'method'], 405);
}

[$cfg, $pdo] = hf_boot();
if (!$pdo) {
    hf_json(['ok' => false, 'code' => 'db_down'], 503);
}

$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);
if (!is_array($body)) {
    $body = $_POST;
}

$v = hf_validate_vote($body['store_id'] ?? null, $body['choice'] ?? null);
if (!$v['ok']) {
    hf_json(['ok' => false, 'code' => $v['code']], 400);
}

$ip = hf_client_ip($_SERVER);
$ua = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
$fp = hf_fingerprint($ip, $ua, $cfg['vote_salt']);
$ipHash = hash('sha256', $ip . '|' . $cfg['vote_salt']);
$period = hf_current_period($cfg['tz']);

// Rate limit: 30 votes/minute per IP.
try {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM votes WHERE ip_hash = ? AND created_at >= (NOW() - INTERVAL 1 MINUTE)");
    // sqlite fallback (tests): datetime('now','-1 minute')
    try {
        $stmt->execute([$ipHash]);
        $count = (int)$stmt->fetchColumn();
    } catch (Throwable $e) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM votes WHERE ip_hash = ? AND created_at >= datetime('now','-1 minute')");
        $stmt->execute([$ipHash]);
        $count = (int)$stmt->fetchColumn();
    }
} catch (Throwable $e) {
    $count = 0;
}
if (!hf_rate_ok($count, $cfg['rate_limit_per_min'])) {
    hf_json(['ok' => false, 'code' => 'rate_limited'], 429);
}

// Store must exist + active.
try {
    $stmt = $pdo->prepare("SELECT id FROM stores WHERE id = ? AND status = 'active'");
    $stmt->execute([$v['store_id']]);
    if (!$stmt->fetch()) {
        hf_json(['ok' => false, 'code' => 'bad_store'], 404);
    }
} catch (Throwable $e) {
    hf_json(['ok' => false, 'code' => 'db_down'], 503);
}

// Insert (dedupe via unique store+period+fingerprint).
try {
    $stmt = $pdo->prepare("INSERT INTO votes (store_id, period_key, choice, fingerprint, ip_hash) VALUES (?,?,?,?,?)");
    $stmt->execute([$v['store_id'], $period['key'], $v['choice'], $fp, $ipHash]);
} catch (Throwable $e) {
    hf_json(['ok' => false, 'code' => 'duplicate'], 409);
}

// Bump counter.
$col = $v['choice'] === 'yes' ? 'yes_votes' : 'no_votes';
try {
    $stmt = $pdo->prepare("UPDATE stores SET {$col} = {$col} + 1 WHERE id = ?");
    $stmt->execute([$v['store_id']]);
    $stmt = $pdo->prepare("SELECT yes_votes, no_votes, lp_reports FROM stores WHERE id = ?");
    $stmt->execute([$v['store_id']]);
    $row = $stmt->fetch();
} catch (Throwable $e) {
    $row = ['yes_votes' => 0, 'no_votes' => 0, 'lp_reports' => 0];
}

hf_json([
    'ok' => true,
    'code' => 'ok',
    'period' => $period,
    'tally' => [
        'store_id' => $v['store_id'],
        'yes' => (int)($row['yes_votes'] ?? 0),
        'no' => (int)($row['no_votes'] ?? 0),
        'lp' => (int)($row['lp_reports'] ?? 0),
    ],
]);
