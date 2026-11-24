-- Demo data for the record store. Statements are idempotent so the seed is safe
-- to run against an already-seeded database.
-- Password hashes are pbkdf2_sha256 (see app/utils/password-hash.ts):
--   admin@recordstore.com    admin123
--   customer@example.com   password123

insert or ignore into albums (id, slug, title, artist, description, price, genre, image_urls, cover_url, catalog_number, release_year, in_stock) values
  (1, 'overpass-stereo', 'Overpass Stereo', 'Mile Marker Club', 'Big, bright guitar hooks and a road-worn rhythm section give these six songs the feel of an FM station just over the next hill. The 1994 debut on black vinyl.', 15.99, 'rock', '["/images/overpass-stereo-1.png","/images/overpass-stereo-2.png","/images/overpass-stereo-3.png"]', '/images/overpass-stereo-1.png', 'RSD-49005-1', 1994, 1),
  (2, 'shred-till-dawn', 'Shred Till Dawn', 'Axe Master Krush', 'A midnight set of palm-muted riffs, twin-guitar leads, and solos that sound like blown fuses. The 1992 debut on black vinyl.', 14.99, 'rock', '["/images/shred-till-dawn-1.png","/images/shred-till-dawn-2.png","/images/shred-till-dawn-3.png"]', '/images/shred-till-dawn-1.png', 'RSD-49002-1', 1992, 1),
  (3, 'last-bell-first-kiss', 'Last Bell, First Kiss', 'Locker Row Five', 'Five voices trade leads over drum-machine claps and bright acoustic guitar. The harmonies get bigger as the songs move from waiting by the pay phone to the last slow dance of the night.', 16.99, 'boy-band', '["/images/last-bell-first-kiss-1.png","/images/last-bell-first-kiss-2.png","/images/last-bell-first-kiss-3.png"]', '/images/last-bell-first-kiss-1.png', 'RSD-49007-1', 1999, 1),
  (4, 'flannel-overdrive', 'Flannel Overdrive', 'Puddle of Angst', 'Rain-soaked Pacific Northwest grunge with frayed guitar tones, heavy drums, and hooks that sneak up through the static. The 1993 debut on black vinyl.', 13.99, 'grunge', '["/images/flannel-overdrive-1.png","/images/flannel-overdrive-2.png","/images/flannel-overdrive-3.png"]', '/images/flannel-overdrive-1.png', 'RSD-49001-1', 1993, 1),
  (5, 'boom-bap-boulevard', 'Boom Bap Boulevard', 'MC Circuit Breaker', 'Dusty breaks, chopped brass, and sharp verses about the blocks that come alive after the last train. A 1995 debut that makes a borrowed sampler sound bigger than the city.', 16.99, 'hip-hop', '["/images/boom-bap-boulevard-1.png","/images/boom-bap-boulevard-2.png","/images/boom-bap-boulevard-3.png"]', '/images/boom-bap-boulevard-1.png', 'RSD-49003-1', 1995, 1),
  (6, 'mall-hair-forever', 'Mall Hair Forever', 'Aqua Nette', 'Fizzy synths, big group choruses, and songs about making the five o’clock bus after the arcade closes. Aqua Nette’s 1991 debut sounds like a Saturday at the mall.', 11.99, 'pop', '["/images/mall-hair-forever-1.png","/images/mall-hair-forever-2.png","/images/mall-hair-forever-3.png"]', '/images/mall-hair-forever-1.png', 'RSD-49004-1', 1991, 1),
  (7, 'midnight-fax', 'Midnight Fax', 'Velvet Rewind', 'Velvet Rewind match unhurried bass lines and soft drum-machine snaps with close vocal harmonies. A 1994 late-night R&B session on black vinyl.', 16.99, 'r-and-b', '["/images/midnight-fax-1.png","/images/midnight-fax-2.png","/images/midnight-fax-3.png"]', '/images/midnight-fax-1.png', 'RSD-49006-1', 1994, 1),
  (8, 'pick-it-up-again', 'Pick It Up (Again)', 'The Checkered Slacks', 'A 1997 ska LP with punchy three-piece horns, wiry upstrokes, and shout-along choruses about missing the last bus and dancing anyway.', 12.99, 'ska', '["/images/pick-it-up-again-1.png","/images/pick-it-up-again-2.png","/images/pick-it-up-again-3.png"]', '/images/pick-it-up-again-1.png', 'RSD-49010-1', 1997, 0),
  (9, 'porchlight-mile', 'Porchlight Mile', 'Tess Wilderock', 'Pedal steel and brushed drums follow a clear alto through songs about laundromats, county roads, and the porch light at the end of a long drive. Recorded with a small band in 1996.', 17.99, 'country', '["/images/porchlight-mile-1.png","/images/porchlight-mile-2.png","/images/porchlight-mile-3.png"]', '/images/porchlight-mile-1.png', 'RSD-49008-1', 1996, 1),
  (10, 'dial-up-heartbreak', 'Dial-Up Heartbreak', 'The Modem Tones', 'Dream-pop guitars and a drum machine drift through songs about busy signals, long-distance calls, and the last hour before dawn. Originally recorded to four-track in 1996.', 15.99, 'rock', '["/images/dial-up-heartbreak-1.png","/images/dial-up-heartbreak-2.png","/images/dial-up-heartbreak-3.png"]', '/images/dial-up-heartbreak-1.png', 'RSD-49009-1', 1996, 1);

