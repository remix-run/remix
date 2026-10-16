drop table if exists email_auth_entries;
alter table users drop column email_verified_at;
