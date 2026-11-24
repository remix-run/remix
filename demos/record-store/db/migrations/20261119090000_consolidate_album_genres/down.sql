update albums set genre = (
  select genre from album_genres_before_consolidation where album_id = albums.id
)
where id in (select album_id from album_genres_before_consolidation);

drop table album_genres_before_consolidation;
