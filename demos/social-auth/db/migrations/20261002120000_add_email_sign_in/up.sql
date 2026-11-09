alter table users add column email_verified_at integer;

create table email_auth_entries (
  key text primary key,
  value text not null,
  expires_at integer not null
);

create index email_auth_entries_expires_at_idx on email_auth_entries (expires_at);
