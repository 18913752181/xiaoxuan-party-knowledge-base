create table if not exists public.education_bases (
  id bigint primary key,
  name text not null,
  type text not null,
  city text not null,
  district text not null,
  intro text not null default '',
  status text not null default '可联系',
  icon text not null default '⌖',
  contact text not null default '联系信息待核实',
  source_url text,
  address text,
  latitude double precision,
  longitude double precision,
  coordinate_type text check (coordinate_type is null or coordinate_type in ('gcj02', 'wgs84')),
  location_source_name text,
  location_source_url text,
  location_confidence text not null default 'pending' check (location_confidence in ('verified', 'probable', 'pending')),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);

create index if not exists education_bases_published_order_idx
  on public.education_bases (is_published, sort_order, id);
create index if not exists education_bases_region_idx
  on public.education_bases (city, district);

alter table public.education_bases enable row level security;

create or replace function public.touch_education_bases_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists education_bases_touch_updated_at on public.education_bases;
create trigger education_bases_touch_updated_at
before update on public.education_bases
for each row execute function public.touch_education_bases_updated_at();

comment on table public.education_bases is '喵喵工具箱红色教育基地，由网站管理员维护，小程序通过服务端接口只读访问';
