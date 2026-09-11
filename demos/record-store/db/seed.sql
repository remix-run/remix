-- Demo data for the record store. Statements are idempotent so the seed is safe
-- to run against an already-seeded database.
-- Password hashes are pbkdf2_sha256 (see app/utils/password-hash.ts):
--   admin@recordstore.com   admin123
--   customer@example.com    password123

insert or ignore into albums (id, slug, title, artist, description, price, genre, image_urls, cover_url, catalog_number, release_year, in_stock) values
  (1, 'flannel-overdrive', 'Flannel Overdrive', 'Puddle of Angst', 'Twelve tracks of distorted feelings straight out of the Pacific Northwest.', 13.99, 'grunge', '["/images/flannel-overdrive-1.png","/images/flannel-overdrive-2.png","/images/flannel-overdrive-3.png"]', '/images/flannel-overdrive-1.png', 'RSD-49001-2', 1993, 1),
  (2, 'shred-till-dawn', 'Shred Till Dawn', 'Axe Master Krush', 'The ultimate collection of heavy metal guitar riffs!', 14.99, 'metal', '["/images/shred-till-dawn-1.png","/images/shred-till-dawn-2.png","/images/shred-till-dawn-3.png"]', '/images/shred-till-dawn-1.png', 'RSD-49002-2', 1992, 1),
  (3, 'boom-bap-boulevard', 'Boom Bap Boulevard', 'MC Circuit Breaker', 'Golden-era beats and rhymes recorded on a pager budget.', 16.99, 'hip-hop', '["/images/boom-bap-boulevard-1.png","/images/boom-bap-boulevard-2.png","/images/boom-bap-boulevard-3.png"]', '/images/boom-bap-boulevard-1.png', 'RSD-49003-2', 1995, 1),
  (4, 'mall-hair-forever', 'Mall Hair Forever', 'Aqua Nette', 'Maximum hairspray, maximum hooks. As seen at the food court.', 11.99, 'pop', '["/images/mall-hair-forever-1.png","/images/mall-hair-forever-2.png","/images/mall-hair-forever-3.png"]', '/images/mall-hair-forever-1.png', 'RSD-49004-2', 1991, 1),
  (5, 'dial-up-heartbreak', 'Dial-Up Heartbreak', 'The Modem Tones', 'Lo-fi love songs for the information superhighway.', 15.99, 'alternative', '["/images/dial-up-heartbreak-1.png","/images/dial-up-heartbreak-2.png","/images/dial-up-heartbreak-3.png"]', '/images/dial-up-heartbreak-1.png', 'RSD-49005-2', 1996, 1),
  (6, 'midnight-fax', 'Midnight Fax', 'Velvet Rewind', 'Smooth late-night grooves for sophisticated office equipment.', 16.99, 'r-and-b', '["/images/midnight-fax-1.png","/images/midnight-fax-2.png","/images/midnight-fax-3.png"]', '/images/midnight-fax-1.png', 'RSD-49006-2', 1994, 1),
  (7, 'pick-it-up-again', 'Pick It Up (Again)', 'The Checkered Slacks', 'Horns. Checkerboards. More horns. Third wave, first pressing.', 12.99, 'ska', '["/images/pick-it-up-again-1.png","/images/pick-it-up-again-2.png","/images/pick-it-up-again-3.png"]', '/images/pick-it-up-again-1.png', 'RSD-49007-2', 1997, 0);

insert or ignore into users (id, email, password_hash, name, role, created_at) values
  (1, 'admin@recordstore.com', 'pbkdf2_sha256$100000$Fyiej9zGB7-ZynH8DRWUJQ$AMSk4t8p8Jw9DVw8EdHOcq_g8SUtzTbh0agA9g0Q0qY', 'Admin User', 'admin', 1705276800000),
  (2, 'customer@example.com', 'pbkdf2_sha256$100000$R-GBp6yHQBgiqGkXZm70IQ$PmYoRXgmMoFYh2ONKFQ-KDg-QvfPAfBduyMlsX7tveA', 'John Doe', 'customer', 1709251200000);

insert or ignore into orders (id, user_id, total, status, shipping_address_json, created_at) values
  (1001, 2, 25.98, 'delivered', '{"street":"123 Main St","city":"Boston","state":"MA","zip":"02101"}', 1726358400000),
  (1002, 2, 33.98, 'shipped', '{"street":"123 Main St","city":"Boston","state":"MA","zip":"02101"}', 1727740800000);

insert or ignore into order_items (order_id, album_id, title, unit_price, quantity) values
  (1001, 1, 'Flannel Overdrive', 13.99, 1),
  (1001, 4, 'Mall Hair Forever', 11.99, 1),
  (1002, 3, 'Boom Bap Boulevard', 16.99, 2);