-- Add the expanded catalog by slug so local records can keep their assigned IDs.
with additions (slug, title, artist, description, price, genre, image_urls, cover_url, catalog_number, release_year, in_stock) as (
  values
    ('static-in-the-floorboards', 'Static in the Floorboards', 'Drain Channel', 'The walls rattle through these basement recordings. A little tape hiss softens the scratchy guitars and a drummer who keeps pushing the tempo.', 14.99, 'grunge', '["/images/static-in-the-floorboards-1.png","/images/static-in-the-floorboards-2.png","/images/static-in-the-floorboards-3.png"]', '/images/static-in-the-floorboards-1.png', 'RSD-49011-1', 1992, 1),
    ('half-a-basement', 'Half a Basement', 'The Damp Hours', 'Slow, heavy chords give way to unexpectedly bright choruses on this six-song debut. The faint hum between tracks survived the trip from tape to vinyl.', 15.99, 'grunge', '["/images/half-a-basement-1.png","/images/half-a-basement-2.png","/images/half-a-basement-3.png"]', '/images/half-a-basement-1.png', 'RSD-49012-1', 1991, 1),
    ('borrowed-feedback', 'Borrowed Feedback', 'Unpaid Practice', 'A cheap practice amp and two guitars that refuse to stay in tune. Fast, scrappy songs with little pauses where you can hear the band laughing.', 13.99, 'grunge', '["/images/borrowed-feedback-1.png","/images/borrowed-feedback-2.png","/images/borrowed-feedback-3.png"]', '/images/borrowed-feedback-1.png', 'RSD-49013-1', 1994, 1),
    ('floodlight-weather', 'Floodlight Weather', 'Gutter Dial', 'A tighter second record from Gutter Dial. The quiet guitar lines stick around long enough that the distorted parts feel twice as loud when they arrive.', 17.99, 'grunge', '["/images/floodlight-weather-1.png","/images/floodlight-weather-2.png","/images/floodlight-weather-3.png"]', '/images/floodlight-weather-1.png', 'RSD-49014-1', 1996, 1),
    ('a-chair-in-the-hall', 'A Chair in the Hall', 'Wallpaper Teeth', 'Stripped-down, late-decade grunge with close vocals and a guitar that sounds half a room away. The last song was recorded with the hallway door open.', 16.99, 'grunge', '["/images/a-chair-in-the-hall-1.png","/images/a-chair-in-the-hall-2.png","/images/a-chair-in-the-hall-3.png"]', '/images/a-chair-in-the-hall-1.png', 'RSD-49015-1', 1998, 0),
    ('last-bus-skank', 'Last Bus Skank', 'The Farebox Five', 'Bright brass and quick offbeat guitar for the long ride home. A short 1994 set with a live sound and a few shouted answers from the horns.', 14.99, 'ska', '["/images/last-bus-skank-1.png","/images/last-bus-skank-2.png","/images/last-bus-skank-3.png"]', '/images/last-bus-skank-1.png', 'RSD-49016-1', 1994, 1),
    ('brass-at-the-laundromat', 'Brass at the Laundromat', 'Spin Cycle Horns', 'Two saxophones, a trombone and a brisk rhythm section work up a sweat in six songs about quarters, stalled dryers and running out of clean shirts.', 15.99, 'ska', '["/images/brass-at-the-laundromat-1.png","/images/brass-at-the-laundromat-2.png","/images/brass-at-the-laundromat-3.png"]', '/images/brass-at-the-laundromat-1.png', 'RSD-49017-1', 1996, 1),
    ('orange-peel-parade', 'Orange Peel Parade', 'The Sidewalk Pep Band', 'Loose brass harmonies and a skipping bass line, like a street show that ran into the next block. One bright instrumental closes each side.', 16.99, 'ska', '["/images/orange-peel-parade-1.png","/images/orange-peel-parade-2.png","/images/orange-peel-parade-3.png"]', '/images/orange-peel-parade-1.png', 'RSD-49018-1', 1997, 1),
    ('all-the-lights-turn-green', 'All the Lights Turn Green', 'Meter Skippers', 'A quick third-wave ska record for a ride across town. The trombone gets most of the lead lines, especially on the opener and the last song.', 15.49, 'ska', '["/images/all-the-lights-turn-green-1.png","/images/all-the-lights-turn-green-2.png","/images/all-the-lights-turn-green-3.png"]', '/images/all-the-lights-turn-green-1.png', 'RSD-49019-1', 1998, 1),
    ('neighbors-at-noon', 'Neighbors at Noon', 'The Window Rattlers', 'Offbeat guitar, baritone sax and cheerful three-part vocals. The band leaves in a little chatter from the apartment windows between takes.', 17.49, 'ska', '["/images/neighbors-at-noon-1.png","/images/neighbors-at-noon-2.png","/images/neighbors-at-noon-3.png"]', '/images/neighbors-at-noon-1.png', 'RSD-49020-1', 1999, 1),
    ('quarter-inch-static', 'Quarter Inch Static', 'Docket & Relay', 'A 1991 tape-traded debut built from button clicks, low bass, and drums bounced down until the edges blur. The two MCs keep the verses spare and give the breaks room to breathe.', 18.99, 'hip-hop', '["/images/quarter-inch-static-1.png","/images/quarter-inch-static-2.png","/images/quarter-inch-static-3.png"]', '/images/quarter-inch-static-1.png', 'RSD-49021-1', 1991, 1),
    ('the-bodega-ledger', 'The Bodega Ledger', 'June Decimal', 'June Decimal turns the corner shop''s running tab into a cast of characters. Jazz guitar snippets and clipped snare rolls carry thirteen minutes of stories on each side of this 1993 LP.', 16.99, 'hip-hop', '["/images/the-bodega-ledger-1.png","/images/the-bodega-ledger-2.png","/images/the-bodega-ledger-3.png"]', '/images/the-bodega-ledger-1.png', 'RSD-49022-1', 1993, 1),
    ('rain-check-rhymes', 'Rain Check Rhymes', 'Cipher Orchard', 'Short, dry punch lines over a bass loop that sounds like it was recorded through a raincoat. The 1996 sessions keep the horns rough and let the handclaps land a little late.', 19.99, 'hip-hop', '["/images/rain-check-rhymes-1.png","/images/rain-check-rhymes-2.png","/images/rain-check-rhymes-3.png"]', '/images/rain-check-rhymes-1.png', 'RSD-49023-1', 1996, 1),
    ('eight-bars-before-dawn', 'Eight Bars Before Dawn', 'Tempo Locksmith', 'A 1990 record about getting off the night shift and finding an open mic before sunrise. Tempo Locksmith fits the whole story between hard snare hits and short piano figures.', 17.49, 'hip-hop', '["/images/eight-bars-before-dawn-1.png","/images/eight-bars-before-dawn-2.png","/images/eight-bars-before-dawn-3.png"]', '/images/eight-bars-before-dawn-1.png', 'RSD-49024-1', 1990, 1),
    ('chalk-line-cipher', 'Chalk Line Cipher', 'Yardline Scribes', 'Four voices from the same block take turns on a beat made from a gym-floor squeak and a hand-me-down drum machine. A 1994 cut with the loose timing of a lunchtime circle.', 15.99, 'hip-hop', '["/images/chalk-line-cipher-1.png","/images/chalk-line-cipher-2.png","/images/chalk-line-cipher-3.png"]', '/images/chalk-line-cipher-1.png', 'RSD-49025-1', 1994, 0),
    ('knock-twice-at-noon', 'Knock Twice at Noon', 'Brick Meter', 'Brick Meter goes for a brighter sound on this 1998 LP. There''s a nylon-string lick on every other track, and the punch lines sound like neighbors sending jokes down the hall.', 21.99, 'hip-hop', '["/images/knock-twice-at-noon-1.png","/images/knock-twice-at-noon-2.png","/images/knock-twice-at-noon-3.png"]', '/images/knock-twice-at-noon-1.png', 'RSD-49026-1', 1998, 1),
    ('borrowed-blue', 'Borrowed Blue', 'Nia Valeck', 'A spare 1992 record with rounded bass, brushes, and low vocal doubles. Valeck holds the last line of each chorus long enough for the electric piano to take over.', 19.49, 'r-and-b', '["/images/borrowed-blue-1.png","/images/borrowed-blue-2.png","/images/borrowed-blue-3.png"]', '/images/borrowed-blue-1.png', 'RSD-49027-1', 1992, 1),
    ('silk-on-the-stairs', 'Silk on the Stairs', 'Monroe & Dusk', 'Two leads trade unhurried verses over drum-machine rims and sleepy Hammond chords. The duets get closest on the last few songs, when the rhythm section drops to a bass note and a snap.', 22.99, 'r-and-b', '["/images/silk-on-the-stairs-1.png","/images/silk-on-the-stairs-2.png","/images/silk-on-the-stairs-3.png"]', '/images/silk-on-the-stairs-1.png', 'RSD-49028-1', 1995, 1),
    ('sunday-at-six', 'Sunday at Six', 'Vera Bellweather', 'Bellweather moves from dry acoustic guitar to gospel harmonies and brushed drums across this 1997 set. The songs are about small domestic things, like taking a plate next door or making tea when the kettle won''t whistle.', 18.49, 'r-and-b', '["/images/sunday-at-six-1.png","/images/sunday-at-six-2.png","/images/sunday-at-six-3.png"]', '/images/sunday-at-six-1.png', 'RSD-49029-1', 1997, 0),
    ('stay-until-the-chorus', 'Stay Until the Chorus', 'Carmine Hour', 'Carmine Hour''s 1999 harmony record leans on warm keyboards and a bass line that keeps moving after the chorus ends. The quietest track is a rehearsal take with all three singers a little off the mic.', 20.99, 'r-and-b', '["/images/stay-until-the-chorus-1.png","/images/stay-until-the-chorus-2.png","/images/stay-until-the-chorus-3.png"]', '/images/stay-until-the-chorus-1.png', 'RSD-49030-1', 1999, 1),
    ('county-line-receiver', 'County Line Receiver', 'Nell Rusk', 'Nell Rusk''s alto cuts through fiddle and pedal steel on songs about rural radio, the late shift, and the things a caller leaves unsaid.', 18.99, 'country', '["/images/county-line-receiver-1.png","/images/county-line-receiver-2.png","/images/county-line-receiver-3.png"]', '/images/county-line-receiver-1.png', 'RSD-49031-1', 1992, 1),
    ('orange-dust-on-the-dash', 'Orange Dust on the Dash', 'Veda Sorrell', 'Dry electric guitar, handclaps, and a little pedal steel follow Veda Sorrell through songs about Texas heat and the borrowed truck that carried her west.', 20.99, 'country', '["/images/orange-dust-on-the-dash-1.png","/images/orange-dust-on-the-dash-2.png","/images/orange-dust-on-the-dash-3.png"]', '/images/orange-dust-on-the-dash-1.png', 'RSD-49032-1', 1998, 1),
    ('mercy-at-the-feed-store', 'Mercy at the Feed Store', 'Conrad Bellweather', 'A warm baritone and a creaky dobro anchor this five-piece set about feed bills, Saturday coffee, and a pencil mark that makes everything square.', 16.99, 'country', '["/images/mercy-at-the-feed-store-1.png","/images/mercy-at-the-feed-store-2.png","/images/mercy-at-the-feed-store-3.png"]', '/images/mercy-at-the-feed-store-1.png', 'RSD-49033-1', 1995, 1),
    ('tin-roof-weather', 'Tin Roof Weather', 'The Juniper Draw', 'Two close harmony voices, upright bass, and hammered guitar track a storm from the first roof ping to the last drip after sunrise.', 18.49, 'country', '["/images/tin-roof-weather-1.png","/images/tin-roof-weather-2.png","/images/tin-roof-weather-3.png"]', '/images/tin-roof-weather-1.png', 'RSD-49034-1', 1991, 1),
    ('paper-map-hymns', 'Paper Map Hymns', 'Althea Grange', 'Althea Grange sings quietly over acoustic guitar, brushed snare, and a distant organ. The songs trace roads she drew by hand on the backs of church bulletins.', 17.49, 'country', '["/images/paper-map-hymns-1.png","/images/paper-map-hymns-2.png","/images/paper-map-hymns-3.png"]', '/images/paper-map-hymns-1.png', 'RSD-49035-1', 1999, 0),
    ('saturn-at-the-food-court', 'Saturn at the Food Court', 'Lyra Venn', 'Lyra Venn pairs bright synth hooks and rubbery bass with daydreams about a planetarium job and the mall after closing.', 19.99, 'pop', '["/images/saturn-at-the-food-court-1.png","/images/saturn-at-the-food-court-2.png","/images/saturn-at-the-food-court-3.png"]', '/images/saturn-at-the-food-court-1.png', 'RSD-49036-1', 1997, 1),
    ('bubblegum-blackout', 'Bubblegum Blackout', 'The Sugar Switch', 'Handclap beats, a stomping bassline, and three-part choruses turn a neighborhood blackout into a dance party under the emergency lights.', 17.99, 'pop', '["/images/bubblegum-blackout-1.png","/images/bubblegum-blackout-2.png","/images/bubblegum-blackout-3.png"]', '/images/bubblegum-blackout-1.png', 'RSD-49037-1', 1994, 1),
    ('blue-plastic-summer', 'Blue Plastic Summer', 'Velli Monroe', 'Velli Monroe sings about pool passes and arcade nights over jangly synths and the clipped snap of a drum machine.', 18.99, 'pop', '["/images/blue-plastic-summer-1.png","/images/blue-plastic-summer-2.png","/images/blue-plastic-summer-3.png"]', '/images/blue-plastic-summer-1.png', 'RSD-49038-1', 1992, 1),
    ('half-past-glitter', 'Half Past Glitter', 'Cleo Finch', 'Four-on-the-floor drums, talkbox harmonies, and a bright string hook follow Cleo Finch past midnight and into the first train home.', 21.49, 'pop', '["/images/half-past-glitter-1.png","/images/half-past-glitter-2.png","/images/half-past-glitter-3.png"]', '/images/half-past-glitter-1.png', 'RSD-49039-1', 1999, 1),
    ('cassette-confetti', 'Cassette Confetti', 'Nova Daydream', 'This home-studio pop record pairs fuzzy loops, hand percussion, and a tuned toy keyboard with melodies built for trading tapes with friends.', 16.49, 'pop', '["/images/cassette-confetti-1.png","/images/cassette-confetti-2.png","/images/cassette-confetti-3.png"]', '/images/cassette-confetti-1.png', 'RSD-49040-1', 1996, 0),
    ('magnetic-northline', 'Magnetic Northline', 'Hollow Transmission', 'A three-piece rock band follows wiry lead guitar and a muscular rhythm section through six songs about work, weather, and leaving town.', 17.99, 'rock', '["/images/magnetic-northline-1.png","/images/magnetic-northline-2.png","/images/magnetic-northline-3.png"]', '/images/magnetic-northline-1.png', 'RSD-49041-1', 1992, 1),
    ('no-sleep-at-channel-nine', 'No Sleep at Channel Nine', 'Static Orchard', 'Fuzz bass, clattering drums, and deadpan harmonies make a late-night television station sound like the loudest place in town.', 18.99, 'rock', '["/images/no-sleep-at-channel-nine-1.png","/images/no-sleep-at-channel-nine-2.png","/images/no-sleep-at-channel-nine-3.png"]', '/images/no-sleep-at-channel-nine-1.png', 'RSD-49042-1', 1997, 1),
    ('corrosion-bloom', 'Corrosion Bloom', 'Chrome Thistle', 'Heavy metal built from grinding twin-guitar riffs, rapid snare rolls, and a surprisingly melodic last track. Recorded live in one room.', 21.99, 'rock', '["/images/corrosion-bloom-1.png","/images/corrosion-bloom-2.png","/images/corrosion-bloom-3.png"]', '/images/corrosion-bloom-1.png', 'RSD-49043-1', 1993, 0),
    ('meet-me-after-nine', 'Meet Me After Nine', 'Southbound Fivefold', 'Five voices hand off the verses and come together over buoyant drums and acoustic guitar. The title track saves its best harmony for the final chorus.', 16.99, 'boy-band', '["/images/meet-me-after-nine-1.png","/images/meet-me-after-nine-2.png","/images/meet-me-after-nine-3.png"]', '/images/meet-me-after-nine-1.png', 'RSD-49044-1', 1998, 1),
    ('kiss-me-in-stereo', 'Kiss Me in Stereo', 'The Dialtones Four', 'Four polished vocal parts over rubbery bass, bright keyboard stabs, and a kick drum made for a roller rink. A ballad slows the second side down.', 18.99, 'boy-band', '["/images/kiss-me-in-stereo-1.png","/images/kiss-me-in-stereo-2.png","/images/kiss-me-in-stereo-3.png"]', '/images/kiss-me-in-stereo-1.png', 'RSD-49045-1', 1997, 1),
    ('pocketful-of-tomorrow', 'Pocketful of Tomorrow', 'Blue Hour Juniors', 'Up-tempo late-’90s pop with a bouncing acoustic riff, dense group harmonies, and a key change built for the last dance.', 19.99, 'boy-band', '["/images/pocketful-of-tomorrow-1.png","/images/pocketful-of-tomorrow-2.png","/images/pocketful-of-tomorrow-3.png"]', '/images/pocketful-of-tomorrow-1.png', 'RSD-49046-1', 1999, 1),
    ('every-answer-is-you', 'Every Answer Is You', 'Second Floor Four', 'Four close harmonies trade places over rim clicks, electric piano, and gentle drum programming. The quieter second side leaves the singers room to breathe.', 14.99, 'boy-band', '["/images/every-answer-is-you-1.png","/images/every-answer-is-you-2.png","/images/every-answer-is-you-3.png"]', '/images/every-answer-is-you-1.png', 'RSD-49047-1', 1996, 1),
    ('blue-ink-promises', 'Blue Ink Promises', 'Five Past Friday', 'Bright acoustic guitar and skittering drum-machine percussion frame five distinct voices. The slower songs are about letters written and never sent.', 17.99, 'boy-band', '["/images/blue-ink-promises-1.png","/images/blue-ink-promises-2.png","/images/blue-ink-promises-3.png"]', '/images/blue-ink-promises-1.png', 'RSD-49048-1', 1999, 1),
    ('soft-hours', 'Soft Hours', 'June Meridian', 'A quietly confident alto over warm electric piano, clipped drums, and sustained bass. The songs roll along at a pace that leaves room for every word.', 19.99, 'r-and-b', '["/images/soft-hours-1.png","/images/soft-hours-2.png","/images/soft-hours-3.png"]', '/images/soft-hours-1.png', 'RSD-49049-1', 1995, 1),
    ('room-for-the-rain', 'Room for the Rain', 'Jade Calloway', 'A slow, supple R&B set with brushed guitar, hand percussion, and a voice that layers its own harmonies. The last track leaves the rhythm section playing alone.', 18.99, 'r-and-b', '["/images/room-for-the-rain-1.png","/images/room-for-the-rain-2.png","/images/room-for-the-rain-3.png"]', '/images/room-for-the-rain-1.png', 'RSD-49050-1', 1998, 1)
)
insert into albums (slug, title, artist, description, price, genre, image_urls, cover_url, catalog_number, release_year, in_stock)
select slug, title, artist, description, price, genre, image_urls, cover_url, catalog_number, release_year, in_stock
from additions
where not exists (select 1 from albums where albums.slug = additions.slug)
order by additions.catalog_number;

