create table users (
  id integer primary key autoincrement,
  email text unique,
  password_hash text,
  name text,
  avatar_url text,
  created_at integer not null,
  updated_at integer not null
);

create unique index users_email_idx on users (email);

create table auth_accounts (
  id integer primary key autoincrement,
  user_id integer not null,
  provider text not null,
  provider_account_id text not null,
  email text,
  username text,
  display_name text,
  avatar_url text,
  profile_json text not null,
  created_at integer not null,
  updated_at integer not null,
  constraint auth_accounts_user_id_fk foreign key (user_id) references users (id) on delete cascade
);

create index auth_accounts_user_id_idx on auth_accounts (user_id);
create unique index auth_accounts_provider_account_idx on auth_accounts (provider, provider_account_id);

create table password_reset_tokens (
  token text primary key,
  user_id integer not null,
  expires_at integer not null,
  constraint password_reset_tokens_user_id_fk foreign key (user_id) references users (id) on delete cascade
);

create index password_reset_tokens_user_id_idx on password_reset_tokens (user_id);
