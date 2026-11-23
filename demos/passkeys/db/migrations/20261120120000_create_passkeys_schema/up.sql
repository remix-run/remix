create table users (
  id text primary key,
  username text not null,
  created_at integer not null
);

create unique index users_username_idx on users (username);

create table passkeys (
  id text primary key,
  user_id text not null,
  public_key text not null,
  algorithm integer not null,
  sign_count integer not null,
  transports text,
  backup_eligible integer not null,
  backed_up integer not null,
  aaguid text not null,
  created_at integer not null,
  last_used_at integer,
  constraint passkeys_user_id_fk foreign key (user_id) references users (id) on delete cascade
);

create index passkeys_user_id_idx on passkeys (user_id);
