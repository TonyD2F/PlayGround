# ADR 0001 — 4-period Pacific day

- Date: 2026-10-13
- Status: accepted
- Context: need human-meaningful LP vote windows, DST-safe, Hostinger cron-free.
- Decision: P1 05:00–12:00, P2 12:00–17:00, P3 17:00–22:00, P4 22:00–05:00; tz `America/Los_Angeles`; overnight attributed to prior date; key `YYYY-MM-DD-PN`.
- Consequences: 00:00–04:59 votes count toward yesterday; DST transitions handled by PHP tz DB (covered in `tests/period.test.php`).
