<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/bootstrap.php';

[$cfg, $pdo] = hf_boot();
$period = hf_current_period($cfg['tz']);

$stores = [];
if ($pdo) {
    try {
        $stmt = $pdo->query("SELECT id,name,address,lat,lng,status,yes_votes,no_votes,lp_reports FROM stores WHERE status='active' ORDER BY name");
        foreach ($stmt->fetchAll() as $r) {
            $stores[] = [
                'id' => (int)$r['id'],
                'name' => $r['name'],
                'address' => $r['address'],
                'lat' => (float)$r['lat'],
                'lng' => (float)$r['lng'],
                'yes' => (int)$r['yes_votes'],
                'no' => (int)$r['no_votes'],
                'lp' => (int)$r['lp_reports'],
                'has_lp' => ((int)$r['lp_reports']) >= 1,
            ];
        }
    } catch (Throwable $e) {
        $stores = [];
    }
}

hf_json([
    'period' => $period,
    'stores' => $stores,
    'settings' => [
        'poll_ms' => $cfg['poll_ms'],
        'map' => ['lat' => $cfg['map_lat'], 'lng' => $cfg['map_lng'], 'zoom' => $cfg['map_zoom']],
    ],
]);
