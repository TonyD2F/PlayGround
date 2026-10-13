<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/period.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/vote.php';

date_default_timezone_set('America/Los_Angeles');

function hf_json(mixed $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

/** Shared bootstrap: returns [cfg, pdo-or-null]. PDO failure returns null (state still serves seed). */
function hf_boot(): array
{
    $cfg = hf_config();
    try {
        $pdo = hf_pdo($cfg);
    } catch (Throwable $e) {
        $pdo = null;
    }
    return [$cfg, $pdo];
}
