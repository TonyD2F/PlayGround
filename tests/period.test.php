<?php
declare(strict_types=1);
require_once __DIR__ . '/../site/lib/period.php';

$failures = 0;
function t_ok(bool $cond, string $msg): void
{
    global $failures;
    if ($cond) {
        echo "ok - $msg\n";
    } else {
        $failures++;
        echo "FAIL - $msg\n";
    }
}

function ts(string $local): int
{
    return (new DateTimeImmutable($local, new DateTimeZone('America/Los_Angeles')))->getTimestamp();
}

// Boundaries 2026-10-13 (a Tuesday, PDT UTC-7).
$p = hf_period_for_timestamp(ts('2026-10-13 04:59:00'));
t_ok($p['slot'] === 4 && $p['date'] === '2026-10-12' && $p['key'] === '2026-10-12-P4', '04:59 -> prev-day P4');

$p = hf_period_for_timestamp(ts('2026-10-13 05:00:00'));
t_ok($p['slot'] === 1 && $p['date'] === '2026-10-13' && $p['key'] === '2026-10-13-P1', '05:00 -> P1');

$p = hf_period_for_timestamp(ts('2026-10-13 11:59:59'));
t_ok($p['slot'] === 1, '11:59 -> P1');

$p = hf_period_for_timestamp(ts('2026-10-13 12:00:00'));
t_ok($p['slot'] === 2 && $p['key'] === '2026-10-13-P2', '12:00 -> P2');

$p = hf_period_for_timestamp(ts('2026-10-13 16:59:59'));
t_ok($p['slot'] === 2, '16:59 -> P2');

$p = hf_period_for_timestamp(ts('2026-10-13 17:00:00'));
t_ok($p['slot'] === 3 && $p['key'] === '2026-10-13-P3', '17:00 -> P3');

$p = hf_period_for_timestamp(ts('2026-10-13 21:59:59'));
t_ok($p['slot'] === 3, '21:59 -> P3');

$p = hf_period_for_timestamp(ts('2026-10-13 22:00:00'));
t_ok($p['slot'] === 4 && $p['date'] === '2026-10-13', '22:00 -> P4 same day');

$p = hf_period_for_timestamp(ts('2026-10-14 00:30:00'));
t_ok($p['slot'] === 4 && $p['date'] === '2026-10-13', '00:30 -> prev-day P4');

// starts/ends sanity: P1 5h..12h from midnight.
$p1 = hf_period_for_timestamp(ts('2026-10-13 08:00:00'));
t_ok($p1['ends_at'] - $p1['starts_at'] === 7 * 3600, 'P1 length 7h');
$p4 = hf_period_for_timestamp(ts('2026-10-13 23:00:00'));
t_ok($p4['ends_at'] - $p4['starts_at'] === 7 * 3600, 'P4 length 7h');

// DST spring forward 2026-03-08 (02:00 skipped).
$p = hf_period_for_timestamp(ts('2026-03-08 01:59:00'));
t_ok($p['slot'] === 4 && $p['date'] === '2026-03-07', 'DST spring 01:59 -> P4 prev day');
$p = hf_period_for_timestamp(ts('2026-03-08 03:00:00'));
t_ok($p['slot'] === 4 && $p['date'] === '2026-03-07', 'DST spring 03:00 PDT -> P4 prev day');
$p = hf_period_for_timestamp(ts('2026-03-08 05:00:00'));
t_ok($p['slot'] === 1 && $p['date'] === '2026-03-08', 'DST spring 05:00 -> P1');

// DST fall back 2026-11-01 (01:00-02:00 repeats).
$p = hf_period_for_timestamp(ts('2026-11-01 00:30:00'));
t_ok($p['slot'] === 4 && $p['date'] === '2026-10-31', 'DST fall 00:30 -> P4 prev day');

return $failures;
