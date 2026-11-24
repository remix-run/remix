-- Keep original values so rollback can restore genres for existing books.
create table book_genres_before_consolidation (
  book_id integer primary key references books (id) on delete cascade,
  genre text not null
);

insert into book_genres_before_consolidation (book_id, genre)
select id, genre from books
where genre in (
  'adventure', 'romance', 'historical-fiction', 'poetry',
  'thriller', 'horror', 'science-fiction', 'nature', 'sports',
  'music', 'crafts', 'photography', 'science', 'technology',
  'history', 'biography', 'philosophy'
);

update books set genre = case
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
