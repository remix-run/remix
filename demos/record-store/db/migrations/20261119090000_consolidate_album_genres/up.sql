-- Keep original values so rollback can restore genres for existing albums.
create table album_genres_before_consolidation (
  album_id integer primary key references albums (id) on delete cascade,
  genre text not null
);

insert into album_genres_before_consolidation (album_id, genre)
select id, genre from albums
where genre in (
  'adventure', 'romance', 'historical-fiction', 'poetry',
  'thriller', 'horror', 'science-fiction', 'nature', 'sports',
  'music', 'crafts', 'photography', 'science', 'technology',
  'history', 'biography', 'philosophy'
);

update albums set genre = case
  when genre in ('adventure', 'romance', 'historical-fiction', 'poetry') then 'fiction'
  when genre in ('thriller', 'horror') then 'mystery'
  when genre = 'science-fiction' then 'fantasy'
  when genre = 'nature' then 'gardening'
  when genre = 'sports' then 'travel'
  when genre in ('music', 'crafts', 'photography') then 'art'
  when genre in ('science', 'technology', 'history', 'biography') then 'nonfiction'
  when genre = 'philosophy' then 'self-help'
  else genre
end;
