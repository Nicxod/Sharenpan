"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TrackingStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

type OrderResult = {
  id: string;
  order_number: string;
  customer_name: string;
  status: TrackingStatus;
  created_at: string;
  desired_delivery_date: string | null;
  subtotal: number;
  shipping_fee: number;
  total: number;
  notes: string | null;
  shipping_address: {
    address_line?: string;
    city?: string;
    courier?: string;
    etd?: string;
  } | null;
  order_items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
};

const STATUS_STEPS: { key: TrackingStatus; label: string; icon: string; desc: string }[] = [
  { key: "pending",    label: "Pesanan Masuk",       icon: "📝", desc: "Pesanan diterima, menunggu konfirmasi dapur." },
  { key: "confirmed",  label: "Dikonfirmasi",         icon: "✅", desc: "Dapur sudah mengkonfirmasi pesanan Anda." },
  { key: "processing", label: "Dipanggang",           icon: "🔥", desc: "Lapis legit Anda sedang dipanggang fresh." },
  { key: "shipped",    label: "Dikirim",              icon: "🚚", desc: "Paket sedang dalam perjalanan ke tangan Anda." },
  { key: "delivered",  label: "Selesai",              icon: "🎉", desc: "Paket telah diterima. Selamat menikmati!" },
];

const STATUS_ORDER: TrackingStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];

