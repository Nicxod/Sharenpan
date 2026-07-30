"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PaymentGatewayModal from "@/components/payment-gateway-modal";
import SharedNavbar from "@/components/shared-navbar";

export type CustomerOrder = {
  id: string;
  order_number: string;
  total: number;
  subtotal?: number;
  shipping_fee?: number;
  status: string;
  payment_status: string;
  shipping_address?: { address_line?: string; city?: string; courier?: string; etd?: string };
  notes?: string;
  desired_delivery_date?: string;
  created_at: string;
};

export type CustomerData = {
  name: string;
  email: string;
  phone: string;
  orders: CustomerOrder[];
};

type SideTab = "pesanan" | "profile" | "voucher";

const money = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
const dateShort = (v: string) =>
  new Date(v).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const dateFull = (v: string) =>
  new Date(v).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

const statusLabel: Record<string, string> = {
  pending: "Menunggu Konfirmasi",
  confirmed: "Dikonfirmasi",
  processing: "Sedang Dipanggang 🔥",
  shipped: "Dalam Pengiriman 🚚",
  completed: "Pesanan Selesai ✅",
  cancelled: "Dibatalkan",
};

const statusColor: Record<string, string> = {
  pending: "pill-amber",
  confirmed: "pill-blue",
  processing: "pill-orange",
  shipped: "pill-blue",
  completed: "pill-green",
  cancelled: "pill-red",
};

const paymentLabel: Record<string, { text: string; cls: string }> = {
  unpaid:   { text: "Belum Dibayar",        cls: "pill-red"   },
  pending:  { text: "Menunggu Verifikasi",   cls: "pill-amber" },
  paid:     { text: "Lunas",                cls: "pill-green" },
  failed:   { text: "Gagal",               cls: "pill-red"   },
  refunded: { text: "Dikembalikan",         cls: "pill-amber" },
};

function getSteps(status: string, payStatus: string, createdAt: string) {
  const isPaid      = payStatus === "paid";
  const isConfirmed = status !== "pending" || isPaid;
  const isProcess   = ["processing", "shipped", "completed"].includes(status);
  const isShipped   = ["shipped", "completed"].includes(status);
  const isDone      = status === "completed";
  const d           = dateShort(createdAt);
  return [
    { id: 1, label: "Pesanan Masuk",     icon: "📝", done: true,         active: status === "pending" && !isPaid, sub: d },
    { id: 2, label: "Pembayaran Lunas",  icon: "💳", done: isPaid || isConfirmed, active: isConfirmed && !isProcess && status !== "pending", sub: isPaid ? "Terverifikasi" : "Menunggu" },
    { id: 3, label: "Dipanggang Dapur",  icon: "🧑‍🍳", done: isProcess,    active: status === "processing", sub: isProcess ? "Fresh Oven" : "Antrean" },
    { id: 4, label: "Dikirim Kurir",     icon: "🚚", done: isShipped,    active: status === "shipped",     sub: isShipped ? "Dalam Perjalanan" : "Ekspedisi" },
    { id: 5, label: "Pesanan Selesai",   icon: "🎉", done: isDone,       active: isDone,                   sub: isDone ? "Diterima" : "Estimasi" },
  ];
}

