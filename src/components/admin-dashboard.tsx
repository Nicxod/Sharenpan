"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Product = { id: string; name: string; slug: string; price: number; stock: number; status: string; image_url: string | null; created_at: string };
type Order = { id: string; order_number: string; customer_name: string; customer_email: string | null; customer_phone: string; total: number; status: string; payment_status: string; payment_receipt_url: string | null; created_at: string };
type OrderItem = { product_id: string | null; product_name: string; quantity: number; subtotal: number };
type Customer = { id: string; full_name: string | null; phone: string | null; role: string; created_at: string };
type FeedbackItem = { id: string; order_id: string | null; customer_name: string; customer_email: string | null; rating_score: number; message: string; created_at: string };
export type AdminData = { adminName: string; products: Product[]; orders: Order[]; orderItems: OrderItem[]; customers: Customer[]; feedbacks?: FeedbackItem[] };

type Section = "overview" | "orders" | "products" | "customers" | "feedback" | "reports" | "settings";
type OrderChanges = { status?: string; payment_status?: string };

const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const date = (value: string) => new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const statusLabels: Record<string, string> = { pending: "Menunggu", confirmed: "Dikonfirmasi", processing: "Diproses", shipped: "Dikirim", completed: "Selesai", cancelled: "Dibatalkan" };
const paymentLabels: Record<string, string> = { unpaid: "Belum dibayar", pending: "Menunggu", pending_verification: "Verifikasi Bukti", paid: "Dibayar", failed: "Gagal", refunded: "Dikembalikan" };
const navItems: Array<[Section, string, string]> = [["overview", "Overview", "▦"], ["orders", "Pesanan", "▤"], ["products", "Produk", "◫"], ["customers", "Pelanggan", "♙"], ["feedback", "Feedback", "💬"], ["reports", "Laporan", "◌"]];


