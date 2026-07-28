import { createClient } from "@/lib/supabase/server";
import Storefront, {
  type StorefrontProduct,
  type StorefrontStatus,
} from "@/components/storefront";

export const dynamic = "force-dynamic";

const fallbackProducts: StorefrontProduct[] = [
  {
    id: "fallback-original",
    name: "Lapis Legit Original",
    description: "Lapis legit klasik dengan butter pilihan.",
    price: 285000,
    stock: 24,
    imageUrl: "/assets/lapis-legit.jpg",
    tag: "Terlaris",
    type: "classic",
    rating: "4.9",
    reviews: "248",
  },
  {
    id: "fallback-prune",
    name: "Lapis Legit Prune",
    description: "Manis prune dengan aroma rempah yang hangat.",
    price: 325000,
    stock: 12,
    imageUrl: "/assets/lapis-legit.jpg",
    tag: "Favorit",
    type: "premium",
    rating: "4.9",
    reviews: "126",
  },
  {
    id: "fallback-cheese",
    name: "Lapis Legit Cheese",
    description: "Perpaduan lapisan legit dan keju yang gurih.",
    price: 315000,
    stock: 10,
    imageUrl: "/assets/lapis-legit.jpg",
    tag: "Premium",
    type: "premium",
    rating: "4.8",
    reviews: "184",
  },
];

export default async function Home() {
  const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );

  let products = fallbackProducts;
  let databaseStatus: StorefrontStatus = {
    kind: "preview",
    label: "Mode preview",
    detail: "Produk contoh tampil sementara.",
  };

  if (hasSupabaseConfig) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, price, stock, image_url, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        products = data.map((product, index) => ({
          id: product.id,
          name: product.name,
          description: product.description ?? "Lapis legit premium Sharenpan.",
          price: product.price,
          stock: product.stock,
          imageUrl: product.image_url || "/assets/lapis-legit.jpg",
          tag: index === 0 ? "Terlaris" : index === 1 ? "Favorit" : "Premium",
          type: index === 0 ? "classic" : "premium",
          rating: index === 2 ? "4.8" : "4.9",
          reviews: index === 0 ? "248" : index === 1 ? "126" : "184",
        }));
        databaseStatus = {
          kind: "connected",
          label: "Terhubung ke Supabase",
          detail: `${products.length} produk aktif dari database.`,
        };
      } else if (error?.code === "PGRST205") {
        databaseStatus = {
          kind: "error",
          label: "Tabel products belum terbaca",
          detail: "Pastikan schema sudah dijalankan di SQL Editor.",
        };
      } else if (!error && data?.length === 0) {
        databaseStatus = {
          kind: "empty",
          label: "Database siap, produk masih kosong",
          detail: "Produk contoh ditampilkan untuk preview UI.",
        };
      } else if (error) {
        databaseStatus = {
          kind: "error",
          label: "Koneksi database bermasalah",
          detail: error.message,
        };
      }
    } catch {
      databaseStatus = {
        kind: "preview",
        label: "Mode preview",
        detail: "Isi key Supabase untuk mengaktifkan data live.",
      };
    }
  }

  return <Storefront products={products} databaseStatus={databaseStatus} />;
}
