-- Jalankan sekali di Supabase SQL Editor untuk menyiapkan katalog multi-produk.
-- Aman dijalankan ulang karena memakai ON CONFLICT.

insert into public.categories (name, slug, description)
values
  ('Lapis Legit', 'lapis-legit', 'Signature lapis legit premium Sharenpan.'),
  ('Cake', 'cake', 'Koleksi cake homemade untuk ulang tahun dan perayaan.'),
  ('Cookies', 'cookies', 'Cookies butter untuk teman minum teh dan kopi.'),
  ('Brownies', 'brownies', 'Brownies fudgy untuk hadiah dan self-reward.'),
  ('Hampers', 'hampers', 'Paket hadiah untuk keluarga, teman, dan rekan kerja.')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description;

-- Hubungkan tiga produk awal ke kategori Lapis Legit.
update public.products p
set category_id = c.id,
    updated_at = now()
from public.categories c
where c.slug = 'lapis-legit'
  and p.slug in ('lapis-legit-original', 'lapis-legit-prune', 'lapis-legit-cheese');
