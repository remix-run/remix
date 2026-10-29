create table sections (
  id integer primary key,
  slug text not null unique,
  name text not null,
  position integer not null
);

create table categories (
  id integer primary key,
  section_id integer not null references sections(id),
  slug text not null unique,
  name text not null,
  position integer not null
);

create index categories_section_id_idx on categories (section_id);

create table families (
  id integer primary key,
  category_id integer not null references categories(id),
  slug text not null unique,
  name text not null,
  description text not null,
  presentation_label text not null,
  spec_names text not null,
  part_count integer not null,
  lowest_price decimal(10, 2) not null,
  position integer not null
);

create index families_category_id_idx on families (category_id);

create table presentations (
  id integer primary key,
  family_id integer not null references families(id),
  slug text not null,
  name text not null,
  description text not null,
  part_count integer not null,
  lowest_price decimal(10, 2) not null,
  position integer not null,
  unique (family_id, slug)
);

create table parts (
  id integer primary key,
  family_id integer not null references families(id),
  presentation_id integer not null references presentations(id),
  part_number text not null unique,
  spec_1 text,
  spec_2 text,
  spec_3 text,
  spec_4 text,
  pack_quantity integer not null,
  price decimal(10, 2) not null,
  position integer not null
);

create index parts_presentation_position_idx on parts (presentation_id, position);
-- Covers the grouped filter counts on family pages, so they never read the table itself.
create index parts_family_specs_idx on parts (family_id, presentation_id, spec_1, spec_2, spec_3, spec_4);
