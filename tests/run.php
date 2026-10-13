<?php
declare(strict_types=1);
// Usage: php tests/run.php
$totalFail = 0;
foreach (['period.test.php', 'http.test.php'] as $f) {
    echo "== $f ==\n";
    $fail = require __DIR__ . '/' . $f;
    $totalFail += (int)$fail;
}
echo $totalFail === 0 ? "\nALL PASS\n" : "\n{$totalFail} FAILURES\n";
exit($totalFail === 0 ? 0 : 1);
