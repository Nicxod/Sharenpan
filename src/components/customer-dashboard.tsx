"use client";

import { useState, useEffect } from "react";
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
  shipping_address?: { address_line?: string; city?: string };
  notes?: string;
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
  pending: "Menunggu Pembayaran",
  confirmed: "Pesanan Dikonfirmasi",
  processing: "Sedang Dipanggang/Diproses",
  shipped: "Dalam Pengiriman",
  completed: "Pesanan Selesai",
  cancelled: "Dibatalkan",
};

const paymentStatusLabel: Record<string, { label: string; color: string }> = {
  unpaid: { label: "Belum Dibayar", color: "bg-amber-100 text-amber-900 border-amber-300" },
  pending: { label: "Menunggu Verifikasi", color: "bg-amber-100 text-amber-900 border-amber-300" },
  paid: { label: "Lunas", color: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  failed: { label: "Gagal", color: "bg-rose-100 text-rose-900 border-rose-300" },
  refunded: { label: "Dikembalikan", color: "bg-gray-100 text-gray-800 border-gray-300" },
};

// 5-Step Order Timeline calculation
function getTimelineSteps(status: string, paymentStatus: string, createdAt: string) {
  const isPaid = paymentStatus === "paid";
  const isConfirmed = status !== "pending" || isPaid;
  const isProcessing = ["processing", "shipped", "completed"].includes(status);
  const isShipped = ["shipped", "completed"].includes(status);
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";

  const formattedDate = new Date(createdAt).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });

  return [
    {
      id: 1,
      title: "Pesanan Dibuat",
      icon: "📝",
      completed: true,
      active: status === "pending" && !isPaid,
      time: formattedDate,
    },
    {
      id: 2,
      title: "Pembayaran Diterima",
      icon: "💳",
      completed: isPaid || isConfirmed,
      active: isConfirmed && !isProcessing && status !== "pending",
      time: isPaid || isConfirmed ? "Terkonfirmasi" : "Menunggu",
    },
    {
      id: 3,
      title: "Dipanggang & Diproses",
      icon: "🧑‍🍳",
      completed: isProcessing,
      active: status === "processing",
      time: isProcessing ? "Dapur Fresh" : "Antrean",
    },
    {
      id: 4,
      title: "Dalam Pengiriman",
      icon: "🚚",
      completed: isShipped,
      active: status === "shipped",
      time: isShipped ? "SiCepat Express" : "Kurir",
    },
    {
      id: 5,
      title: "Pesanan Selesai",
      icon: "🎉",
      completed: isCompleted,
      active: isCompleted,
      time: isCompleted ? "Tiba di tujuan" : "Estimasi Tiba",
    },
  ];
}