export default function AdminDashboard({ initialData }: { initialData: AdminData }) {
  const [data, setData] = useState(initialData);
  const [section, setSection] = useState<Section>("overview");
  const [productForm, setProductForm] = useState({ name: "", price: "", stock: "", description: "", image: null as File | null });
  const [imagePreview, setImagePreview] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [customerSearch, setCustomerSearch] = useState("");
  const [reportRange, setReportRange] = useState<7 | 30 | 0>(7);

  const paidOrders = useMemo(() => data.orders.filter((order) => order.payment_status === "paid"), [data.orders]);
  const revenue = useMemo(() => paidOrders.reduce((total, order) => total + order.total, 0), [paidOrders]);
  const pending = data.orders.filter((order) => ["pending", "confirmed", "processing"].includes(order.status)).length;
  const todayOrders = data.orders.filter((order) => new Date(order.created_at).toDateString() === new Date().toDateString()).length;
  const activeProducts = data.products.filter((product) => product.status === "active").length;

  const chartData = useMemo(() => {
    const earliestPaidOrder = paidOrders.reduce<number | null>((earliest, order) => {
      const timestamp = new Date(order.created_at).getTime();
      return earliest === null ? timestamp : Math.min(earliest, timestamp);
    }, null);
    const days = reportRange || Math.max(7, earliestPaidOrder ? Math.ceil((new Date().getTime() - earliestPaidOrder) / 86400000) + 1 : 7);
    const result = Array.from({ length: days }, (_, index) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - (days - 1 - index));
      return { label: day.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }), value: 0 };
    });
    paidOrders.forEach((order) => {
      const orderDay = new Date(order.created_at);
      orderDay.setHours(0, 0, 0, 0);
      const match = result.find((item) => item.label === orderDay.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }));
      if (match) match.value += order.total;
    });
    return result;
  }, [paidOrders, reportRange]);

  const chartMax = Math.max(...chartData.map((item) => item.value), 1);
  const chartPoints = chartData.map((item, index) => `${(index / Math.max(chartData.length - 1, 1)) * 100},${145 - (item.value / chartMax) * 120}`).join(" ");
  const topProducts = useMemo(() => {
    const totals = new Map<string, number>();
    data.orderItems.forEach((item) => totals.set(item.product_name, (totals.get(item.product_name) || 0) + item.quantity));
    return data.products.map((product) => ({ ...product, sold: totals.get(product.name) || 0 })).sort((a, b) => b.sold - a.sold).slice(0, 4);
  }, [data.orderItems, data.products]);
  const filteredOrders = data.orders.filter((order) => orderFilter === "all" || order.status === orderFilter);
  const filteredCustomers = data.customers.filter((customer) => customer.role !== "admin" && `${customer.full_name || ""} ${customer.phone || ""}`.toLowerCase().includes(customerSearch.toLowerCase()));

  function goTo(next: Section) { setSection(next); setNotice(""); }
  function notify(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 3500); }

  async function addProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (productForm.image && !productForm.image.type.startsWith("image/")) { notify("File harus berupa gambar."); return; }
    if (productForm.image && productForm.image.size > 5 * 1024 * 1024) { notify("Ukuran foto maksimal 5 MB."); return; }
    const slug = productForm.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const supabase = createClient();
    let imagePath = "";
    let imageUrl: string | null = null;
    if (productForm.image) {
      const extension = productForm.image.name.split(".").pop()?.toLowerCase() || "jpg";
      imagePath = `products/${slug}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(imagePath, productForm.image, { cacheControl: "3600", upsert: false });
      if (uploadError) { notify(`Foto belum bisa diupload: ${uploadError.message}`); return; }
      imageUrl = supabase.storage.from("product-images").getPublicUrl(imagePath).data.publicUrl;
    }
    const { data: product, error } = await supabase.from("products").insert({ name: productForm.name.trim(), slug, description: productForm.description.trim(), price: Number(productForm.price), stock: Number(productForm.stock), status: "active", image_url: imageUrl }).select("id, name, slug, price, stock, status, image_url, created_at").single();
    if (error || !product) notify(error?.message || "Produk belum berhasil disimpan.");
    else { setData((current) => ({ ...current, products: [product, ...current.products] })); setProductForm({ name: "", price: "", stock: "", description: "", image: null }); setImagePreview(""); setShowProductForm(false); notify("Produk berhasil ditambahkan."); }
    if ((error || !product) && imagePath) await supabase.storage.from("product-images").remove([imagePath]);
  }

  async function updateProduct(id: string, changes: { stock?: number; status?: string }) {
    const { error } = await createClient().from("products").update(changes).eq("id", id);
    if (error) notify(error.message);
    else { setData((current) => ({ ...current, products: current.products.map((item) => item.id === id ? { ...item, ...changes } : item) })); notify("Produk berhasil diperbarui."); }
  }

  async function deleteProduct(id: string, name: string) {
    if (!window.confirm(`Hapus produk ${name}?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      // Fallback ke soft delete (status = 'archived') jika hard delete terhalang FK constraint / RLS
      const { error: softError } = await supabase.from("products").update({ status: "archived" }).eq("id", id);
      if (softError) {
        alert(`Gagal menghapus produk '${name}': ${error.message || softError.message}`);
        notify(`Gagal menghapus: ${error.message || softError.message}`);
      } else {
        setData((current) => ({ ...current, products: current.products.filter((item) => item.id !== id) }));
        notify("Produk berhasil diarsipkan dan disembunyikan dari katalog.");
      }
    } else {
      setData((current) => ({ ...current, products: current.products.filter((item) => item.id !== id) }));
      notify("Produk berhasil dihapus dari database.");
    }
  }

  async function updateOrder(id: string, changes: OrderChanges) {
    const { error } = await createClient().from("orders").update(changes).eq("id", id);
    if (error) notify(error.message);
    else { setData((current) => ({ ...current, orders: current.orders.map((item) => item.id === id ? { ...item, ...changes } : item) })); notify("Pesanan berhasil diperbarui."); }
  }

  async function signOut() { await createClient().auth.signOut(); window.location.href = "/"; }

  const pageTitle = section === "overview" ? `Selamat datang, ${initialData.adminName}` : navItems.find((item) => item[0] === section)?.[1] || "Pengaturan";
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <div className="admin-brand"><img src="/assets/logo.png" alt="Sharenpan Logo" className="brand-logo-img" style={{ width: "32px", height: "32px" }} /><span>sharenpan<small>admin workspace</small></span></div>
      <p className="admin-nav-label">Main menu</p>
      <nav>{navItems.map(([key, label, icon]) => <button key={key} className={section === key ? "selected" : ""} onClick={() => goTo(key)}><span>{icon}</span>{label}{key === "orders" && pending > 0 && <b>{pending}</b>}</button>)}</nav>
      <p className="admin-nav-label">Lainnya</p>
      <button className={section === "settings" ? "selected" : ""} onClick={() => goTo("settings")}><span>⚙</span>Pengaturan</button>
      <button className="back-store" onClick={() => window.location.href = "/"}>← Kembali ke toko</button>
    </aside>
    <main className="admin-main">
      <header className="admin-header"><div><p className="eyebrow">{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p><h1>{pageTitle}</h1></div><button className="admin-user" onClick={signOut}><span>AD</span><strong>{initialData.adminName}<small>Administrator · Keluar</small></strong>⌄</button></header>
      {notice && <div className="admin-notice">{notice}<button onClick={() => setNotice("")}>×</button></div>}

      {section === "overview" && <Overview revenue={revenue} todayOrders={todayOrders} customers={data.customers.filter((customer) => customer.role !== "admin").length} activeProducts={activeProducts} pending={pending} chartData={chartData} chartPoints={chartPoints} chartMax={chartMax} reportRange={reportRange} setReportRange={setReportRange} topProducts={topProducts} orders={data.orders.slice(0, 5)} onOrders={() => goTo("orders")} onProducts={() => goTo("products")} onUpdateOrder={updateOrder} />}
      {section === "orders" && <section className="admin-panel full-panel"><div className="panel-heading"><div><h2>Pesanan</h2><p>Kelola status pengiriman dan pembayaran customer</p></div><select className="filter-select" value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}><option value="all">Semua status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><OrderTable orders={filteredOrders} onUpdate={updateOrder} /></section>}
      {section === "products" && <ProductsSection products={data.products} productForm={productForm} setProductForm={setProductForm} imagePreview={imagePreview} setImagePreview={setImagePreview} showProductForm={showProductForm} setShowProductForm={setShowProductForm} onAdd={addProduct} onUpdate={updateProduct} onDelete={deleteProduct} />}
      {section === "customers" && <section className="admin-panel full-panel"><div className="panel-heading"><div><h2>Pelanggan</h2><p>{filteredCustomers.length} customer terdaftar di Sharenpan</p></div><input className="panel-search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Cari nama atau telepon" /></div><div className="customer-grid">{filteredCustomers.map((customer) => <div className="customer-card" key={customer.id}><span>{(customer.full_name || "C").slice(0, 1).toUpperCase()}</span><div><strong>{customer.full_name || "Customer"}</strong><small>{customer.phone || "Nomor belum diisi"}</small><small>Bergabung {date(customer.created_at)}</small></div></div>)}{filteredCustomers.length === 0 && <div className="empty-table">Belum ada customer yang cocok.</div>}</div></section>}
      {section === "feedback" && (
        <section className="admin-panel full-panel">
          <div className="panel-heading">
            <div>
              <h2>Feedback & Masukan Pelanggan (Privat)</h2>
              <p>Hanya dapat dibaca oleh Admin untuk meningkatkan mutu pelayanan & rasa kue</p>
            </div>
          </div>
          <div className="customer-grid">
            {(data.feedbacks && data.feedbacks.length > 0) ? (
              data.feedbacks.map((fb) => (
                <div className="customer-card" key={fb.id} style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                    <strong style={{ fontSize: "14px", fontFamily: "Georgia, serif" }}>{fb.customer_name}</strong>
                    <span style={{ color: "#bd7f35", fontSize: "12px" }}>{"★".repeat(fb.rating_score)}</span>
                  </div>
                  <small style={{ color: "#928072" }}>{fb.customer_email || "Email tidak terdaftar"} • {date(fb.created_at)}</small>
                  <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#33251d", background: "#fcf9f5", padding: "10px", borderRadius: "8px", width: "100%", border: "1px solid #efe4d7" }}>
                    &quot;{fb.message}&quot;
                  </p>
                </div>
              ))
            ) : (
              <div className="empty-table" style={{ gridColumn: "1 / -1" }}>Belum ada feedback dari pelanggan saat ini.</div>
            )}
          </div>
        </section>
      )}
      {section === "reports" && <ReportsSection orders={data.orders} chartData={chartData} chartPoints={chartPoints} chartMax={chartMax} reportRange={reportRange} setReportRange={setReportRange} revenue={revenue} onUpdateOrder={updateOrder} />}
      {section === "settings" && <section className="admin-panel full-panel"><div className="panel-heading"><div><h2>Pengaturan</h2><p>Informasi akses dan operasional toko</p></div></div><div className="settings-list"><div><strong>Role akun</strong><span>Administrator — akses penuh dashboard</span></div><div><strong>Database</strong><span>Supabase dengan Row Level Security aktif</span></div><div><strong>Alur order</strong><span>Customer login sebelum checkout · Admin mengelola status pesanan</span></div><div><strong>Status pembayaran</strong><span>Update manual tersedia sampai payment gateway dihubungkan</span></div></div></section>}
    </main>
  </div>;
}

