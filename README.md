# Sharenpan Next.js

Fondasi storefront Sharenpan menggunakan Next.js App Router, TypeScript,
Tailwind CSS, dan Supabase.

## Menyalakan project

```bash
npm install
copy .env.local.example .env.local
npm run dev
```

Buka `http://localhost:3000`.

## Menghubungkan Supabase

1. Buka file `.env.local`.
2. Isi `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dengan publishable key/anon key
   dari Supabase Dashboard → Project Settings → API.
3. Buka Supabase Dashboard → SQL Editor.
4. Jalankan seluruh isi `supabase/schema.sql`.
5. Refresh aplikasi. Produk seed akan tampil di halaman utama.

### Mengaktifkan foto produk

Kolom `products.image_url` sudah tersedia. Untuk upload foto dari dashboard admin,
jalankan seluruh isi `supabase/storage.sql` satu kali di Supabase SQL Editor.
File tersebut membuat bucket `product-images` (public read, admin upload/update/delete)
dengan batas 5 MB untuk PNG, JPG, dan WEBP.

## Login customer dan admin

- Customer wajib membuat akun atau login sebelum menambahkan produk ke keranjang.
- Checkout akan menyimpan data ke tabel `orders` dan `order_items`.
- Dashboard admin tersedia di `http://localhost:3000/admin`.
- Setelah membuat akun admin melalui Supabase Authentication, jadikan akun tersebut admin melalui SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'email-admin-kamu@example.com');
```

Jalankan tambahan policy produk berikut jika schema lama sudah pernah dijalankan:

```sql
drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products
for all to authenticated using (public.is_admin()) with check (public.is_admin());
```

Project URL sudah disiapkan:
`https://hyhmphdiisdgngwwkqfo.supabase.co`

Jangan memasukkan `service_role key` atau database password ke frontend,
chat, Git, atau file yang dibagikan.

## Perintah verifikasi

```bash
npm run lint
npm run build
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
