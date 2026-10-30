create table entries (
  id integer primary key autoincrement,
  name text not null,
  message text not null,
  signed_at integer not null
);

create index entries_signed_at_idx on entries (signed_at);