function Overview({ revenue, todayOrders, customers, activeProducts, pending, chartData, chartPoints, chartMax, reportRange, setReportRange, topProducts, orders, onOrders, onProducts, onUpdateOrder }: { revenue: number; todayOrders: number; customers: number; activeProducts: number; pending: number; chartData: Array<{ label: string; value: number }>; chartPoints: string; chartMax: number; reportRange: 7 | 30 | 0; setReportRange: (value: 7 | 30 | 0) => void; topProducts: Array<Product & { sold: number }>; orders: Order[]; onOrders: () => void; onProducts: () => void; onUpdateOrder: (id: string, changes: OrderChanges) => void }) {
  return <><div className="admin-stats"><Stat label="Total penjualan" value={money(revenue)} note="Order dengan pembayaran lunas" icon="↗" tone="gold" /><Stat label="Pesanan hari ini" value={String(todayOrders)} note={`${pending} menunggu diproses`} icon="▤" tone="blue" /><Stat label="Customer baru" value={String(customers)} note="Akun customer terdaftar" icon="♙" tone="green" /><Stat label="Produk aktif" value={String(activeProducts)} note="Siap dijual di storefront" icon="★" tone="rose" /></div><div className="admin-panels"><section className="admin-panel sales-panel"><div className="panel-heading"><div><h2>Ringkasan penjualan</h2><p>Performa pembayaran yang berhasil</p></div><select className="filter-select" value={reportRange} onChange={(event) => setReportRange(Number(event.target.value) as 7 | 30 | 0)}><option value="7">7 hari terakhir</option><option value="30">30 hari terakhir</option><option value="0">Semua data</option></select></div><SalesChart data={chartData} points={chartPoints} max={chartMax} /></section><section className="admin-panel top-products-panel"><div className="panel-heading"><div><h2>Produk terlaris</h2><p>Berdasarkan item pesanan</p></div><button onClick={onProducts}>Lihat semua</button></div>{topProducts.length === 0 ? <div className="empty-table">Belum ada data produk.</div> : topProducts.map((product) => <div className="top-product" key={product.id}><span className="top-product-image">{product.image_url ? <img src={product.image_url} alt="" /> : "S"}</span><div><strong>{product.name}</strong><small>{product.sold} terjual · {product.stock} stok</small></div><b>{money(product.price)}</b></div>)}</section></div><section className="admin-panel recent-orders-panel"><div className="panel-heading"><div><h2>Pesanan terbaru</h2><p>Update real-time dari database</p></div><button onClick={onOrders}>Lihat semua →</button></div><OrderTable orders={orders} onUpdate={onUpdateOrder} /></section></>;
}

