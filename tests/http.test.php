<?php
declare(strict_types=1);
require_once __DIR__ . '/../site/lib/vote.php';
require_once __DIR__ . '/../site/lib/db.php';
require_once __DIR__ . '/../site/lib/config.php';

$failures = 0;
function h_ok(bool $cond, string $msg): void
{
    global $failures;
    if ($cond) {
        echo "ok - $msg\n";
    } else {
        $failures++;
        echo "FAIL - $msg\n";
    }
}

// Validation.
$v = hf_validate_vote(3, 'yes');
h_ok($v['ok'] && $v['store_id'] === 3 && $v['choice'] === 'yes', 'accept yes vote');
$v = hf_validate_vote('2', 'no');
h_ok($v['ok'] && $v['store_id'] === 2, 'accept string int id');
h_ok(!hf_validate_vote(0, 'yes')['ok'], 'reject store 0');
h_ok(!hf_validate_vote(-1, 'yes')['ok'], 'reject negative store');
h_ok(!hf_validate_vote('abc', 'yes')['ok'], 'reject non-numeric store');
h_ok(!hf_validate_vote(1, 'maybe')['ok'], 'reject bad choice');
h_ok(!hf_validate_vote(1, 'YES')['ok'], 'choice case-sensitive');
h_ok(!hf_validate_vote(1, '')['ok'], 'reject empty choice');

// Rate limiting.
h_ok(hf_rate_ok(0) && hf_rate_ok(29) && !hf_rate_ok(30) && !hf_rate_ok(99), '30/min boundary');

// Fingerprint.
$a = hf_fingerprint('1.2.3.4', 'UA', 'salt');
h_ok($a === hf_fingerprint('1.2.3.4', 'UA', 'salt'), 'fingerprint stable');
h_ok(strlen($a) === 64 && ctype_xdigit($a), 'fingerprint sha256 hex');
h_ok($a !== hf_fingerprint('5.6.7.8', 'UA', 'salt'), 'fingerprint differs by ip');
h_ok($a !== hf_fingerprint('1.2.3.4', 'Other', 'salt'), 'fingerprint differs by ua');

// Client IP.
h_ok(hf_client_ip(['REMOTE_ADDR' => '9.9.9.9']) === '9.9.9.9', 'direct ip');
h_ok(hf_client_ip(['REMOTE_ADDR' => '10.0.0.1', 'HTTP_X_FORWARDED_FOR' => '8.8.8.8, 10.0.0.1']) === '8.8.8.8', 'xff first');
h_ok(hf_client_ip([]) === '0.0.0.0', 'missing ip fallback');

// Duplicate vote enforced at DB layer (sqlite memory).
$pdo = hf_pdo(['db_host' => 'sqlite']);
hf_ensure_test_schema($pdo);
$pdo->exec("INSERT INTO stores (name,lat,lng) VALUES ('t',47.6,-122.3)");
$pdo->prepare('INSERT INTO votes (store_id,period_key,choice,fingerprint,ip_hash) VALUES (1,?,?,?,?)')
    ->execute(['2026-10-13-P1', 'yes', 'fp1', 'ip1']);
$dup = false;
try {
    $pdo->prepare('INSERT INTO votes (store_id,period_key,choice,fingerprint,ip_hash) VALUES (1,?,?,?,?)')
        ->execute(['2026-10-13-P1', 'yes', 'fp1', 'ip1']);
} catch (Throwable $e) {
    $dup = true;
}
h_ok($dup, 'duplicate store+period+fingerprint rejected');
// Same fingerprint, different period -> allowed.
$otherPeriod = true;
try {
    $pdo->prepare('INSERT INTO votes (store_id,period_key,choice,fingerprint,ip_hash) VALUES (1,?,?,?,?)')
        ->execute(['2026-10-13-P2', 'yes', 'fp1', 'ip1']);
} catch (Throwable $e) {
    $otherPeriod = false;
}
h_ok($otherPeriod, 'same fingerprint new period allowed');

return $failures;
