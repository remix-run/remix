create table album_tracks (
  album_id integer not null,
  side text not null check (side glob '[A-Z]'),
  position integer not null check (typeof(position) = 'integer' and position > 0),
  title text not null check (length(trim(title)) > 0),
  constraint album_tracks_pk primary key (album_id, side, position),
  constraint album_tracks_album_id_fk foreign key (album_id) references albums (id) on delete cascade
);