const money = (v: number) => `Rp${v.toLocaleString("id-ID")}`;

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function OrderTracker() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    setResult(null);
    setSearched(true);

    try {
      const supabase = createClient();
      const { data, error: dbError } = await supabase
        .from("orders")
        .select(
          `id, order_number, customer_name, status, created_at, desired_delivery_date,
           subtotal, shipping_fee, total, notes, shipping_address,
           order_items(product_name, quantity, unit_price, subtotal)`
        )
        .eq("order_number", trimmed)
        .single();

      if (dbError || !data) {
        setError("Nomor pesanan tidak ditemukan. Pastikan kamu memasukkan nomor yang benar.");
      } else {
        setResult(data as OrderResult);
      }
    } catch {
      setError("Terjadi kesalahan saat mencari pesanan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  const currentStepIndex = result
    ? result.status === "cancelled"
      ? -1
      : STATUS_ORDER.indexOf(result.status)
    : -1;

  return (
    <div className="tracker-shell">
      {/* Topbar */}
      <div className="topbar">
        <span>Gratis ongkir untuk pesanan di atas Rp500.000</span>
        <span className="topbar-separator">•</span>
        <span>Dibuat fresh berdasarkan pesanan</span>
      </div>

      {/* Navbar */}
      <header className="navbar">
        <a className="brand" href="/" aria-label="Sharenpan home">
          <img src="/assets/logo.png" alt="Sharenpan Logo" className="brand-logo-img" />
          <span>
            sharenpan
            <small>lapis legit premium</small>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Navigasi utama">
          <a href="/">Home</a>
          <a href="/#produk">Produk</a>
          <a href="/#cerita">Tentang kami</a>
          <a href="/#cara-order">Cara order</a>
          <a href="/lacak" className="nav-pesanan-highlight">📦 Lacak Pesanan</a>
        </nav>
      </header>

      <main className="tracker-main content-width">
        {/* Hero */}
        <div className="tracker-hero">
          <p className="eyebrow">Tanpa login</p>
          <h1>Lacak Pesananmu</h1>
          <p className="tracker-subtitle">
            Masukkan nomor pesanan yang kamu terima lewat email atau WhatsApp untuk melihat status terkini.
          </p>
        </div>

        {/* Search Form */}
        <form className="tracker-form" onSubmit={handleSearch}>
          <div className="tracker-input-row">
            <input
              id="order-number-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase())}
              placeholder="Contoh: SPN-20240730-001"
              className="tracker-input"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="primary-button tracker-search-btn" disabled={loading}>
              {loading ? "Mencari…" : "Lacak"} {!loading && <span>→</span>}
            </button>
          </div>
          <small className="tracker-hint">
            💡 Nomor pesanan ada di email konfirmasi atau chat WhatsApp dari Sharenpan.
          </small>
        </form>

        {/* Error State */}
        {searched && !loading && error && (
          <div className="tracker-not-found">
            <div className="tracker-not-found-icon">🔍</div>
            <h3>Pesanan tidak ditemukan</h3>
            <p>{error}</p>
            <a href="/" className="secondary-button" style={{ display: "inline-flex", marginTop: "12px" }}>
              Kembali ke Toko
            </a>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="tracker-result">
            {/* Header Card */}
            <div className="tracker-card tracker-header-card">
              <div className="tracker-order-meta">
                <div>
                  <span className="eyebrow">Nomor Pesanan</span>
                  <h2 className="tracker-order-number">#{result.order_number}</h2>
                  <p className="tracker-customer">untuk <strong>{result.customer_name}</strong></p>
                </div>
                <div className="tracker-status-badge-big" data-status={result.status}>
                  {result.status === "cancelled" ? "❌ Dibatalkan" :
                   result.status === "delivered" ? "🎉 Selesai" :
                   result.status === "shipped" ? "🚚 Dikirim" :
                   result.status === "processing" ? "🔥 Dipanggang" :
                   result.status === "confirmed" ? "✅ Dikonfirmasi" :
                   "📝 Menunggu Konfirmasi"}
                </div>
              </div>

              <div className="tracker-dates">
                <div>
                  <small>Tanggal Pesan</small>
                  <strong>{formatDate(result.created_at)}</strong>
                </div>
                {result.desired_delivery_date && (
                  <div>
                    <small>Estimasi Kirim</small>
                    <strong>{formatDate(result.desired_delivery_date)}</strong>
                  </div>
                )}
                {result.shipping_address?.city && (
                  <div>
                    <small>Tujuan</small>
                    <strong>{result.shipping_address.city}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Timeline */}
            {result.status !== "cancelled" && (
              <div className="tracker-card">
                <h3 className="tracker-section-title">📍 Status Pengiriman</h3>
                <div className="tracker-timeline">
                  {STATUS_STEPS.map((step, idx) => {
                    const isDone = idx <= currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    return (
                      <div
                        key={step.key}
                        className={`tracker-step ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}`}
                      >
                        <div className="tracker-step-icon-wrap">
                          <div className="tracker-step-icon">{isDone ? step.icon : "○"}</div>
                          {idx < STATUS_STEPS.length - 1 && (
                            <div className={`tracker-step-line ${idx < currentStepIndex ? "done" : ""}`} />
                          )}
                        </div>
                        <div className="tracker-step-text">
                          <strong>{step.label}</strong>
                          {isCurrent && <small>{step.desc}</small>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {result.status === "cancelled" && (
              <div className="tracker-card tracker-cancelled-card">
                <span style={{ fontSize: "32px" }}>❌</span>
                <h3>Pesanan Dibatalkan</h3>
                <p>Pesanan ini telah dibatalkan. Hubungi kami jika ada pertanyaan.</p>
              </div>
            )}

            {/* Order Items */}
            <div className="tracker-card">
              <h3 className="tracker-section-title">🎂 Rincian Pesanan</h3>
              <div className="tracker-items">
                {result.order_items.map((item, i) => (
                  <div className="tracker-item-row" key={i}>
                    <div>
                      <strong>{item.product_name}</strong>
                      <small>{money(item.unit_price)} × {item.quantity}</small>
                    </div>
                    <span>{money(item.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="tracker-bill">
                <div>
                  <span>Subtotal</span>
                  <span>{money(result.subtotal)}</span>
                </div>
                <div>
                  <span>Ongkos Kirim ({result.shipping_address?.courier ?? "Standar"})</span>
                  <span>{result.shipping_fee === 0 ? "GRATIS" : money(result.shipping_fee)}</span>
                </div>
                <div className="tracker-bill-total">
                  <span>Total</span>
                  <strong>{money(result.total)}</strong>
                </div>
              </div>
            </div>

            {/* Shipping Info */}
            {result.shipping_address && (
              <div className="tracker-card">
                <h3 className="tracker-section-title">📦 Info Pengiriman</h3>
                <div className="tracker-shipping-info">
                  {result.shipping_address.address_line && (
                    <div>
                      <small>Alamat</small>
                      <span>{result.shipping_address.address_line}, {result.shipping_address.city}</span>
                    </div>
                  )}
                  {result.shipping_address.courier && (
                    <div>
                      <small>Kurir</small>
                      <span>{result.shipping_address.courier} {result.shipping_address.etd ? `(${result.shipping_address.etd})` : ""}</span>
                    </div>
                  )}
                  {result.notes && (
                    <div>
                      <small>Catatan</small>
                      <span>{result.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="tracker-cta">
              <a href="/" className="primary-button">Pesan Lagi <span>→</span></a>
              <button
                className="secondary-button"
                onClick={() => { setResult(null); setQuery(""); setSearched(false); }}
              >
                Cari Pesanan Lain
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="storefront-footer" style={{ marginTop: "60px" }}>
        <div className="content-width" style={{ textAlign: "center", padding: "28px 0", color: "#a1795a", fontSize: "13px" }}>
          © 2024 Sharenpan — Lapis Legit Premium. Ada pertanyaan?{" "}
          <a href="https://wa.me/6281234567890" style={{ color: "var(--brown)", fontWeight: 700 }}>
            Hubungi kami via WhatsApp
          </a>
        </div>
      </footer>
    </div>
  );
}