-- Seed both sides from the sleeve titles, with additional tracks on longer sides.
with tracklists (slug, side, titles) as (
  values
    ('overpass-stereo', 'A', json_array('White Lines', 'Driveway Radio', 'Open Late')),
    ('overpass-stereo', 'B', json_array('First Light', 'County Signal', 'Coming Home')),
    ('shred-till-dawn', 'A', json_array('Blown Fuse', 'Redline', 'Voltage Drop')),
    ('shred-till-dawn', 'B', json_array('Glass Cabinet', 'Night Current', 'Last Encore')),
    ('last-bell-first-kiss', 'A', json_array('Call Me Again', 'Blue Windbreaker', 'One More Quarter')),
    ('last-bell-first-kiss', 'B', json_array('Across the Gym', 'Stay for the Song', 'Last Slow Dance')),
    ('flannel-overdrive', 'A', json_array('Wet Wires', 'Porch Light', 'Mildew Season', 'Stairwell Echo', 'Cuff Stain', 'Split Seam')),
    ('flannel-overdrive', 'B', json_array('Cheap Feedback', 'Low Ceiling', 'Water Damage', 'Pavement Radio')),
    ('boom-bap-boulevard', 'A', json_array('Last Train In', 'Corner Signal', 'Deli Graffiti', 'Milk Crate Break', 'Loose Change')),
    ('boom-bap-boulevard', 'B', json_array('Pager Tone', 'Platform Dust', 'First Light')),
    ('mall-hair-forever', 'A', json_array('Food Court Crush', 'Last Token', 'Escalator Eyes', 'Photo Booth Promise', 'Big Hair Saturday')),
    ('mall-hair-forever', 'B', json_array('Mirror Light', 'Closing Time', 'Lip Gloss on the Payphone', 'Pretzel Salt', 'Fountain Wishes', 'Five O’Clock Bus')),
    ('midnight-fax', 'A', json_array('After Hours', 'Second Ring', 'Hold the Line')),
    ('midnight-fax', 'B', json_array('Quiet Reply', 'Soft Signal', 'In Your Handwriting', 'Give Me the Quiet', 'Stay Past the Tone', 'Until Morning')),
    ('pick-it-up-again', 'A', json_array('Last Bus', 'Spare Change', 'Curb Check')),
    ('pick-it-up-again', 'B', json_array('Dance Anyway', 'Tin Horn Relay', 'Gimme That Transfer', 'Bumper to Bumper Brass', 'Cuffs in the Puddle', 'Pick It Up (Again)')),
    ('porchlight-mile', 'A', json_array('The Laundry Line', 'County Road Nine', 'Two Dollars of Regular', 'A Quilt for the Backseat', 'Vacancy Light')),
    ('porchlight-mile', 'B', json_array('Gravel Under Glass', 'A Light for Me', 'Your Coat in the Truck', 'The Way Home in Winter', 'Porchlight Mile')),
    ('dial-up-heartbreak', 'A', json_array('Busy Signal', 'Glass Heart', 'Off The Hook')),
    ('dial-up-heartbreak', 'B', json_array('Night Rate', 'Static Apartment', 'Seven Digits of You', 'Your Name on the Four-Track', 'Screen Goes Blue', 'Dial-Up Heartbreak')),
    ('static-in-the-floorboards', 'A', json_array('Loose Plug', 'Open Floor', 'Kick Drum Nails', 'Ground Hum', 'Thin Wall Rattle', 'Thumbtack')),
    ('static-in-the-floorboards', 'B', json_array('No Ceiling', 'Burnt Lead', 'Tape on the Speaker', 'Snare in the Next Room', 'Last Take')),
    ('half-a-basement', 'A', json_array('Overcast', 'Downstairs', 'Outlet')),
    ('half-a-basement', 'B', json_array('Damp Match', 'Nobody Home', 'Floor Lamp')),
    ('borrowed-feedback', 'A', json_array('Plug It In', 'Borrowed Wire', 'Half Stack')),
    ('borrowed-feedback', 'B', json_array('Practice Room', 'Turn It Down', 'Dead Channel')),
    ('floodlight-weather', 'A', json_array('Time Clock', 'Dock Light', 'Pull the Shutter', 'No Deliveries')),
    ('floodlight-weather', 'B', json_array('Rain Delay', 'Yellow Halo', 'No Coat at Closing', 'Sodium Ghost', 'Gravel in the Drain', 'Wet Concrete')),
    ('a-chair-in-the-hall', 'A', json_array('Second Landing', 'Coat Hook', 'Keys on the Ledge', 'Half Open')),
    ('a-chair-in-the-hall', 'B', json_array('Empty Seat', 'Up the Stairs', 'Door Ajar')),
    ('last-bus-skank', 'A', json_array('Exact Fare', 'Back Door', 'Night Ticket')),
    ('last-bus-skank', 'B', json_array('Bench Seat', 'One More Stop', 'Bell for the Driver', 'Depot Horns')),
    ('brass-at-the-laundromat', 'A', json_array('Quarters Only', 'Rinse Cycle', 'Last Dryer')),
    ('brass-at-the-laundromat', 'B', json_array('Sock Swap', 'Wash Day', 'Clean Shirt')),
    ('orange-peel-parade', 'A', json_array('March Start', 'Citrus Stand', 'Tangerine Trombone', 'A Slice for the Drummer', 'Corner Band')),
    ('orange-peel-parade', 'B', json_array('Crosswalk Swing', 'Parade Route', 'Rest Stop')),
    ('all-the-lights-turn-green', 'A', json_array('Go Go Go', 'Parking Meter', 'Double Parked', 'Wrong Way Round', 'Hold That Door', 'Rush Hour')),
    ('all-the-lights-turn-green', 'B', json_array('Green Arrow', 'Bike Lane', 'Cut Across')),
    ('neighbors-at-noon', 'A', json_array('Top Floor', 'Open Window', 'Broomstick Beat', 'Rent Day Horns', 'Lunch Break')),
    ('neighbors-at-noon', 'B', json_array('Porch Talk', 'Street Echo', 'Through the Vent', 'Borrow Your Sugar', 'Three Flights Up', 'Buzzer')),
    ('quarter-inch-static', 'A', json_array('Tape Dust', 'Loose Reel', 'Thumb on Pause', 'Lend Me That Break', 'Grease Pencil Mark', 'Press Play')),
    ('quarter-inch-static', 'B', json_array('Night Bounce', 'No Splice', 'Fade Out')),
    ('the-bodega-ledger', 'A', json_array('Running Tab', 'Corner Count', 'Short Change')),
    ('the-bodega-ledger', 'B', json_array('Paper Totals', 'House Credit', 'Put It on My Name', 'A Dollar in Pennies', 'Close the Book')),
    ('rain-check-rhymes', 'A', json_array('Under Canvas', 'Puddle Step', 'Curbside Forecast', 'Umbrella Tax', 'Catch a Drop')),
    ('rain-check-rhymes', 'B', json_array('Storm Drain', 'Late Bus', 'Wet Socks, Dry Delivery', 'Don''t Blame the Weatherman', 'A Snare Under Water', 'Cloudbreak')),
    ('eight-bars-before-dawn', 'A', json_array('Night Shift', 'Blank Keys', 'Punch Card Blues', 'Lock Turn')),
    ('eight-bars-before-dawn', 'B', json_array('Door Clock', 'Dawn Steps', 'Coffee Before Sunrise', 'Last Call for the Mic', 'Home Again')),
    ('chalk-line-cipher', 'A', json_array('Court Side', 'Full Circle', 'Squeak Sample', 'No Look Pass', 'Lunch Money Beat', 'Bench Talk')),
    ('chalk-line-cipher', 'B', json_array('Chalk Step', 'One Bounce', 'Nobody Calls Glass', 'Chain Net Rattle', 'Last Basket')),
    ('knock-twice-at-noon', 'A', json_array('Second Floor', 'Noon Bell', 'Long Hall')),
    ('knock-twice-at-noon', 'B', json_array('Door Chain', 'Soft Knock', 'Sun Strip')),
    ('borrowed-blue', 'A', json_array('Blue Reprise', 'Wait a Minute', 'A Note Beneath the Door', 'Closer Than a Whisper', 'Leave Your Coat', 'Low Water')),
    ('borrowed-blue', 'B', json_array('Slow Answer', 'Room Tone', 'Only the Bass Knows', 'Off to One Side', 'Your Hand in the Dark', 'Surface Light')),
    ('silk-on-the-stairs', 'A', json_array('First Landing', 'Half a Step', 'Cufflinks on the Dresser', 'The Quiet Part', 'Silk Thread')),
    ('silk-on-the-stairs', 'B', json_array('Soft Echo', 'The Rail', 'Under Your Breath', 'One Snap Between Us', 'Down to Two')),
    ('sunday-at-six', 'A', json_array('Set a Place', 'Kettle Song', 'The Good China', 'Honey in the Saucer', 'Say Grace Softly', 'Looking In')),
    ('sunday-at-six', 'B', json_array('Next Door', 'Open Window', 'The Last Cup')),
    ('stay-until-the-chorus', 'A', json_array('Take One', 'Sound Check', 'Leave the Piano On', 'Three Deep Breaths', 'Warm Room')),
    ('stay-until-the-chorus', 'B', json_array('Stay Close', 'Harmony Line', 'The Chorus')),
    ('county-line-receiver', 'A', json_array('Third Shift Request', 'Fencepost Signal', 'Eighty Acres')),
    ('county-line-receiver', 'B', json_array('Call Me Thursday', 'Little AM', 'The Request I Couldn''t Make', 'Count The Towers')),
    ('orange-dust-on-the-dash', 'A', json_array('Southbound Heat', 'Broken Odometer', 'The Gauge Says Empty', 'Drawbridge Cafe')),
    ('orange-dust-on-the-dash', 'B', json_array('Hand Me The Keys', 'Sand In The Vents', 'Half a Tank to El Paso', 'The Passenger Door Sticks', 'County Road Sun')),
    ('mercy-at-the-feed-store', 'A', json_array('Early Delivery', 'Three Bushels', 'On The Ledger')),
    ('mercy-at-the-feed-store', 'B', json_array('Lid Of The Tin', 'Twine And String', 'Coffee for the Driver', 'Square by Saturday', 'Closes At Five')),
    ('tin-roof-weather', 'A', json_array('Drip By Drip', 'Wooden Bucket', 'Under The Eaves')),
    ('tin-roof-weather', 'B', json_array('Storm Lantern', 'Rust On Steel', 'Sun in the Washpan', 'Weather Report')),
    ('paper-map-hymns', 'A', json_array('After The Benediction', 'Around The Hill', 'County Line Blessing', 'Pear Tree Mile', 'The Unmarked Lane', 'Left At The Pine')),
    ('paper-map-hymns', 'B', json_array('The Last Fold', 'Kitchen Organ', 'Pencil on the Dash', 'Coffee in the Vestry', 'A Dot for Home', 'Road To Sunday')),
    ('saturn-at-the-food-court', 'A', json_array('Escalator To Orbit', 'Food Court Moon', 'Neon Name Tag', 'Kiss Me Past Closing', 'Quiet Hours')),
    ('saturn-at-the-food-court', 'B', json_array('Mint Planet', 'Next Constellation', 'Plastic Skylight', 'My Shift on Saturn', 'Meet Me At The Fountain')),
    ('bubblegum-blackout', 'A', json_array('Street Lights Out', 'One Floor Down', 'Flashlight Chorus', 'Sneakers on the Stairs', 'Pop The Fuse')),
    ('bubblegum-blackout', 'B', json_array('Pink In The Dark', 'Battery Boombox', 'Back When It Clicked')),
    ('blue-plastic-summer', 'A', json_array('Rec Center Pass', 'Pool Tile', 'Hit Rewind')),
    ('blue-plastic-summer', 'B', json_array('Open Swim', 'Arcade Moon', 'After the High Score', 'Wet Hair, Dry Towel', 'Locker Key on a String', 'One More Lap')),
    ('half-past-glitter', 'A', json_array('Pass The Mirror', 'Midnight Checkout', 'Coatroom Glitter', 'Dance In Place')),
    ('half-past-glitter', 'B', json_array('First Train Home', 'Silver Curtain', 'Club Stamp', 'Lipstick on the Farecard', 'Five Minutes Later')),
    ('cassette-confetti', 'A', json_array('Hits We Made', 'Splice Party', 'Kitchen-Table Sampler', 'The Part We Looped', 'Second Copy')),
    ('cassette-confetti', 'B', json_array('One Side Blank', 'Tape In The Sun', 'Your Name in Ballpoint', 'Overflow Bin')),
    ('magnetic-northline', 'A', json_array('Midshift', 'Iron Cold', 'Cable Fire')),
    ('magnetic-northline', 'B', json_array('Switchman', 'River Black', 'Northline')),
    ('no-sleep-at-channel-nine', 'A', json_array('Color Bars', 'Studio C', 'Ghost Host')),
    ('no-sleep-at-channel-nine', 'B', json_array('Lapel Mic', 'Please Stand', 'Good Night')),
    ('corrosion-bloom', 'A', json_array('Bitter Stem', 'Fuse Box', 'Torsion Vein', 'Kiln of Nails', 'Teeth in the Gearbox', 'Rivet Storm')),
    ('corrosion-bloom', 'B', json_array('Cold Chrome', 'Ash Leaves', 'Acid Root', 'Quench the Coil', 'Last Spark')),
    ('meet-me-after-nine', 'A', json_array('Coat Check', 'After Nine', 'I Can Wait Until Ten', 'The Backseat Harmony', 'Two Stops')),
    ('meet-me-after-nine', 'B', json_array('Take My Time', 'Say So', 'Your Corner of the Night', 'Save Me a Slow One', 'Walk You Home')),
    ('kiss-me-in-stereo', 'A', json_array('Sidewalk Beat', 'Stereo Kiss', 'All Four')),
    ('kiss-me-in-stereo', 'B', json_array('Spin Again', 'Slow Lane', 'Last Song')),
    ('pocketful-of-tomorrow', 'A', json_array('New Shoes', 'Curb Cut', 'Race You to the Bus', 'Maybe by Saturday', 'Off the Dashboard', 'Tomorrow')),
    ('pocketful-of-tomorrow', 'B', json_array('Drive By', 'Hold On', 'A Hand Through the Sunroof', 'Two Seats by the Window', 'Before the Streetlights', 'End Credits')),
    ('every-answer-is-you', 'A', json_array('Upstairs', 'All in Time', 'You Said It Softly', 'The Answer')),
    ('every-answer-is-you', 'B', json_array('Might Be', 'Same Page', 'Good Enough')),
    ('blue-ink-promises', 'A', json_array('Blue Ink', 'Fold Twice', 'Draft One')),
    ('blue-ink-promises', 'B', json_array('Five Past', 'Any Word', 'The Envelope Never Closed', 'Send It')),
    ('soft-hours', 'A', json_array('Soft Hours', 'Easy Street', 'Moon Lamp')),
    ('soft-hours', 'B', json_array('Two Spoons', 'Less Talk', 'Slow Melt', 'A Seat Beside You', 'Low Blue Radio', 'The Long Way')),
    ('room-for-the-rain', 'A', json_array('First Drops', 'A Little Space', 'Window Latch', 'A Dry Place for Your Shoes', 'Still Water')),
    ('room-for-the-rain', 'B', json_array('Room for Two', 'See It Through', 'Eavesdrop on the Weather', 'When It Clears'))
)
insert or ignore into album_tracks (album_id, side, position, title)
select albums.id, tracklists.side, track.key + 1, track.value
from tracklists
join albums on albums.slug = tracklists.slug
cross join json_each(tracklists.titles) as track;

