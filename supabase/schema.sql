-- Sharenpan database schema
-- Jalankan seluruh file ini di Supabase Dashboard > SQL Editor.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  price integer not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  weight_gram integer check (weight_gram is null or weight_gram > 0),
  image_url text,
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Rumah',
  recipient_name text not null,
  phone text not null,
  address_line text not null,
  city text not null,
  province text not null,
  postal_code text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  session_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carts_owner_check check (user_id is not null or session_id is not null)
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('SHR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  shipping_address jsonb not null default '{}'::jsonb,
  notes text,
  subtotal integer not null default 0 check (subtotal >= 0),
  shipping_fee integer not null default 0 check (shipping_fee >= 0),
  discount integer not null default 0 check (discount >= 0),
  total integer not null default 0 check (total >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  subtotal integer not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  minimum_purchase integer not null default 0 check (minimum_purchase >= 0),
  max_uses integer,
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists categories_set_updated_at on public.categories;
drop trigger if exists products_set_updated_at on public.products;
drop trigger if exists profiles_set_updated_at on public.profiles;
drop trigger if exists addresses_set_updated_at on public.addresses;
drop trigger if exists carts_set_updated_at on public.carts;
drop trigger if exists cart_items_set_updated_at on public.cart_items;
drop trigger if exists orders_set_updated_at on public.orders;
drop trigger if exists site_settings_set_updated_at on public.site_settings;

create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger addresses_set_updated_at before update on public.addresses
for each row execute function public.set_updated_at();
create trigger carts_set_updated_at before update on public.carts
for each row execute function public.set_updated_at();
create trigger cart_items_set_updated_at before update on public.cart_items
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger site_settings_set_updated_at before update on public.site_settings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone);
  return new;
end;
$$;

create or replace function public.find_email_by_phone(phone_input text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g') = regexp_replace(phone_input, '[^0-9]', '', 'g')
  limit 1;
$$;

grant execute on function public.find_email_by_phone(text) to anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews enable row level security;
alter table public.promo_codes enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "Public can read categories" on public.categories;
create policy "Public can read categories" on public.categories
for select to anon, authenticated using (true);

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products
for select to anon, authenticated using (status = 'active' or public.is_admin());

drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
for update to authenticated using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "Users manage own addresses" on public.addresses;
create policy "Users manage own addresses" on public.addresses
for all to authenticated using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users manage own carts" on public.carts;
create policy "Users manage own carts" on public.carts
for all to authenticated using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users manage own cart items" on public.cart_items;
create policy "Users manage own cart items" on public.cart_items
for all to authenticated
using (exists (select 1 from public.carts c where c.id = cart_id and (c.user_id = auth.uid() or public.is_admin())))
with check (exists (select 1 from public.carts c where c.id = cart_id and (c.user_id = auth.uid() or public.is_admin())));

drop policy if exists "Customers read own orders" on public.orders;
create policy "Customers read own orders" on public.orders
for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Customers create orders" on public.orders;
create policy "Customers create orders" on public.orders
for insert to anon, authenticated
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Admins manage orders" on public.orders;
create policy "Admins manage orders" on public.orders
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Customers read own order items" on public.order_items;
create policy "Customers read own order items" on public.order_items
for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

drop policy if exists "Customers create order items" on public.order_items;
create policy "Customers create order items" on public.order_items
for insert to anon, authenticated
with check (exists (select 1 from public.orders o where o.id = order_id and (o.user_id is null or o.user_id = auth.uid())));

drop policy if exists "Public can read approved reviews" on public.reviews;
create policy "Public can read approved reviews" on public.reviews
for select to anon, authenticated using (approved = true or user_id = auth.uid() or public.is_admin());

drop policy if exists "Customers create own reviews" on public.reviews;
create policy "Customers create own reviews" on public.reviews
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Customers update own reviews" on public.reviews;
create policy "Customers update own reviews" on public.reviews
for update to authenticated using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Public can read active promo codes" on public.promo_codes;
create policy "Public can read active promo codes" on public.promo_codes
for select to anon, authenticated
using (active = true and starts_at <= now() and (expires_at is null or expires_at >= now()));

drop policy if exists "Admins manage promo codes" on public.promo_codes;
create policy "Admins manage promo codes" on public.promo_codes
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public can read store settings" on public.site_settings;
create policy "Public can read store settings" on public.site_settings
for select to anon, authenticated using (key in ('store_info', 'shipping_info', 'social_links'));

drop policy if exists "Admins manage store settings" on public.site_settings;
create policy "Admins manage store settings" on public.site_settings
for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.categories (name, slug, description)
values
  ('Lapis Legit', 'lapis-legit', 'Lapis legit premium dengan butter pilihan.'),
  ('Hampers', 'hampers', 'Paket hadiah untuk keluarga, teman, dan rekan kerja.')
on conflict (slug) do nothing;

insert into public.products (name, slug, description, price, stock, weight_gram, status)
values
  ('Lapis Legit Original', 'lapis-legit-original', 'Lapis legit klasik dengan butter pilihan.', 285000, 24, 500, 'active'),
  ('Lapis Legit Prune', 'lapis-legit-prune', 'Lapis legit dengan prune yang manis dan lembut.', 325000, 12, 500, 'active'),
  ('Lapis Legit Cheese', 'lapis-legit-cheese', 'Perpaduan lapisan legit dan keju yang gurih.', 315000, 10, 500, 'active')
on conflict (slug) do nothing;

create table if not exists public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade,
  customer_name text not null,
  customer_email text,
  rating_score integer check (rating_score between 1 and 5),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.customer_feedback enable row level security;

drop policy if exists "Customers create own feedback" on public.customer_feedback;
create policy "Customers create own feedback" on public.customer_feedback
for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());

drop policy if exists "Admins read all feedback" on public.customer_feedback;
create policy "Admins read all feedback" on public.customer_feedback
for select to authenticated using (public.is_admin() or user_id = auth.uid());

commit;

