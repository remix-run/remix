-- Demo data for the bookstore. Statements are idempotent so the seed is safe
-- to run against an already-seeded database.
-- Password hashes are pbkdf2_sha256 (see app/utils/password-hash.ts):
--   admin@bookstore.com    admin123
--   customer@example.com   password123

insert or ignore into books (id, slug, title, author, description, price, genre, image_urls, cover_url, isbn, published_year, in_stock) values
  (1, 'bbq', 'Ash & Smoke', 'Rusty Char-Broil', 'The perfect gift for the BBQ enthusiast in your life!', 16.99, 'cookbook', '["/images/bbq-1.png","/images/bbq-2.png","/images/bbq-3.png"]', '/images/bbq-1.png', '978-0525559474', 2020, 1),
  (2, 'heavy-metal', 'Heavy Metal Guitar Riffs', 'Axe Master Krush', 'The ultimate guide to heavy metal guitar riffs!', 27.0, 'music', '["/images/heavy-metal-1.png","/images/heavy-metal-2.png","/images/heavy-metal-3.png"]', '/images/heavy-metal-1.png', '978-0735211292', 2018, 1),
  (3, 'three-ways', 'Three Ways to Change Your Life', 'Wisdom Sage', 'Life-changing guidance for modern living and personal growth.', 28.99, 'self-help', '["/images/three-ways-1.png","/images/three-ways-2.png","/images/three-ways-3.png"]', '/images/three-ways-1.png', '978-0061120084', 2021, 0),
  (4, 'midnight-platform', 'The Midnight Platform', 'Nora Vale', 'When the last train arrives with an empty carriage and a suitcase full of letters, a retired stationmaster has one night to unravel a disappearance that began thirty years ago. An atmospheric railway mystery for rainy evenings.', 24.99, 'mystery', '["/images/midnight-platform-1.png","/images/midnight-platform-2.png","/images/midnight-platform-3.png"]', '/images/midnight-platform-1.png', '978-1-55555-010-3', 2025, 1),
  (5, 'wild-windowsill', 'Wild at the Windowsill', 'Fern Holloway', 'Turn even the smallest apartment into a leafy retreat. Grow kitchen herbs, coax cuttings into roots, and build a thriving windowsill garden with illustrated projects and practical advice for every season.', 22.5, 'gardening', '["/images/wild-windowsill-1.png","/images/wild-windowsill-2.png","/images/wild-windowsill-3.png"]', '/images/wild-windowsill-1.png', '978-1-55555-011-0', 2024, 1),
  (6, 'saltwater-summer', 'Saltwater Summer', 'June Marlowe', 'Three old friends inherit a weather-beaten beach cottage and a summer to decide what comes next. A warm, witty coastal novel about second chances, found family, and the things the tide brings back.', 19.99, 'fiction', '["/images/saltwater-summer-1.png","/images/saltwater-summer-2.png","/images/saltwater-summer-3.png"]', '/images/saltwater-summer-1.png', '978-1-55555-012-7', 2026, 1);

insert or ignore into users (id, email, password_hash, name, role, created_at) values
  (1, 'admin@bookstore.com', 'pbkdf2_sha256$100000$Fyiej9zGB7-ZynH8DRWUJQ$AMSk4t8p8Jw9DVw8EdHOcq_g8SUtzTbh0agA9g0Q0qY', 'Admin User', 'admin', 1705276800000),
  (2, 'customer@example.com', 'pbkdf2_sha256$100000$R-GBp6yHQBgiqGkXZm70IQ$PmYoRXgmMoFYh2ONKFQ-KDg-QvfPAfBduyMlsX7tveA', 'John Doe', 'customer', 1709251200000);

insert or ignore into orders (id, user_id, total, status, shipping_address_json, created_at) values
  (1001, 2, 45.98, 'delivered', '{"street":"123 Main St","city":"Boston","state":"MA","zip":"02101"}', 1726358400000),
  (1002, 2, 54.0, 'shipped', '{"street":"123 Main St","city":"Boston","state":"MA","zip":"02101"}', 1727740800000);

insert or ignore into order_items (order_id, book_id, title, unit_price, quantity) values
  (1001, 1, 'Ash & Smoke', 16.99, 1),
  (1001, 3, 'Three Ways to Change Your Life', 28.99, 1),
  (1002, 2, 'Heavy Metal Guitar Riffs', 27.0, 2);
