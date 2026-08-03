import { createClient } from "@/lib/supabase/server";
import Storefront, {
  type StorefrontProduct,
  type StorefrontStatus,
} from "@/components/storefront";

export const dynamic = "force-dynamic";

const fallbackProducts: StorefrontProduct[] = [
  // ── KATEGORI 1: LAPIS LEGIT ORIGINAL ──
  {
    id: "lapis-ori-block",
    name: "Lapis Legit Original Premium (Full Block)",
    description: "Lapis legit original resep warisan dipanggang selapis demi selapis dengan 100% butter Wijsman murni. Lembut, gurih, dan legit.",
    price: 285000,
    stock: 20,
    imageUrl: "/assets/products/lapis-ori-block.jpg",
    tag: "Terlaris",
    type: "classic",
    categorySlug: "lapis-original",
    categoryName: "Lapis Legit Original",
    rating: "4.9",
    reviews: "248",
  },
  {
    id: "lapis-ori-box-half",
    name: "Lapis Legit Original (Dus Reguler 1/2 Loyang)",
    description: "Kemasan dus kraft reguler setengah loyang (10×20 cm) dengan jendela transparan + gratis pisau kue. Pilihan praktis harian.",
    price: 150000,
    stock: 25,
    imageUrl: "/assets/products/lapis-ori-box-half.jpg",
    tag: "Favorit",
    type: "classic",
    categorySlug: "lapis-original",
    categoryName: "Lapis Legit Original",
    rating: "4.9",
    reviews: "194",
  },
  {
    id: "lapis-ori-box-cubes",
    name: "Lapis Legit Original (Box Cut Bites / Potong Rapi)",
    description: "Lapis legit original yang sudah dipotong-potong kecil rapi dalam box transparan. Siap disantap bersama keluarga tanpa repot.",
    price: 160000,
    stock: 30,
    imageUrl: "/assets/products/lapis-ori-box-cubes.jpg",
    tag: "Praktis",
    type: "classic",
    categorySlug: "lapis-original",
    categoryName: "Lapis Legit Original",
    rating: "4.9",
    reviews: "176",
  },
  {
    id: "lapis-ori-slice",
    name: "Lapis Legit Original (Slice Individual Pack)",
    description: "Potongan slice individual dikemas plastik stiker Sharenpan. Sangat praktis untuk camilan harian dan souvenir acara.",
    price: 35000,
    stock: 45,
    imageUrl: "/assets/products/lapis-slice-packs.jpg",
    tag: "Mini Pack",
    type: "classic",
    categorySlug: "lapis-original",
    categoryName: "Lapis Legit Original",
    rating: "4.8",
    reviews: "128",
  },

  // ── KATEGORI 2: LAPIS LEGIT VARIAN BUAH PLUM ──
  {
    id: "lapis-plum-full",
    name: "Lapis Legit Varian Buah Plum (1 Loyang Full)",
    description: "Lapis legit varian buah plum 1 loyang utuh (20×20 cm). Rasa manis asam segar buah plum asli menyatu dalam kelembutan lapis legit.",
    price: 325000,
    stock: 12,
    imageUrl: "/assets/products/lapis-plum-full.jpg",
    tag: "Favorit",
    type: "premium",
    categorySlug: "lapis-plum",
    categoryName: "Lapis Legit Varian Plum",
    rating: "5.0",
    reviews: "164",
  },
  {
    id: "lapis-plum-quarter",
    name: "Lapis Legit Varian Buah Plum (1/4 Loyang)",
    description: "Lapis legit varian buah plum dipotong 1/4 loyang (10×10 cm). Pilihan hemat dan pas untuk porsi santai bersama.",
    price: 95000,
    stock: 18,
    imageUrl: "/assets/products/lapis-plum-quarter.jpg",
    tag: "Hemat",
    type: "premium",
    categorySlug: "lapis-plum",
    categoryName: "Lapis Legit Varian Plum",
    rating: "4.8",
    reviews: "95",
  },
  {
    id: "lapis-plum-side",
    name: "Lapis Legit Varian Buah Plum (Layer Premium)",
    description: "Tampak samping keindahan belasan lapisan lapis legit dengan taburan & selipan buah plum pilihan yang berlimpah.",
    price: 325000,
    stock: 10,
    imageUrl: "/assets/products/lapis-plum-side.jpg",
    tag: "Premium",
    type: "premium",
    categorySlug: "lapis-plum",
    categoryName: "Lapis Legit Varian Plum",
    rating: "4.9",
    reviews: "138",
  },
];

function resolveRealProductImage(name: string, rawUrl?: string | null): string {
  if (rawUrl && !rawUrl.includes("lapis-legit.jpg") && rawUrl.startsWith("/")) {
    return rawUrl;
  }
  const n = name.toLowerCase();
  if (n.includes("plum") || n.includes("prune")) {
    if (n.includes("quarter") || n.includes("1/4")) return "/assets/products/lapis-plum-quarter.jpg";
    if (n.includes("side") || n.includes("samping") || n.includes("layer")) return "/assets/products/lapis-plum-side.jpg";
    return "/assets/products/lapis-plum-full.jpg";
  }
  if (n.includes("box") || n.includes("dus") || n.includes("half") || n.includes("1/2")) return "/assets/products/lapis-ori-box-half.jpg";
  if (n.includes("cut") || n.includes("bite") || n.includes("potong")) return "/assets/products/lapis-ori-box-cubes.jpg";
  if (n.includes("slice") || n.includes("pack")) return "/assets/products/lapis-slice-packs.jpg";
  return "/assets/products/lapis-ori-block.jpg";
}

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
    detail: "Katalog produk asli Sharenpan ditampilkan.",
  };

  if (hasSupabaseConfig) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, price, stock, image_url, category_id, categories(name, slug), created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        products = data.map((product, index) => {
          const category = Array.isArray(product.categories) ? product.categories[0] : product.categories;
          const isPlum = product.name.toLowerCase().includes("plum") || product.name.toLowerCase().includes("prune");
          const slug = isPlum ? "lapis-plum" : "lapis-original";
          const catName = isPlum ? "Lapis Legit Varian Plum" : "Lapis Legit Original";

          return {
            id: product.id,
            name: product.name,
            description: product.description ?? "Lapis legit premium Sharenpan resep warisan.",
            price: product.price,
            stock: product.stock,
            imageUrl: resolveRealProductImage(product.name, product.image_url),
            tag: index === 0 ? "Terlaris" : isPlum ? "Favorit" : "Praktis",
            type: isPlum ? "premium" : "classic",
            categorySlug: category?.slug || slug,
            categoryName: category?.name || catName,
            rating: "4.9",
            reviews: String(120 + index * 35),
          };
        });
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
          detail: "Katalog 5 produk asli Sharenpan ditampilkan.",
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