export default function CustomerDashboard({ initialData }: { initialData: CustomerData }) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [selectedOrderForPay, setSelectedOrderForPay] = useState<CustomerOrder | null>(null);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<CustomerOrder | null>(null);
  const [selectedOrderForFeedback, setSelectedOrderForFeedback] = useState<CustomerOrder | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "profile" || tabParam === "orders" || tabParam === "overview") {
        setActiveTab(tabParam as TabType);
      }
    }
  }, []);

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
      .select("id, order_number, total, subtotal, shipping_fee, status, payment_status, shipping_address, notes, created_at")
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
  const filteredOrders = data.orders.filter((order) =>
    order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    statusLabel[order.status]?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="customer-shell">
      <header className="navbar">
        <Link className="brand" href="/">
          <span className="brand-mark">S</span>
          <span>
            sharenpan
            <small>lapis legit premium</small>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Navigasi utama">
          <Link href="/">Home</Link>
          <Link href="/#produk">Produk</Link>
          <Link href="/#cerita">Tentang kami</Link>
          <Link href="/#cara-order">Cara order</Link>
          <button
            className="nav-pesanan-highlight active-nav"
            onClick={() => setActiveTab("overview")}
          >
            📦 Pesanan
          </button>
        </nav>
        <div className="nav-actions">
          <button
            className={`account-button ${activeTab === "profile" ? "active-profile" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            👤 Profil Saya
          </button>
          <Link href="/" className="cart-button" title="Kembali ke toko">
            Ke Toko 🛍️
          </Link>
          <button className="logout-button" onClick={signOut}>
            Keluar
          </button>
        </div>
      </header>

      <main className="customer-main">
        {/* Welcome Section */}
        <div className="customer-welcome">
          <div>
            <p className="eyebrow">Dashboard Pelanggan</p>
            <h1>Selamat Datang, {data.name}.</h1>
            <p>Pantau proses pesanan lapis legit fresh Anda dalam satu tempat.</p>
          </div>
          <span className="customer-avatar">{data.name.slice(0, 1).toUpperCase()}</span>
        </div>

        {/* Quick Summary Cards */}
        <div className="customer-summary">
          <div>
            <span>Total Pesanan</span>
            <strong>{data.orders.length}</strong>
            <small>Riwayat Transaksi</small>
          </div>
          <div>
            <span>Pesanan Sedang Diproses</span>
            <strong>{activeOrders.length}</strong>
            <small>Dipanggang & Dikirim</small>
          </div>
          <div>
            <span>Total Belanja</span>
            <strong>{money(data.orders.reduce((total, order) => total + order.total, 0))}</strong>
            <small>Akumulasi Pembelian</small>
          </div>
        </div>

        {/* Tab Switcher Navigation */}
        <nav className="customer-nav-tabs" aria-label="Menu Customer">
          <button
            className={`customer-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            🔥 Status Pesanan Aktif {activeOrders.length > 0 && <b>{activeOrders.length}</b>}
          </button>
          <button
            className={`customer-tab-btn ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            📦 Riwayat & Lacak Pesanan
          </button>
          <button
            className={`customer-tab-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            👤 Informasi Akun
          </button>
        </nav>

        {/* TAB 1: OVERVIEW & PESANAN AKTIF */}
        {activeTab === "overview" && (
          <section className="tab-section">
            <div className="customer-panel-heading">
              <div>
                <h2>Lacak Proses Pesanan Aktif</h2>
                <p>Status pengerjaan & pengiriman kue lapis legit Anda real-time</p>
              </div>
            </div>

            {activeOrders.length === 0 ? (
              <div className="customer-panel customer-empty">
                🎉 Belum ada pesanan aktif saat ini.<br />
                <small style={{ color: "#8a7566", display: "block", margin: "8px 0 16px" }}>
                  Setiap pesanan lapis legit dipanggang fresh khusus untuk Anda.
                </small>
                <Link href="/" className="primary-button" style={{ display: "inline-flex", minHeight: "40px", fontSize: "12px" }}>
                  Pesan Lapis Legit Sekarang →
                </Link>
              </div>
            ) : (
              activeOrders.map((order) => {
                const steps = getTimelineSteps(order.status, order.payment_status, order.created_at);
                const isUnpaid = order.payment_status === "unpaid";

                return (
                  <div key={order.id} className="active-tracker-card">
                    <div className="tracker-card-header">
                      <div>
                        <h3>No. Order: #{order.order_number}</h3>
                        <small>Dipesan pada {date(order.created_at)}</small>
                      </div>
                      <div className="tracker-total-badge">
                        <strong>{money(order.total)}</strong>
                        <span className={`customer-status ${paymentStatusLabel[order.payment_status]?.color || ""}`}>
                          {paymentStatusLabel[order.payment_status]?.label || order.payment_status}
                        </span>
                      </div>
                    </div>

                    {/* 5-Step Order Timeline */}
                    <div className="order-timeline-stepper">
                      {steps.map((step) => (
                        <div
                          key={step.id}
                          className={`timeline-step-item ${step.completed ? "completed" : ""} ${step.active ? "active" : ""}`}
                        >
                          <div className="step-icon-circle">{step.completed ? "✓" : step.icon}</div>
                          <span className="step-label">{step.title}</span>
                          <span className="step-time">{step.time}</span>
                        </div>
                      ))}
                    </div>

                    <div className="tracker-footer-actions">
                      <button className="btn-detail-order" onClick={() => setSelectedOrderForDetail(order)}>
                        🔍 Lihat Detail & Alamat Pengiriman
                      </button>

                      {isUnpaid && (
                        <button className="btn-pay-now" onClick={() => setSelectedOrderForPay(order)}>
                          💳 Bayar Sekarang ({money(order.total)})
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}

        {/* TAB 2: SEMUA PESANAN & RIWAYAT */}
        {activeTab === "orders" && (
          <section className="tab-section">
            <div className="customer-panel full-panel">
              <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2>Semua Transaksi</h2>
                  <p>Lihat status dan riwayat seluruh pemesanan Anda</p>
                </div>
                <input
                  type="text"
                  className="panel-search"
                  placeholder="Cari No. Order..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {filteredOrders.length === 0 ? (
                <div className="empty-table">Tidak ada pesanan ditemukan.</div>
              ) : (
                <div className="customer-orders">
                  {filteredOrders.map((order) => (
                    <div className="customer-order" key={order.id} style={{ alignItems: "center" }}>
                      <div>
                        <strong>#{order.order_number}</strong>
                        <small>{date(order.created_at)}</small>
                        {order.shipping_address?.city && (
                          <small style={{ color: "#6f5b4d", marginTop: "2px" }}>
                            📍 Kirim ke {order.shipping_address.city}
                          </small>
                        )}
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <b>{money(order.total)}</b>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                          <span className={`customer-status ${order.status}`}>
                            {statusLabel[order.status] || order.status}
                          </span>
                          <span className={`customer-status ${paymentStatusLabel[order.payment_status]?.color || ""}`}>
                            {paymentStatusLabel[order.payment_status]?.label || order.payment_status}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button className="btn-detail-order" onClick={() => setSelectedOrderForDetail(order)}>
                          Lacak
                        </button>
                        {order.status === "completed" && (
                          <button className="btn-detail-order" style={{ borderColor: "#b47c42", color: "#6f4932" }} onClick={() => setSelectedOrderForFeedback(order)}>
                            💬 Feedback
                          </button>
                        )}
                        {order.payment_status === "unpaid" && (
                          <button className="btn-pay-now" onClick={() => setSelectedOrderForPay(order)}>
                            Bayar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 3: PROFIL & INFORMASI AKUN */}
        {activeTab === "profile" && (
          <section className="tab-section">
            <div className="customer-panel">
              <div className="customer-panel-heading">
                <div>
                  <h2>Informasi Profil Akun</h2>
                  <p>Data diri yang digunakan saat checkout pesanan</p>
                </div>
              </div>

              <div className="account-details">
                <div>
                  <span>Nama Lengkap</span>
                  <strong>{data.name}</strong>
                </div>
                <div>
                  <span>Email Terdaftar</span>
                  <strong>{data.email}</strong>
                </div>
                <div>
                  <span>Nomor Telepon</span>
                  <strong>{data.phone}</strong>
                </div>
                <div>
                  <span>Status Akun</span>
                  <strong style={{ color: "#2b7a48" }}>✓ Terverifikasi Customer Sharenpan</strong>
                </div>

                <Link href="/" className="primary-button" style={{ marginTop: "24px", width: "fit-content" }}>
                  Mulai Belanja Lapis Legit →
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ORDER DETAIL & TRACKING MODAL */}
      {selectedOrderForDetail && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedOrderForDetail(null)}>
          <div className="order-detail-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedOrderForDetail(null)}>×</button>
            <p className="eyebrow">Rincian Lacak Pesanan</p>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "26px", margin: "6px 0 16px" }}>
              Order #{selectedOrderForDetail.order_number}
            </h2>

            {/* Stepper Inside Modal */}
            <div className="order-timeline-stepper" style={{ margin: "20px 0" }}>
              {getTimelineSteps(selectedOrderForDetail.status, selectedOrderForDetail.payment_status, selectedOrderForDetail.created_at).map((step) => (
                <div key={step.id} className={`timeline-step-item ${step.completed ? "completed" : ""} ${step.active ? "active" : ""}`}>
                  <div className="step-icon-circle">{step.completed ? "✓" : step.icon}</div>
                  <span className="step-label">{step.title}</span>
                  <span className="step-time">{step.time}</span>
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
              <div>
                <span>Alamat Pengiriman</span>
                <strong>
                  {selectedOrderForDetail.shipping_address?.address_line || "Alamat standar"} ({selectedOrderForDetail.shipping_address?.city || "Kota Utama"})
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
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "24px", margin: "6px 0 10px" }}>
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
