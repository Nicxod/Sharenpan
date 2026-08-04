-- Jalankan sekali di Supabase SQL Editor.
-- Voucher ini dapat dibaca customer, tetapi hanya admin yang dapat mengubahnya.

insert into public.promo_codes (
  code,
  description,
  discount_type,
  discount_value,
  minimum_purchase,
  active
)
values (
  'WELCOME25K',
  'Potongan Rp25.000 untuk pelanggan baru Sharenpan',
  'fixed',
  25000,
  0,
  true
)
on conflict (code) do update set
  description = excluded.description,
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  minimum_purchase = excluded.minimum_purchase,
  active = true;
