-- Jalankan sekali di Supabase SQL Editor.
-- Tabel orders sudah memiliki payment_status dan payment_receipt_url,
-- sehingga tidak perlu membuat tabel pembayaran baru.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists "Customers upload payment receipts" on storage.objects;
create policy "Customers upload payment receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'payment-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Public can read payment receipts" on storage.objects;
create policy "Public can read payment receipts"
on storage.objects for select to public
using (bucket_id = 'payment-receipts');

drop policy if exists "Admins manage payment receipts" on storage.objects;
create policy "Admins manage payment receipts"
on storage.objects for delete to authenticated
using (bucket_id = 'payment-receipts' and public.is_admin());

create or replace function public.submit_payment_receipt(
  p_order_id uuid,
  p_receipt_url text,
  p_payment_reference text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  update public.orders
  set payment_status = 'pending_verification',
      payment_receipt_url = p_receipt_url,
      payment_reference = p_payment_reference,
      updated_at = now()
  where id = p_order_id
    and user_id = auth.uid()
    and status <> 'cancelled'
    and payment_status in ('unpaid', 'failed')
  returning id into updated_id;

  if updated_id is null then
    raise exception 'Order tidak ditemukan atau tidak dapat dibayar ulang';
  end if;
  return updated_id;
end;
$$;

revoke all on function public.submit_payment_receipt(uuid, text, text) from public;
grant execute on function public.submit_payment_receipt(uuid, text, text) to authenticated;