-- Normalize the opening filename in existing seeded galleries after moving the scene photos.
update albums
set image_urls = json_set(
  image_urls,
  '$[0]',
  replace(json_extract(image_urls, '$[0]'), '-faceout.png', '-1.png')
)
where json_valid(image_urls)
  and json_extract(image_urls, '$[0]') glob '/images/*-faceout.png';

insert or ignore into users (id, email, password_hash, name, role, created_at) values
  (1, 'admin@recordstore.com', 'pbkdf2_sha256$100000$Fyiej9zGB7-ZynH8DRWUJQ$AMSk4t8p8Jw9DVw8EdHOcq_g8SUtzTbh0agA9g0Q0qY', 'Admin User', 'admin', 1705276800000),
  (2, 'customer@example.com', 'pbkdf2_sha256$100000$R-GBp6yHQBgiqGkXZm70IQ$PmYoRXgmMoFYh2ONKFQ-KDg-QvfPAfBduyMlsX7tveA', 'John Doe', 'customer', 1709251200000);

insert or ignore into orders (id, user_id, total, status, shipping_address_json, created_at) values
  (1001, 2, 32.98, 'delivered', '{"street":"123 Main St","city":"Boston","state":"MA","zip":"02101"}', 1726358400000),
  (1002, 2, 29.98, 'shipped', '{"street":"123 Main St","city":"Boston","state":"MA","zip":"02101"}', 1727740800000);

insert or ignore into order_items (order_id, album_id, title, unit_price, quantity) values
  (1001, 1, 'Overpass Stereo', 15.99, 1),
  (1001, 3, 'Last Bell, First Kiss', 16.99, 1),
  (1002, 2, 'Shred Till Dawn', 14.99, 2);
