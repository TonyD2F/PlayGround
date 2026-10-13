<?php
declare(strict_types=1);
// Hidden admin: token gate via HF_ADMIN_TOKEN env. Not linked from public UI.
require_once __DIR__ . '/../lib/bootstrap.php';

$token = (string)(getenv('HF_ADMIN_TOKEN') ?: '');
$given = (string)($_GET['token'] ?? $_POST['token'] ?? '');
if ($token === '' || !hash_equals($token, $given)) {
    http_response_code(403);
    echo '<h1>Forbidden</h1><p>Valid token required.</p>';
    exit;
}
[$cfg, $pdo] = hf_boot();
$msg = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && $pdo) {
    $action = (string)($_POST['action'] ?? '');
    $id = (int)($_POST['store_id'] ?? 0);
    if ($action === 'set_lp' && $id > 0) {
        $lp = max(0, (int)($_POST['lp'] ?? 0));
        $st = $pdo->prepare('UPDATE stores SET lp_reports = ? WHERE id = ?');
        $st->execute([$lp, $id]);
        $msg = "Store $id lp_reports=$lp";
    } elseif ($action === 'reset_votes' && $id > 0) {
        $pdo->prepare('DELETE FROM votes WHERE store_id = ?')->execute([$id]);
        $pdo->prepare('UPDATE stores SET yes_votes=0, no_votes=0 WHERE id = ?')->execute([$id]);
        $msg = "Store $id votes reset";
    }
}
$stores = $pdo ? $pdo->query('SELECT id,name,yes_votes,no_votes,lp_reports FROM stores ORDER BY id')->fetchAll() : [];
?>
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Admin</title></head><body>
<h1>Store admin</h1>
<?php if ($msg): ?><p><b><?= htmlspecialchars($msg) ?></b></p><?php endif; ?>
<table border="1" cellpadding="6">
<tr><th>ID</th><th>Name</th><th>Yes</th><th>No</th><th>LP</th><th>Set LP</th><th>Reset</th></tr>
<?php foreach ($stores as $s): ?>
<tr>
<td><?= (int)$s['id'] ?></td><td><?= htmlspecialchars($s['name']) ?></td>
<td><?= (int)$s['yes_votes'] ?></td><td><?= (int)$s['no_votes'] ?></td><td><?= (int)$s['lp_reports'] ?></td>
<td><form method="post"><input type="hidden" name="token" value="<?= htmlspecialchars($given) ?>">
<input type="hidden" name="action" value="set_lp"><input type="hidden" name="store_id" value="<?= (int)$s['id'] ?>">
<input type="number" name="lp" min="0" value="<?= (int)$s['lp_reports'] ?>" style="width:60px"><button>Save</button></form></td>
<td><form method="post" onsubmit="return confirm('Reset votes?')"><input type="hidden" name="token" value="<?= htmlspecialchars($given) ?>">
<input type="hidden" name="action" value="reset_votes"><input type="hidden" name="store_id" value="<?= (int)$s['id'] ?>"><button>Reset</button></form></td>
</tr>
<?php endforeach; ?>
</table>
</body></html>
