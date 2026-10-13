<?php
declare(strict_types=1);

/**
 * Voting period resolution (Pacific Time).
 *
 * 4 periods per day, America/Los_Angeles wall-clock:
 *   P1 Morning   05:00 inclusive – 12:00 exclusive
 *   P2 Afternoon 12:00 inclusive – 17:00 exclusive
 *   P3 Evening   17:00 inclusive – 22:00 exclusive
 *   P4 Overnight 22:00 inclusive – 05:00 exclusive (next day)
 *
 * Overnight hours 00:00–04:59 belong to the PREVIOUS calendar day's P4.
 * Key format: YYYY-MM-DD-PN where date is the period date (not always calendar date).
 */

const HF_TZ = 'America/Los_Angeles';

/** @return array{date:string,slot:int,key:string,label:string,starts_at:int,ends_at:int} */
function hf_period_for_timestamp(int $ts, string $tz = HF_TZ): array
{
    $dt = (new DateTimeImmutable('@' . $ts))->setTimezone(new DateTimeZone($tz));
    $hour = (int)$dt->format('G'); // 0-23
    $min = (int)$dt->format('i');

    if ($hour >= 5 && $hour < 12) {
        $slot = 1;
        $periodDate = $dt->format('Y-m-d');
    } elseif ($hour >= 12 && $hour < 17) {
        $slot = 2;
        $periodDate = $dt->format('Y-m-d');
    } elseif ($hour >= 17 && $hour < 22) {
        $slot = 3;
        $periodDate = $dt->format('Y-m-d');
    } else {
        $slot = 4;
        // 22:00-23:59 -> today; 00:00-04:59 -> yesterday
        $periodDate = ($hour >= 22)
            ? $dt->format('Y-m-d')
            : $dt->modify('-1 day')->format('Y-m-d');
    }

    $tzObj = new DateTimeZone($tz);
    $dayStart = (new DateTimeImmutable($periodDate . ' 00:00:00', $tzObj))->getTimestamp();

    // Offsets in seconds from period-date midnight.
    $bounds = [
        1 => [5 * 3600, 12 * 3600],
        2 => [12 * 3600, 17 * 3600],
        3 => [17 * 3600, 22 * 3600],
        4 => [22 * 3600, 29 * 3600], // ends 05:00 next day
    ];
    [$sOff, $eOff] = $bounds[$slot];

    $labels = [1 => 'Morning 5a–12p', 2 => 'Afternoon 12p–5p', 3 => 'Evening 5p–10p', 4 => 'Overnight 10p–5a'];

    return [
        'date' => $periodDate,
        'slot' => $slot,
        'key' => sprintf('%s-P%d', $periodDate, $slot),
        'label' => $labels[$slot],
        'starts_at' => $dayStart + $sOff,
        'ends_at' => $dayStart + $eOff,
    ];
}

/** @return array{date:string,slot:int,key:string,label:string,starts_at:int,ends_at:int} */
function hf_current_period(string $tz = HF_TZ): array
{
    return hf_period_for_timestamp(time(), $tz);
}
