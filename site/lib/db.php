<?php
declare(strict_types=1);

/** PDO factory: MySQL in prod, sqlite when HF_DB_HOST=sqlite (tests). */
function hf_pdo(array $cfg): PDO
{
    if (($cfg['db_host'] ?? '') === 'sqlite') {
        $pdo = new PDO('sqlite::memory:');
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $pdo;
    }
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $cfg['db_host'], $cfg['db_name']);
    $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

/** Create minimal tables for sqlite test runs (prod uses site/sql/schema.sql). */
function hf_ensure_test_schema(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS stores (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, address TEXT DEFAULT \'\', lat REAL, lng REAL, status TEXT DEFAULT \'active\', yes_votes INTEGER DEFAULT 0, no_votes INTEGER DEFAULT 0, lp_reports INTEGER DEFAULT 0)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS votes (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER, period_key TEXT, choice TEXT, fingerprint TEXT, ip_hash TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(store_id, period_key, fingerprint))');
}
