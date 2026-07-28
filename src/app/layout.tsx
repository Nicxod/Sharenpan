import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://sharenpan.vercel.app"),
  title: "Sharenpan — Lapis Legit Premium Freshly Baked Bandung",
  description:
    "Lapis legit premium pilihan yang dipanggang perlahan dengan 100% Butter Wijsman & telur segar pilihan. Lembut, harum, dan dibuat fresh untuk momen berharga Anda.",
  keywords: [
    "lapis legit",
    "lapis legit bandung",
    "lapis legit wijsman",
    "kue lapis premium",
    "hampers lapis legit",
    "sharenpan",
  ],
  authors: [{ name: "Sharenpan Bakery" }],
  openGraph: {
    title: "Sharenpan — Setiap Lapis Punya Cerita",
    description:
      "Lapis legit premium dipanggang fresh dari Kota Bandung dengan mentega Wijsman pilihan. Pengiriman cepat ke seluruh Indonesia.",
    url: "https://sharenpan.vercel.app",
    siteName: "Sharenpan Lapis Legit",
    images: [
      {
        url: "/assets/lapis-legit.jpg",
        width: 1200,
        height: 630,
        alt: "Lapis Legit Premium Sharenpan",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sharenpan — Lapis Legit Premium Bandung",
    description:
      "Dipanggang fresh perlahan dengan 100% Butter Wijsman & telur segar pilihan.",
    images: ["/assets/lapis-legit.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

