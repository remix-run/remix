create table books (
  id integer primary key autoincrement,
  slug text not null unique,
  title text not null,
  author text not null,
  description text not null,
  price numeric not null,
  genre text not null,
  image_urls text not null,
  cover_url text not null,
  isbn text not null,
  published_year integer not null,
  in_stock integer not null
);

create table users (
  id integer primary key autoincrement,
  email text not null unique,
  password_hash text not null,
  name text not null,
  role text not null,
  created_at integer not null
);

create table orders (
  id integer primary key autoincrement,
  user_id integer not null,
  total numeric not null,
  status text not null,
  shipping_address_json text not null,
  created_at integer not null,
  constraint orders_user_id_fk foreign key (user_id) references users (id) on delete restrict
);

create index orders_user_id_idx on orders (user_id);

create table order_items (
  order_id integer not null,
  book_id integer not null,
  title text not null,
  unit_price numeric not null,
  quantity integer not null,
  constraint order_items_pk primary key (order_id, book_id),
  constraint order_items_order_id_fk foreign key (order_id) references orders (id) on delete cascade,
  constraint order_items_book_id_fk foreign key (book_id) references books (id) on delete restrict
);

create index order_items_order_id_idx on order_items (order_id);
create index order_items_book_id_idx on order_items (book_id);

create table password_reset_tokens (
  token text primary key,
  user_id integer not null,
  expires_at integer not null,
  constraint password_reset_tokens_user_id_fk foreign key (user_id) references users (id) on delete cascade
);

create index password_reset_tokens_user_id_idx on password_reset_tokens (user_id);
