update books set genre = (
  select genre from book_genres_before_consolidation where book_id = books.id
)
where id in (select book_id from book_genres_before_consolidation);

drop table book_genres_before_consolidation;
