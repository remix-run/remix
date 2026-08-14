-- Demo credential users. Statements are idempotent so the seed is safe to run
-- against an already-seeded database.
-- Password hashes are pbkdf2_sha256 (see app/utils/password-hash.ts); both
-- accounts use the password "password123".

insert or ignore into users (id, email, password_hash, name, avatar_url, created_at, updated_at) values
  (1, 'admin@example.com', 'pbkdf2_sha256$100000$_QBCG3pPbKgGCIvh7Xat2A$cIkwiKE-rAEVcKacgbtYL5l2ab5lrQKiIkXPCry38Xo', 'Demo Admin', 'https://randomuser.me/api/portraits/women/44.jpg', 1705276800000, 1705276800000),
  (2, 'user@example.com', 'pbkdf2_sha256$100000$rSZlEp0rbzaRXm8aefQWpA$vU8GiCvUW0Q3qwJHsOY3rv42iiFHaKfVQmkXtdYYPWA', 'Demo User', 'https://randomuser.me/api/portraits/men/32.jpg', 1705276800000, 1705276800000);
