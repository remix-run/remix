create table passkeys (
  id text primary key,
  user_id integer not null,
  name text not null,
  public_key text not null,
  counter integer not null,
  transports text not null,
  backup_eligible integer not null,
  backed_up integer not null,
  aaguid text,
  created_at integer not null,
  last_used_at integer,
  constraint passkeys_user_id_fk foreign key (user_id) references users (id) on delete cascade
);

create index passkeys_user_id_idx on passkeys (user_id);

create table passkey_challenges (
  challenge text primary key,
  expires_at integer not null
);

create index passkey_challenges_expires_at_idx on passkey_challenges (expires_at);