export default function CustomerDashboard({ initialData }: { initialData: CustomerData }) {
  const [data, setData]                           = useState(initialData);
  const [tab, setTab]                             = useState<SideTab>("pesanan");
  const [orderView, setOrderView]                 = useState<"active" | "history">("active");
  const [payOrder, setPayOrder]                   = useState<CustomerOrder | null>(null);
  const [detailOrder, setDetailOrder]             = useState<CustomerOrder | null>(null);
  const [feedbackOrder, setFeedbackOrder]         = useState<CustomerOrder | null>(null);
  const [feedbackRating, setFeedbackRating]       = useState(5);
  const [feedbackMsg, setFeedbackMsg]             = useState("");
  const [feedbackOk, setFeedbackOk]               = useState("");
  const [feedbackLoading, setFeedbackLoading]     = useState(false);
  const [search, setSearch]                       = useState("");

  async function signOut() {
    await createClient().auth.signOut();
    window.location.href = "/";
  }

  async function refreshOrders() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: rows } = await supabase
      .from("orders")
      .select("id,order_number,total,subtotal,shipping_fee,status,payment_status,shipping_address,notes,desired_delivery_date,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (rows) setData((p) => ({ ...p, orders: rows }));
  }

  const activeOrders  = data.orders.filter((o) => !["completed", "cancelled"].includes(o.status));
  const totalSpent    = data.orders.filter((o) => o.payment_status === "paid").reduce((s, o) => s + o.total, 0);
  const filteredHistory = data.orders.filter(
    (o) =>
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      (statusLabel[o.status] || "").toLowerCase().includes(search.toLowerCase())
  );

  /* ─── NAV ITEMS ─────────────────────────────────────────── */
  const navItems: { key: SideTab; icon: string; label: string; badge?: number }[] = [
    { key: "pesanan",  icon: "📦", label: "Pesanan Saya",  badge: activeOrders.length || undefined },
    { key: "profile",  icon: "👤", label: "Profil & Akun" },
    { key: "voucher",  icon: "🎟️", label: "Voucher Saya"  },
  ];

  return (
    <div className="cd-shell">
      {/* ── SHARED NAVBAR — sama persis dengan halaman lain ── */}
      <SharedNavbar variant="customer" onSignOut={signOut} />

      {/* ── BODY: SIDEBAR + CONTENT ── */}
      <div className="cd-body">

        {/* ── SIDEBAR ── */}
        <aside className="cd-sidebar">
          {/* Avatar card */}
          <div className="cd-sidebar-profile">
            <div className="cd-avatar">{data.name.slice(0, 1).toUpperCase()}</div>
            <div className="cd-sidebar-name">{data.name}</div>
            <div className="cd-sidebar-email">{data.email}</div>
            <span className="cd-verified-pill">✓ Customer Terverifikasi</span>
          </div>

          {/* Stats */}
          <div className="cd-sidebar-stats">
            <div className="cd-sidebar-stat">
              <strong>{data.orders.length}</strong>
              <span>Total Order</span>
            </div>
            <div className="cd-sidebar-stat-divider" />
            <div className="cd-sidebar-stat">
              <strong style={{ color: activeOrders.length > 0 ? "#c97c3a" : "inherit" }}>
                {activeOrders.length}
              </strong>
              <span>Aktif</span>
            </div>
            <div className="cd-sidebar-stat-divider" />
            <div className="cd-sidebar-stat">
              <strong style={{ fontSize: "11px", letterSpacing: 0 }}>{money(totalSpent)}</strong>
              <span>Total Belanja</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="cd-sidebar-nav" aria-label="Dashboard navigasi">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`cd-sidebar-nav-item ${tab === item.key ? "active" : ""}`}
                onClick={() => setTab(item.key)}
              >
                <span className="cd-snav-icon">{item.icon}</span>
                <span className="cd-snav-label">{item.label}</span>
                {item.badge ? <span className="cd-snav-badge">{item.badge}</span> : null}
              </button>
            ))}
          </nav>

          <button className="cd-sidebar-logout" onClick={signOut}>⟵ Keluar Akun</button>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="cd-content">

          {/* ════════════ TAB: PESANAN ════════════ */}
          {tab === "pesanan" && (
            <div className="cd-page">
              <div className="cd-page-header">
                <div>
                  <h1>📦 Pesanan Saya</h1>
                  <p>Pantau status pengerjaan & riwayat transaksi lapis legit kamu</p>
                </div>
                {/* Sub-tab toggle */}
                <div className="cd-subtab-toggle">
                  <button
                    className={`cd-subtab ${orderView === "active" ? "active" : ""}`}
                    onClick={() => setOrderView("active")}
                  >
                    🔥 Aktif {activeOrders.length > 0 && <span className="cd-subtab-badge">{activeOrders.length}</span>}
                  </button>
                  <button
                    className={`cd-subtab ${orderView === "history" ? "active" : ""}`}
                    onClick={() => setOrderView("history")}
                  >
                    📜 Riwayat
                  </button>
                </div>
              </div>

              {/* ─ PESANAN AKTIF ─ */}
              {orderView === "active" && (
                activeOrders.length === 0 ? (
                  <div className="cd-empty">
                    <span>🍰</span>
                    <h3>Belum ada pesanan aktif</h3>
                    <p>Setiap kue lapis legit dipanggang fresh 100% Wijsman butter khusus pesanan kamu.</p>
                    <Link href="/" className="primary-button" style={{ display: "inline-flex", marginTop: "14px" }}>
                      Pesan Sekarang <span>→</span>
                    </Link>
                  </div>
                ) : (
                  activeOrders.map((order) => {
                    const steps  = getSteps(order.status, order.payment_status, order.created_at);
                    const unpaid = order.payment_status === "unpaid";
                    return (
                      <div key={order.id} className="cd-order-card">
                        {/* Card header */}
                        <div className="cd-ocard-head">
                          <div>
                            <span className="cd-ocard-label">No. Pesanan</span>
                            <h2 className="cd-ocard-number">#{order.order_number}</h2>
                            <span className="cd-ocard-date">Dipesan {dateShort(order.created_at)}</span>
                          </div>
                          <div className="cd-ocard-pills">
                            <span className={`cd-pill ${statusColor[order.status] || ""}`}>
                              {statusLabel[order.status] || order.status}
                            </span>
                            <span className={`cd-pill ${paymentLabel[order.payment_status]?.cls || ""}`}>
                              {paymentLabel[order.payment_status]?.text || order.payment_status}
                            </span>
                          </div>
                        </div>

                        {/* Delivery date */}
                        {order.desired_delivery_date && (
                          <div className="cd-delivery-banner">
                            🗓️ Estimasi Pengiriman:&nbsp;
                            <strong>
                              {new Date(order.desired_delivery_date).toLocaleDateString("id-ID", {
                                weekday: "long", day: "numeric", month: "long", year: "numeric",
                              })}
                            </strong>
                          </div>
                        )}

                        {/* Stepper */}
                        <div className="cd-stepper">
                          {steps.map((step, idx) => (
                            <div key={step.id} className={`cd-step ${step.done ? "done" : ""} ${step.active ? "current" : ""}`}>
                              {idx > 0 && <div className={`cd-step-line ${step.done ? "done" : ""}`} />}
                              <div className="cd-step-bubble">{step.done ? "✓" : step.icon}</div>
                              <span className="cd-step-label">{step.label}</span>
                              <small className="cd-step-sub">{step.sub}</small>
                            </div>
                          ))}
                        </div>

                        {/* Footer */}
                        <div className="cd-ocard-foot">
                          <div className="cd-ocard-total">
                            <span>Total Tagihan</span>
                            <strong>{money(order.total)}</strong>
                          </div>
                          <div className="cd-ocard-actions">
                            <button className="secondary-button" onClick={() => setDetailOrder(order)}>
                              🔍 Lihat Detail
                            </button>
                            {unpaid && (
                              <button className="primary-button" onClick={() => setPayOrder(order)}>
                                💳 Bayar Sekarang
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              )}

              {/* ─ RIWAYAT ─ */}
              {orderView === "history" && (
                <>
                  <div className="cd-search-row">
                    <input
                      className="cd-search-input"
                      placeholder="Cari nomor pesanan atau status…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  {filteredHistory.length === 0 ? (
                    <div className="cd-empty">
                      <span>🔍</span>
                      <h3>Tidak ada pesanan ditemukan</h3>
                      <p>Coba ubah kata kunci pencarian kamu.</p>
                    </div>
                  ) : (
                    <div className="cd-history-list">
                      {filteredHistory.map((order) => (
                        <div key={order.id} className="cd-history-card">
                          <div className="cd-hcard-left">
                            <strong className="cd-hcard-num">#{order.order_number}</strong>
                            <span className="cd-hcard-date">{dateFull(order.created_at)}</span>
                            {order.shipping_address?.city && (
                              <span className="cd-hcard-city">📍 {order.shipping_address.city}</span>
                            )}
                          </div>
                          <div className="cd-hcard-mid">
                            <span className={`cd-pill ${statusColor[order.status] || ""}`}>
                              {statusLabel[order.status] || order.status}
                            </span>
                            <span className={`cd-pill ${paymentLabel[order.payment_status]?.cls || ""}`}>
                              {paymentLabel[order.payment_status]?.text || order.payment_status}
                            </span>
                          </div>
                          <div className="cd-hcard-right">
                            <strong className="cd-hcard-total">{money(order.total)}</strong>
                            <div className="cd-hcard-actions">
                              <button className="secondary-button cd-hcard-btn" onClick={() => setDetailOrder(order)}>
                                Detail
                              </button>
                              {order.status === "completed" && (
                                <button
                                  className="secondary-button cd-hcard-btn"
                                  style={{ borderColor: "#c09050", color: "#7a4f28" }}
                                  onClick={() => setFeedbackOrder(order)}
                                >
                                  💬 Ulasan
                                </button>
                              )}
                              {order.payment_status === "unpaid" && (
                                <button className="primary-button cd-hcard-btn" onClick={() => setPayOrder(order)}>
                                  Bayar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ════════════ TAB: PROFIL ════════════ */}
          {tab === "profile" && (
            <div className="cd-page">
              <div className="cd-page-header">
                <div>
                  <h1>👤 Profil & Akun</h1>
                  <p>Informasi akun yang terdaftar untuk keperluan pesanan kamu</p>
                </div>
              </div>

              <div className="cd-profile-grid">
                {/* Info pribadi */}
                <div className="cd-profile-card">
                  <h3>Informasi Pribadi</h3>
                  {[
                    { label: "Nama Lengkap",      val: data.name },
                    { label: "Email Terdaftar",    val: data.email },
                    { label: "No. WhatsApp",       val: data.phone || "Belum diisi" },
                    { label: "Status Akun",        val: "✅ Terverifikasi Customer Sharenpan", green: true },
                  ].map((row) => (
                    <div key={row.label} className="cd-profile-row">
                      <span className="cd-profile-key">{row.label}</span>
                      <span className="cd-profile-val" style={row.green ? { color: "#2e7d32", fontWeight: 700 } : {}}>
                        {row.val}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Alamat terakhir */}
                <div className="cd-profile-card">
                  <h3>Alamat Pengiriman Terbaru</h3>
                  {data.orders.length > 0 && data.orders[0].shipping_address?.address_line ? (
                    <>
                      <p className="cd-profile-address">{data.orders[0].shipping_address.address_line}</p>
                      <span className="cd-profile-city-tag">📍 {data.orders[0].shipping_address.city}</span>
                    </>
                  ) : (
                    <p className="cd-profile-empty">Alamat akan otomatis tersimpan setelah kamu checkout pertama kali.</p>
                  )}
                  <div style={{ marginTop: "24px" }}>
                    <Link href="/" className="primary-button" style={{ display: "inline-flex" }}>
                      Mulai Belanja <span>→</span>
                    </Link>
                  </div>
                </div>

                {/* Ringkasan belanja */}
                <div className="cd-profile-card cd-profile-summary">
                  <h3>Ringkasan Belanja</h3>
                  <div className="cd-summary-stat-row">
                    <span>Total Transaksi</span><strong>{data.orders.length} pesanan</strong>
                  </div>
                  <div className="cd-summary-stat-row">
                    <span>Pesanan Lunas</span>
                    <strong>{data.orders.filter((o) => o.payment_status === "paid").length} pesanan</strong>
                  </div>
                  <div className="cd-summary-stat-row">
                    <span>Total Pengeluaran</span>
                    <strong style={{ color: "#7a4f28", fontFamily: "Georgia, serif", fontSize: "17px" }}>{money(totalSpent)}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════ TAB: VOUCHER ════════════ */}
          {tab === "voucher" && (
            <div className="cd-page">
              <div className="cd-page-header">
                <div>
                  <h1>🎟️ Voucher Saya</h1>
                  <p>Kode promo & diskon spesial yang aktif untuk pesanan kamu</p>
                </div>
              </div>

              <div className="cd-voucher-grid">
                {/* Voucher aktif */}
                <div className="cd-voucher-card cd-voucher-active">
                  <div className="cd-voucher-top">
                    <span className="cd-voucher-badge-active">● AKTIF</span>
                    <span className="cd-voucher-exp">Berlaku selamanya</span>
                  </div>
                  <div className="cd-voucher-code">WELCOME10</div>
                  <div className="cd-voucher-desc">Diskon 10% untuk semua produk lapis legit Sharenpan</div>
                  <div className="cd-voucher-value">Hemat 10%</div>
                  <div className="cd-voucher-notch-left" />
                  <div className="cd-voucher-notch-right" />
                </div>

                {/* Voucher informasi */}
                <div className="cd-voucher-card cd-voucher-info">
                  <div className="cd-voucher-top">
                    <span className="cd-voucher-badge-info">ℹ️ INFO</span>
                  </div>
                  <div className="cd-voucher-code" style={{ fontSize: "18px", letterSpacing: "2px" }}>SHARENPAN50K</div>
                  <div className="cd-voucher-desc">Potongan Rp50.000 untuk pembelian minimal Rp250.000</div>
                  <div className="cd-voucher-value">Hemat Rp50.000</div>
                  <div className="cd-voucher-notch-left" />
                  <div className="cd-voucher-notch-right" />
                </div>
              </div>

              <p className="cd-voucher-note">
                💡 Masukkan kode voucher di halaman checkout saat kamu melakukan pemesanan.
              </p>
            </div>
          )}

        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="cd-mobile-nav" aria-label="Navigasi mobile">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`cd-mobile-nav-item ${tab === item.key ? "active" : ""}`}
            onClick={() => setTab(item.key)}
          >
            <span className="cd-mobile-nav-icon">{item.icon}</span>
            <span className="cd-mobile-nav-label">{item.label}</span>
            {item.badge ? <span className="cd-mobile-nav-badge">{item.badge}</span> : null}
          </button>
        ))}
        <button className="cd-mobile-nav-item" onClick={signOut}>
          <span className="cd-mobile-nav-icon">🚪</span>
          <span className="cd-mobile-nav-label">Keluar</span>
        </button>
      </nav>

      {/* ── MODALS ── */}

      {/* Detail Modal */}
      {detailOrder && (
        <div className="modal-backdrop" onClick={() => setDetailOrder(null)}>
          <div className="order-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDetailOrder(null)}>×</button>
            <p className="eyebrow">Rincian Pesanan</p>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "24px", margin: "4px 0 16px", color: "#6f4932" }}>
              #{detailOrder.order_number}
            </h2>

            {/* Stepper */}
            <div className="cd-stepper" style={{ margin: "16px 0" }}>
              {getSteps(detailOrder.status, detailOrder.payment_status, detailOrder.created_at).map((step, idx) => (
                <div key={step.id} className={`cd-step ${step.done ? "done" : ""} ${step.active ? "current" : ""}`}>
                  {idx > 0 && <div className={`cd-step-line ${step.done ? "done" : ""}`} />}
                  <div className="cd-step-bubble">{step.done ? "✓" : step.icon}</div>
                  <span className="cd-step-label">{step.label}</span>
                  <small className="cd-step-sub">{step.sub}</small>
                </div>
              ))}
            </div>

            <div className="order-detail-meta">
              <div><span>Waktu Transaksi</span><strong>{dateFull(detailOrder.created_at)}</strong></div>
              <div><span>Status Pembayaran</span><strong>{paymentLabel[detailOrder.payment_status]?.text || detailOrder.payment_status}</strong></div>
              {detailOrder.desired_delivery_date && (
                <div>
                  <span>Estimasi Tanggal Kirim</span>
                  <strong>
                    {new Date(detailOrder.desired_delivery_date).toLocaleDateString("id-ID", {
                      weekday: "long", day: "numeric", month: "long", year: "numeric",
                    })}
                  </strong>
                </div>
              )}
              <div>
                <span>Alamat Pengiriman</span>
                <strong>{detailOrder.shipping_address?.address_line || "—"} ({detailOrder.shipping_address?.city || "—"})</strong>
              </div>
              <div><span>Catatan</span><strong>{detailOrder.notes || "Tidak ada catatan"}</strong></div>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "var(--muted)" }}>Total Tagihan</span>
              <strong style={{ fontFamily: "Georgia, serif", fontSize: "22px", color: "#7a4f28" }}>{money(detailOrder.total)}</strong>
            </div>

            {detailOrder.payment_status === "unpaid" && (
              <button className="primary-button full-button" style={{ marginTop: "16px" }}
                onClick={() => { const o = detailOrder; setDetailOrder(null); setPayOrder(o); }}>
                💳 Lanjut Bayar ({money(detailOrder.total)})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payOrder && (
        <PaymentGatewayModal
          orderId={payOrder.id}
          orderNumber={payOrder.order_number}
          totalAmount={payOrder.total}
          onClose={() => setPayOrder(null)}
          onSuccess={() => { setPayOrder(null); refreshOrders(); }}
        />
      )}

      {/* Feedback Modal */}
      {feedbackOrder && (
        <div className="modal-backdrop" onClick={() => setFeedbackOrder(null)}>
          <div className="order-detail-modal" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setFeedbackOrder(null)}>×</button>
            <p className="eyebrow">Peningkatan Layanan</p>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", margin: "4px 0 8px", color: "#6f4932" }}>
              Masukan Privat Pelanggan
            </h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "18px" }}>
              Untuk Order <strong>#{feedbackOrder.order_number}</strong> — dikirim privat ke Admin Sharenpan.
            </p>
            {feedbackOk ? (
              <div className="success-message" style={{ textAlign: "center", padding: "18px" }}>{feedbackOk}</div>
            ) : (
              <form className="stack-form" onSubmit={async (e) => {
                e.preventDefault();
                if (!feedbackMsg.trim()) return;
                setFeedbackLoading(true);
                try {
                  const supabase = createClient();
                  const { data: { user } } = await supabase.auth.getUser();
                  await supabase.from("customer_feedback").insert({
                    order_id: feedbackOrder.id,
                    user_id: user?.id || null,
                    customer_name: data.name,
                    customer_email: data.email,
                    rating_score: feedbackRating,
                    message: feedbackMsg.trim(),
                  });
                  setFeedbackOk("Terima kasih! Masukan Anda terkirim privat ke Admin Sharenpan.");
                  setTimeout(() => { setFeedbackOk(""); setFeedbackOrder(null); setFeedbackMsg(""); }, 2400);
                } catch { /* silent */ }
                finally { setFeedbackLoading(false); }
              }}>
                <label>
                  Tingkat Kepuasan
                  <div style={{ display: "flex", gap: "8px", margin: "6px 0" }}>
                    {[1,2,3,4,5].map((star) => (
                      <button key={star} type="button" onClick={() => setFeedbackRating(star)}
                        style={{ border: "1px solid #e2d5c5", borderRadius: "8px", padding: "6px 12px", fontSize: "20px", cursor: "pointer",
                          background: feedbackRating >= star ? "#fffbf2" : "#fff",
                          color: feedbackRating >= star ? "#bd7f35" : "#ccc" }}>
                        ★
                      </button>
                    ))}
                  </div>
                </label>
                <label>
                  Kritik & Saran
                  <textarea rows={4} value={feedbackMsg} onChange={(e) => setFeedbackMsg(e.target.value)} required
                    placeholder="Rasa kue, kemasan, pengiriman, pelayanan..." />
                </label>
                <button className="primary-button full-button" disabled={feedbackLoading}>
                  {feedbackLoading ? "Mengirim…" : "Kirim Masukan Privat"} <span>→</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
