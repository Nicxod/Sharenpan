"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PaymentGatewayModal from "@/components/payment-gateway-modal";

export type CustomerOrder = {
  id: string;
  order_number: string;
  total: number;
  subtotal?: number;
  shipping_fee?: number;
  status: string; // 'pending' | 'confirmed' | 'processing' | 'shipped' | 'completed' | 'cancelled'
  payment_status: string; // 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded'
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

type TabType = "overview" | "orders" | "profile";

const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const date = (value: string) =>
  new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const statusLabel: Record<string, string> = {
  pending: "Menunggu Konfirmasi",
  confirmed: "Pesanan Dikonfirmasi",
  processing: "Sedang Dipanggang Fresh",
  shipped: "Dalam Pengiriman Kurir",
  completed: "Pesanan Selesai",
  cancelled: "Dibatalkan",
};

const paymentStatusLabel: Record<string, { label: string; color: string }> = {
  unpaid: { label: "Belum Dibayar", color: "badge-unpaid" },
  pending: { label: "Menunggu Verifikasi", color: "badge-unpaid" },
  paid: { label: "Lunas ✅", color: "badge-paid" },
  failed: { label: "Gagal", color: "badge-failed" },
  refunded: { label: "Dikembalikan", color: "badge-failed" },
};

function getTimelineSteps(status: string, paymentStatus: string, createdAt: string) {
  const isPaid = paymentStatus === "paid";
  const isConfirmed = status !== "pending" || isPaid;
  const isProcessing = ["processing", "shipped", "completed"].includes(status);
  const isShipped = ["shipped", "completed"].includes(status);
  const isCompleted = status === "completed";

  const formattedDate = new Date(createdAt).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });

  return [
    { id: 1, title: "Pesanan Masuk", icon: "📝", completed: true, active: status === "pending" && !isPaid, time: formattedDate },
    { id: 2, title: "Pembayaran Lunas", icon: "💳", completed: isPaid || isConfirmed, active: isConfirmed && !isProcessing && status !== "pending", time: isPaid ? "Terverifikasi" : "Menunggu" },
    { id: 3, title: "Dipanggang Dapur", icon: "🧑‍🍳", completed: isProcessing, active: status === "processing", time: isProcessing ? "Fresh Oven" : "Antrean" },
    { id: 4, title: "Dikirim Kurir", icon: "🚚", completed: isShipped, active: status === "shipped", time: isShipped ? "Dalam Perjalanan" : "Ekspedisi" },
    { id: 5, title: "Pesanan Selesai", icon: "🎉", completed: isCompleted, active: isCompleted, time: isCompleted ? "Diterima" : "Estimasi Tiba" },
  ];
}