function SalesChart({ data, points, max }: { data: Array<{ label: string; value: number }>; points: string; max: number }) { return <div className="sales-chart"><div className="chart-axis"><span>{money(max)}</span><span>{money(max / 2)}</span><span>Rp0</span></div><svg viewBox="0 0 100 160" preserveAspectRatio="none" role="img" aria-label="Grafik penjualan"><defs><linearGradient id="sales-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#d9a05c" stopOpacity=".4" /><stop offset="100%" stopColor="#d9a05c" stopOpacity=".03" /></linearGradient></defs><polygon points={`0,150 ${points} 100,150`} fill="url(#sales-fill)" /><polyline points={points} fill="none" stroke="#c98632" strokeWidth="1.3" vectorEffect="non-scaling-stroke" /></svg><div className="chart-labels">{data.map((item) => <span key={item.label}>{item.label}</span>)}</div></div>; }

function ProductsSection({ products, productForm, setProductForm, imagePreview, setImagePreview, showProductForm, setShowProductForm, onAdd, onUpdate, onDelete }: { products: Product[]; productForm: { name: string; price: string; stock: string; description: string; image: File | null }; setProductForm: (value: { name: string; price: string; stock: string; description: string; image: File | null }) => void; imagePreview: string; setImagePreview: (value: string) => void; showProductForm: boolean; setShowProductForm: (value: boolean) => void; onAdd: (event: React.FormEvent<HTMLFormElement>) => void; onUpdate: (id: string, changes: { stock?: number; status?: string }) => void; onDelete: (id: string, name: string) => void }) { return <section className="admin-panel full-panel"><div className="panel-heading"><div><h2>Produk</h2><p>Tambah, ubah stok, status, foto, dan hapus katalog</p></div><button className="dark-small-button" onClick={() => setShowProductForm(!showProductForm)}>+ Tambah produk</button></div>{showProductForm && <form className="product-form" onSubmit={onAdd}><div className="product-image-picker"><div className="product-image-preview">{imagePreview ? <img src={imagePreview} alt="Preview foto produk" /> : <span>Foto<br />produk</span>}</div><label className="image-upload-label">Pilih foto produk<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0] || null; setProductForm({ ...productForm, image: file }); setImagePreview(file ? URL.createObjectURL(file) : ""); }} /><small>{productForm.image ? productForm.image.name : "PNG, JPG, WEBP · maksimal 5 MB"}</small></label></div><div className="product-form-fields"><label>Nama produk<input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} required /></label><label>Harga<input type="number" min="0" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} required /></label><label>Stok<input type="number" min="0" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} required /></label><label>Deskripsi<input value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></label><button className="dark-small-button">Simpan produk</button></div></form>}<div className="admin-product-list">{products.map((product) => <div className="admin-product-row" key={product.id}><span className="admin-product-thumb">{product.image_url ? <img src={product.image_url} alt="" /> : "S"}</span><div><strong>{product.name}</strong><small>{product.slug}</small></div><b>{money(product.price)}</b><label className="inline-stock"><span>Stok</span><input type="number" min="0" value={product.stock} onChange={(event) => onUpdate(product.id, { stock: Number(event.target.value) })} /></label><select className="product-status" value={product.status} onChange={(event) => onUpdate(product.id, { status: event.target.value })}><option value="active">Aktif</option><option value="draft">Draft</option><option value="archived">Arsip</option></select><button className="delete-product" onClick={() => onDelete(product.id, product.name)}>Hapus</button></div>)}</div></section>; }

