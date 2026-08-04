-- Jalankan di Supabase SQL Editor agar harga produk live ikut berubah.

update public.products
set price = 300000, updated_at = now()
where slug = 'lapis-legit-original';

update public.products
set price = 400000, updated_at = now()
where slug in ('lapis-legit-prune', 'lapis-legit-plum');
