-- FameRank initial schema
-- Tables: categories, creators, rankings, votes

create extension if not exists "uuid-ossp";

-- ─── categories ──────────────────────────────────────────────────────────────
-- Hierarchical taxonomy (parent_id → self-reference for sub-categories)
create table categories (
  id            uuid        primary key default uuid_generate_v4(),
  name          text        not null,
  slug          text        not null unique,
  parent_id     uuid        references categories(id) on delete set null,
  icon          text,
  description   text,
  creator_count integer     not null default 0,
  created_at    timestamptz not null default now()
);

create index on categories(parent_id);
create index on categories(slug);

-- ─── creators ────────────────────────────────────────────────────────────────
create table creators (
  id                  uuid        primary key default uuid_generate_v4(),
  youtube_channel_id  text        not null unique,
  channel_name        text        not null,
  description         text,
  profile_image_url   text,
  subscriber_count    bigint,
  view_count          bigint,
  video_count         integer,
  country_code        char(2),                          -- ISO 3166-1 alpha-2
  city                text,
  gender              text        check (gender in ('male', 'female', 'unknown')),
  gender_confidence   numeric(4,3) check (gender_confidence between 0 and 1),
  primary_category    uuid        references categories(id) on delete set null,
  secondary_category  uuid        references categories(id) on delete set null,
  language            text,                             -- BCP-47 tag e.g. 'en', 'es'
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index on creators(primary_category);
create index on creators(secondary_category);
create index on creators(country_code);
create index on creators(subscriber_count desc);

-- Keep updated_at current automatically
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger creators_set_updated_at
  before update on creators
  for each row execute procedure set_updated_at();

-- ─── rankings ────────────────────────────────────────────────────────────────
create table rankings (
  id                    uuid        primary key default uuid_generate_v4(),
  creator_id            uuid        not null references creators(id) on delete cascade,
  category              text,
  subcategory           text,
  country_code          char(2),
  city                  text,
  gender                text        check (gender in ('male', 'female', 'unknown', null)),
  rank_position         integer     not null,
  previous_rank_position integer,
  rank_score            numeric(12,4) not null,
  period                text        not null check (period in ('weekly', 'monthly', 'alltime')),
  created_at            timestamptz not null default now()
);

-- Enforce one ranking row per creator / scope / period combination
create unique index rankings_unique_scope
  on rankings(creator_id, period, coalesce(category,''), coalesce(country_code,''), coalesce(city,''), coalesce(gender,''));

create index on rankings(period, rank_position);
create index on rankings(creator_id);
create index on rankings(category, period, rank_position);
create index on rankings(country_code, period, rank_position);

-- ─── votes ───────────────────────────────────────────────────────────────────
-- voter_ip should be stored as a SHA-256 hash of the raw IP (never store plaintext)
create table votes (
  id          uuid        primary key default uuid_generate_v4(),
  creator_id  uuid        not null references creators(id) on delete cascade,
  voter_ip    text        not null,   -- store hashed IP only, not plaintext
  vote_type   text        not null check (vote_type in ('up', 'down')),
  category    text,
  created_at  timestamptz not null default now()
);

create index on votes(creator_id);
create index on votes(voter_ip);
-- Prevent the same IP voting twice on the same creator in the same category
create unique index votes_one_per_ip
  on votes(creator_id, voter_ip, coalesce(category, ''));