function ReportsSection({ orders, chartData, chartPoints, chartMax, reportRange, setReportRange, revenue, onUpdateOrder }: { orders: Order[]; chartData: Array<{ label: string; value: number }>; chartPoints: string; chartMax: number; reportRange: 7 | 30 | 0; setReportRange: (value: 7 | 30 | 0) => void; revenue: number; onUpdateOrder: (id: string, changes: OrderChanges) => void }) { return <section className="admin-panel full-panel"><div className="panel-heading"><div><h2>Laporan penjualan</h2><p>Ringkasan transaksi dan performa penjualan</p></div><select className="filter-select" value={reportRange} onChange={(event) => setReportRange(Number(event.target.value) as 7 | 30 | 0)}><option value="7">7 hari terakhir</option><option value="30">30 hari terakhir</option><option value="0">Semua data</option></select></div><div className="report-cards"><div><span>Transaksi dibayar</span><strong>{orders.filter((order) => order.payment_status === "paid").length}</strong></div><div><span>Nilai penjualan</span><strong>{money(revenue)}</strong></div><div><span>Rata-rata order</span><strong>{money(orders.length ? Math.round(revenue / Math.max(orders.filter((order) => order.payment_status === "paid").length, 1)) : 0)}</strong></div></div><SalesChart data={chartData} points={chartPoints} max={chartMax} /><div className="report-table"><h3>Rincian order</h3><OrderTable orders={orders} onUpdate={onUpdateOrder} /></div></section>; }