export default function CustomerDashboard({ initialData }: { initialData: CustomerData }) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window === "undefined") return "overview";
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tab === "profile" || tab === "orders" || tab === "overview" ? tab : "overview";
  });
  const [selectedOrderForPay, setSelectedOrderForPay] = useState<CustomerOrder | null>(null);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<CustomerOrder | null>(null);
  const [selectedOrderForFeedback, setSelectedOrderForFeedback] = useState<CustomerOrder | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  async function signOut() {
    await createClient().auth.signOut();
    window.location.href = "/";
  }

  async function refreshOrders() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: updatedOrders } = await supabase
      .from("orders")
      .select("id, order_number, total, subtotal, shipping_fee, status, payment_status, shipping_address, notes, desired_delivery_date, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (updatedOrders) {
      setData((prev) => ({ ...prev, orders: updatedOrders }));
    }
  }

  function handlePaymentSuccess() {
    setSelectedOrderForPay(null);
    refreshOrders();
  }

  const activeOrders = data.orders.filter((order) => !["completed", "cancelled"].includes(order.status));
  const totalSpent = data.orders
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + o.total, 0);

  const filteredOrders = data.orders.filter((order) =>
    order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (statusLabel[order.status] || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="customer-redesign-shell">
      {/* Topbar */}
      <div className="topbar">
        <span>Gratis ongkir untuk pesanan di atas Rp500.000</span>
        <span className="topbar-separator">•</span>
        <span>Dibuat fresh berdasarkan pesanan</span>
      </div>

      {/* Simplified Clean Header Navbar */}
      <header className="customer-clean-navbar">
        <div className="content-width nav-inner">
          <Link className="brand" href="/">
            <img src="/assets/logo.png" alt="Sharenpan Logo" className="brand-logo-img" />
            <span>
              sharenpan
              <small>lapis legit premium</small>
            </span>
          </Link>

          <div className="nav-actions-clean">
            <Link href="/" className="primary-button" style={{ fontSize: "12px", padding: "8px 16px", minHeight: "36px" }}>
              🛍️ Belanja Lagi <span>→</span>
            </Link>
            <button className="logout-button" onClick={signOut} style={{ minHeight: "36px" }}>
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="customer-redesign-main content-width">
        {/* HERO USER BANNER */}
        <div className="customer-hero-card">
          <div className="hero-avatar">
            {data.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="hero-info">
            <div className="hero-tags">
              <span className="hero-tag-pill">✨ Customer Sharenpan</span>
              <span className="hero-tag-email">{data.email}</span>
            </div>
            <h1>Halo, {data.name}! 👋</h1>
            <p>Selamat datang di akun Sharenpan kamu. Pantau proses pesanan & atur profil dengan mudah.</p>
          </div>
        </div>

        {/* 3 SUMMARY STAT CARDS */}
        <div className="customer-stats-grid">
          <div className="stat-card" onClick={() => setActiveTab("orders")} style={{ cursor: "pointer" }}>
            <span className="stat-icon">📦</span>
            <div>
              <span className="stat-label">Total Pesanan</span>
              <strong className="stat-value">{data.orders.length} Transaksi</strong>
            </div>
          </div>

          <div className="stat-card" onClick={() => setActiveTab("overview")} style={{ cursor: "pointer" }}>
            <span className="stat-icon">🔥</span>
            <div>
              <span className="stat-label">Pesanan Berlangsung</span>
              <strong className="stat-value" style={{ color: activeOrders.length > 0 ? "#6f4932" : "inherit" }}>
                {activeOrders.length} Aktif Diproses
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-icon">🎟️</span>
            <div>
              <span className="stat-label">Voucher Aktif</span>
              <strong className="stat-value" style={{ color: "#2e7d32" }}>WELCOME10 (Diskon 10%)</strong>
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION PILLS */}
        <div className="customer-tab-pills">
          <button
            className={`tab-pill ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            🔥 Status Pesanan Aktif {activeOrders.length > 0 && <span className="tab-badge">{activeOrders.length}</span>}
          </button>
          <button
            className={`tab-pill ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            📜 Semua Riwayat Pesanan ({data.orders.length})
          </button>
          <button
            className={`tab-pill ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            👤 Profil & Alamat Saya
          </button>
        </div>

        {/* TAB 1: PESANAN AKTIF */}
        {activeTab === "overview" && (
          <section className="customer-tab-content">
            <div className="section-title-box">
              <h2>🔥 Lacak Pesanan Berlangsung</h2>
              <p>Proses pembuatan fresh dari oven hingga pengiriman kurir real-time</p>
            </div>

            {activeOrders.length === 0 ? (
              <div className="empty-state-card">
                <span className="empty-icon">🍰</span>
                <h3>Belum ada pesanan aktif saat ini</h3>
                <p>Kue lapis legit Sharenpan dipanggang fresh 100% Wijsman butter per pesanan kamu.</p>
                <Link href="/" className="primary-button" style={{ display: "inline-flex", marginTop: "12px" }}>
                  Pesan Lapis Legit Sekarang <span>→</span>
                </Link>
              </div>
            ) : (
              activeOrders.map((order) => {
                const steps = getTimelineSteps(order.status, order.payment_status, order.created_at);
                const isUnpaid = order.payment_status === "unpaid";

                return (
                  <div key={order.id} className="order-modern-card">
                    <div className="order-card-top">
                      <div className="order-number-box">
                        <span className="order-number-title">No. Pesanan</span>
                        <h3>#{order.order_number}</h3>
                        <span className="order-date-text">Dipesan pada {date(order.created_at)}</span>
                      </div>
                      <div className="order-status-group">
                        <span className={`status-pill-modern ${order.status}`}>
                          {statusLabel[order.status] || order.status}
                        </span>
                        <span className={`status-pill-payment ${paymentStatusLabel[order.payment_status]?.color || ""}`}>
                          {paymentStatusLabel[order.payment_status]?.label || order.payment_status}
                        </span>
                      </div>
                    </div>

                    {order.desired_delivery_date && (
                      <div className="delivery-date-banner-mini">
                        🗓️ Estimasi Tanggal Kirim: <strong>{new Date(order.desired_delivery_date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong>
                      </div>
                    )}

                    {/* Timeline Progress */}
                    <div className="stepper-horizontal">
                      {steps.map((step) => (
                        <div key={step.id} className={`step-item ${step.completed ? "done" : ""} ${step.active ? "current" : ""}`}>
                          <div className="step-bubble">{step.completed ? "✓" : step.icon}</div>
                          <span className="step-text">{step.title}</span>
                          <small className="step-subtext">{step.time}</small>
                        </div>
                      ))}
                    </div>

                    <div className="order-card-bottom">
                      <div className="order-total-preview">
                        <span>Total Tagihan:</span>
                        <strong>{money(order.total)}</strong>
                      </div>
                      <div className="order-action-buttons">
                        <button className="secondary-button" onClick={() => setSelectedOrderForDetail(order)}>
                          🔍 Detail & Alamat
                        </button>
                        {isUnpaid && (
                          <button className="primary-button" onClick={() => setSelectedOrderForPay(order)}>
                            💳 Bayar Sekarang ({money(order.total)})
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}

        {/* TAB 2: RIWAYAT TRANSAKSI */}
        {activeTab === "orders" && (
          <section className="customer-tab-content">
            <div className="section-title-box search-header-box">
              <div>
                <h2>📜 Riwayat Transaksi</h2>
                <p>Seluruh riwayat belanja kue lapis legit Sharenpan kamu</p>
              </div>
              <input
                type="text"
                className="search-order-input"
                placeholder="Cari No. Order (misal: SPN-001)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {filteredOrders.length === 0 ? (
              <div className="empty-state-card">
                <span className="empty-icon">🔍</span>
                <h3>Tidak ada pesanan ditemukan</h3>
                <p>Pastikan nomor order atau kata kunci pencarian kamu sudah sesuai.</p>
              </div>
            ) : (
              <div className="orders-list-grid">
                {filteredOrders.map((order) => (
                  <div key={order.id} className="order-history-card">
                    <div className="history-top">
                      <div>
                        <strong>#{order.order_number}</strong>
                        <span className="history-date">{date(order.created_at)}</span>
                      </div>
                      <div className="history-badges">
                        <span className={`status-pill-modern ${order.status}`}>
                          {statusLabel[order.status] || order.status}
                        </span>
                        <span className={`status-pill-payment ${paymentStatusLabel[order.payment_status]?.color || ""}`}>
                          {paymentStatusLabel[order.payment_status]?.label || order.payment_status}
                        </span>
                      </div>
                    </div>

                    <div className="history-middle">
                      <div>
                        <small className="history-label">Tujuan Pengiriman</small>
                        <span className="history-value">
                          📍 {order.shipping_address?.city || "Kota Utama"}
                        </span>
                      </div>
                      <div>
                        <small className="history-label">Total Belanja</small>
                        <span className="history-price">{money(order.total)}</span>
                      </div>
                    </div>

                    <div className="history-bottom">
                      <button className="secondary-button" onClick={() => setSelectedOrderForDetail(order)} style={{ padding: "6px 12px", fontSize: "12px", minHeight: "auto" }}>
                        🔍 Detail
                      </button>
                      {order.status === "completed" && (
                        <button
                          className="secondary-button"
                          style={{ borderColor: "#b47c42", color: "#6f4932", padding: "6px 12px", fontSize: "12px", minHeight: "auto" }}
                          onClick={() => setSelectedOrderForFeedback(order)}
                        >
                          💬 Beri Masukan
                        </button>
                      )}
                      {order.payment_status === "unpaid" && (
                        <button className="primary-button" onClick={() => setSelectedOrderForPay(order)} style={{ padding: "6px 12px", fontSize: "12px", minHeight: "auto" }}>
                          💳 Bayar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: PROFIL & INFORMASI AKUN */}
        {activeTab === "profile" && (
          <section className="customer-tab-content">
            <div className="section-title-box">
              <h2>👤 Profil & Informasi Akun</h2>
              <p>Data pribadi terdaftar untuk pengiriman pesanan kamu</p>
            </div>

            <div className="profile-grid-cards">
              <div className="profile-card">
                <h3>Informasi Pribadi</h3>
                <div className="profile-field-row">
                  <span className="field-label">Nama Lengkap</span>
                  <strong className="field-val">{data.name}</strong>
                </div>
                <div className="profile-field-row">
                  <span className="field-label">Email Terdaftar</span>
                  <strong className="field-val">{data.email}</strong>
                </div>
                <div className="profile-field-row">
                  <span className="field-label">Nomor WhatsApp</span>
                  <strong className="field-val">{data.phone || "Belum diisi"}</strong>
                </div>
                <div className="profile-field-row">
                  <span className="field-label">Status Akun</span>
                  <strong className="field-val" style={{ color: "#2e7d32" }}>✅ Customer Terverifikasi</strong>
                </div>
              </div>

              <div className="profile-card">
                <h3>Alamat Pengiriman Terbaru</h3>
                {data.orders.length > 0 && data.orders[0].shipping_address?.address_line ? (
                  <div>
                    <p style={{ color: "var(--ink)", fontSize: "14px", lineHeight: "1.6", margin: "0 0 10px" }}>
                      {data.orders[0].shipping_address.address_line}
                    </p>
                    <span className="delivery-tag">
                      📍 {data.orders[0].shipping_address.city}
                    </span>
                  </div>
                ) : (
                  <p style={{ color: "var(--muted)", fontSize: "13px" }}>
                    Alamat otomatis terisi saat kamu melakukan transaksi checkout.
                  </p>
                )}
                <div style={{ marginTop: "24px" }}>
                  <Link href="/" className="primary-button" style={{ display: "inline-flex" }}>
                    Mulai Belanja Lapis Legit <span>→</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* DETAIL MODAL */}
      {selectedOrderForDetail && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedOrderForDetail(null)}>
          <div className="order-detail-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedOrderForDetail(null)}>×</button>
            <p className="eyebrow">Rincian Lacak Pesanan</p>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "26px", margin: "6px 0 16px", color: "#6f4932" }}>
              Order #{selectedOrderForDetail.order_number}
            </h2>

            {/* Stepper Inside Modal */}
            <div className="stepper-horizontal" style={{ margin: "20px 0" }}>
              {getTimelineSteps(selectedOrderForDetail.status, selectedOrderForDetail.payment_status, selectedOrderForDetail.created_at).map((step) => (
                <div key={step.id} className={`step-item ${step.completed ? "done" : ""} ${step.active ? "current" : ""}`}>
                  <div className="step-bubble">{step.completed ? "✓" : step.icon}</div>
                  <span className="step-text">{step.title}</span>
                  <small className="step-subtext">{step.time}</small>
                </div>
              ))}
            </div>

            <div className="order-detail-meta">
              <div>
                <span>Waktu Transaksi</span>
                <strong>{date(selectedOrderForDetail.created_at)}</strong>
              </div>
              <div>
                <span>Status Pembayaran</span>
                <strong>{paymentStatusLabel[selectedOrderForDetail.payment_status]?.label || selectedOrderForDetail.payment_status}</strong>
              </div>
              {selectedOrderForDetail.desired_delivery_date && (
                <div>
                  <span>Estimasi Tanggal Kirim</span>
                  <strong>{new Date(selectedOrderForDetail.desired_delivery_date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong>
                </div>
              )}
              <div>
                <span>Alamat Pengiriman</span>
                <strong>
                  {selectedOrderForDetail.shipping_address?.address_line || "Alamat utama"} ({selectedOrderForDetail.shipping_address?.city || "Kota Utama"})
                </strong>
              </div>
              <div>
                <span>Catatan Pesanan</span>
                <strong>{selectedOrderForDetail.notes || "Tidak ada catatan tambahan"}</strong>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "14px", color: "var(--muted)" }}>Total Tagihan:</span>
              <strong style={{ fontFamily: "Georgia, serif", fontSize: "22px", color: "var(--brown)" }}>
                {money(selectedOrderForDetail.total)}
              </strong>
            </div>

            {selectedOrderForDetail.payment_status === "unpaid" && (
              <button
                className="primary-button full-button"
                style={{ marginTop: "20px" }}
                onClick={() => {
                  const orderToPay = selectedOrderForDetail;
                  setSelectedOrderForDetail(null);
                  setSelectedOrderForPay(orderToPay);
                }}
              >
                💳 Lanjut ke Payment Gateway ({money(selectedOrderForDetail.total)})
              </button>
            )}
          </div>
        </div>
      )}

      {/* PAYMENT GATEWAY MODAL */}
      {selectedOrderForPay && (
        <PaymentGatewayModal
          orderId={selectedOrderForPay.id}
          orderNumber={selectedOrderForPay.order_number}
          totalAmount={selectedOrderForPay.total}
          onClose={() => setSelectedOrderForPay(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* PRIVATE FEEDBACK MODAL */}
      {selectedOrderForFeedback && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedOrderForFeedback(null)}>
          <div className="order-detail-modal" role="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <button className="modal-close" onClick={() => setSelectedOrderForFeedback(null)}>×</button>
            <p className="eyebrow">Peningkatan Layanan</p>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "24px", margin: "6px 0 10px", color: "#6f4932" }}>
              Masukan Privat Pelanggan
            </h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 18px" }}>
              Masukan Anda untuk Order <strong>#{selectedOrderForFeedback.order_number}</strong> dikirim secara privat langsung ke manajemen Admin Sharenpan.
            </p>

            {feedbackSuccess ? (
              <div className="success-message" style={{ textAlign: "center", padding: "18px" }}>
                {feedbackSuccess}
              </div>
            ) : (
              <form
                className="stack-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!feedbackMessage.trim()) return;
                  setFeedbackLoading(true);
                  try {
                    const supabase = createClient();
                    const { data: { user } } = await supabase.auth.getUser();
                    await supabase.from("customer_feedback").insert({
                      order_id: selectedOrderForFeedback.id,
                      user_id: user?.id || null,
                      customer_name: data.name,
                      customer_email: data.email,
                      rating_score: feedbackRating,
                      message: feedbackMessage.trim(),
                    });
                    setFeedbackSuccess("Terima kasih! Masukan Anda telah terkirim secara privat ke Admin Sharenpan.");
                    setTimeout(() => {
                      setFeedbackSuccess("");
                      setSelectedOrderForFeedback(null);
                      setFeedbackMessage("");
                    }, 2200);
                  } catch {
                    //
                  } finally {
                    setFeedbackLoading(false);
                  }
                }}
              >
                <label>
                  Tingkat Kepuasan (Internal)
                  <div style={{ display: "flex", gap: "8px", margin: "6px 0" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        style={{
                          border: "1px solid #e2d5c5",
                          borderRadius: "8px",
                          background: feedbackRating >= star ? "#fffbf2" : "#ffffff",
                          color: feedbackRating >= star ? "#bd7f35" : "#ccc",
                          fontSize: "20px",
                          padding: "6px 12px",
                          cursor: "pointer",
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </label>

                <label>
                  Kritik, Saran, Rasa Kue & Pengiriman
                  <textarea
                    rows={4}
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    required
                    placeholder="Tuliskan pendapat Anda mengenai rasa kue lapis legit, kerapian kemasan, atau pelayanan kami..."
                  />
                </label>

                <button className="primary-button full-button" disabled={feedbackLoading}>
                  {feedbackLoading ? "Mengirim..." : "Kirim Masukan Privat ke Admin"} <span>→</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