function Stat({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: string; tone: string }) { return <div className="stat-card"><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div><i className={`stat-icon ${tone}`}>{icon}</i></div>; }

function OrderTable({ orders, onUpdate }: { orders: Order[]; onUpdate: (id: string, changes: OrderChanges) => void }) {
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  
  return (
    <div className="order-table">
      {orders.length === 0 ? <div className="empty-table">Belum ada pesanan tercatat.</div> : (
        <>
          <div className="order-table-head"><span>Invoice</span><span>Customer</span><span>Total</span><span>Status order</span><span>Pembayaran</span></div>
          {orders.map((order) => (
            <div className="order-table-row" key={order.id}>
              <span><strong>#{order.order_number}</strong><small>{date(order.created_at)}</small></span>
              <span>{order.customer_name}<small>{order.customer_phone}</small></span>
              <span>{money(order.total)}</span>
              <select value={order.status} onChange={(event) => onUpdate(order.id, { status: event.target.value })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                <select value={order.payment_status} onChange={(event) => onUpdate(order.id, { payment_status: event.target.value })}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                {order.payment_status === "pending_verification" && order.payment_receipt_url && (
                  <button onClick={() => setReviewOrder(order)} style={{ background: "#4caf50", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>Cek Bukti</button>
                )}
              </div>
            </div>
          ))}
        </>
      )}
      {reviewOrder && (
        <div className="modal-backdrop" onClick={() => setReviewOrder(null)}>
          <div className="payment-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "450px" }}>
            <div className="payment-modal-header" style={{ paddingBottom: "12px", borderBottom: "1px solid var(--line)", marginBottom: "16px" }}>
              <h2>Bukti Pembayaran #{reviewOrder.order_number}</h2>
              <p>Total tagihan: <strong>{money(reviewOrder.total)}</strong></p>
            </div>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              {reviewOrder.payment_receipt_url ? (
                <a href={reviewOrder.payment_receipt_url} target="_blank" rel="noreferrer">
                  <img src={reviewOrder.payment_receipt_url} alt="Bukti Transfer" style={{ maxWidth: "100%", maxHeight: "350px", border: "1px solid var(--line)", borderRadius: "8px" }} />
                </a>
              ) : (
                <p>Tidak ada foto bukti.</p>
              )}
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button style={{ padding: "8px 16px", background: "#fef1f2", color: "#c13515", border: "1px solid #fcd4d7", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }} onClick={() => { onUpdate(reviewOrder.id, { payment_status: "failed" }); setReviewOrder(null); }}>Tolak (Tidak Valid)</button>
              <button style={{ padding: "8px 16px", background: "#4caf50", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }} onClick={() => { onUpdate(reviewOrder.id, { payment_status: "paid", status: "confirmed" }); setReviewOrder(null); }}>Terima (Valid)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
