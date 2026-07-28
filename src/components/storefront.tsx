"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import AuthModal from "@/components/auth-modal";
import PaymentGatewayModal from "@/components/payment-gateway-modal";

export type StorefrontProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string;
  tag: string;
  type: "classic" | "premium";
  rating: string;
  reviews: string;
};

export type StorefrontStatus = {
  kind: "connected" | "preview" | "empty" | "error";
  label: string;
  detail: string;
};

type CartItem = StorefrontProduct & { quantity: number };
type Filter = "all" | "best" | "classic" | "premium";

const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;

function StatusPill({ status }: { status: StorefrontStatus }) {
  const color =
    status.kind === "connected"
      ? "bg-emerald-100 text-emerald-800"
      : status.kind === "error"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-900";

  return (
    <div className={`status-pill ${color}`} title={status.detail}>
      <span className="status-dot" />
      {status.label}
    </div>
  );
}

export default function Storefront({
  products,
  databaseStatus,
}: {
  products: StorefrontProduct[];
  databaseStatus: StorefrontStatus;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkout, setCheckout] = useState({ name: "", phone: "", address: "", city: "", notes: "" });
  const [detailProduct, setDetailProduct] = useState<StorefrontProduct | null>(null);
  const [detailSize, setDetailSize] = useState<"full" | "half">("full");
  const [detailQty, setDetailQty] = useState(1);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id, email: data.user.email });
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const featured = products[0];
  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        if (filter === "all") return true;
        if (filter === "best") return product.tag === "Terlaris";
        return product.type === filter;
      }),
    [filter, products],
  );
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function addToCart(product: StorefrontProduct) {
    if (!user) {
      setAuthOpen(true);
      showToast("Masuk atau daftar dulu untuk memesan");
      return;
    }
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (found) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
    showToast(`${product.name} masuk ke keranjang`);
  }

  const [paymentGatewayOrder, setPaymentGatewayOrder] = useState<{ id: string; number: string; total: number } | null>(null);
  const [shippingOptions, setShippingOptions] = useState<Array<{ id: string; courierName: string; serviceName: string; description: string; cost: number; etd: string; isFree?: boolean }>>([]);
  const [selectedShipping, setSelectedShipping] = useState<{ id: string; courierName: string; serviceName: string; description: string; cost: number; etd: string; isFree?: boolean } | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);

  const cartWeight = cart.reduce((total, item) => total + item.quantity * 500, 0);

  async function calculateShipping(cityName: string) {
    if (!cityName.trim() || cityName.length < 3) return;
    setShippingLoading(true);
    try {
      const res = await fetch("/api/shipping/cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationCity: cityName,
          weightGram: cartWeight || 500,
          subtotal: cartTotal,
        }),
      });
      const data = await res.json();
      if (data.success && data.options && data.options.length > 0) {
        setShippingOptions(data.options);
        setSelectedShipping(data.options[0]);
      }
    } catch {
      // Fallback default
    } finally {
      setShippingLoading(false);
    }
  }

  const currentShippingCost = selectedShipping ? selectedShipping.cost : 0;
  const finalTotal = cartTotal + currentShippingCost;

  async function submitCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !cart.length) return;
    setCheckoutLoading(true);
    setCheckoutError("");
    const supabase = createClient();
    const { data: order, error } = await supabase.from("orders").insert({
      user_id: user.id,
      customer_name: checkout.name,
      customer_email: user.email,
      customer_phone: checkout.phone,
      shipping_address: {
        address_line: checkout.address,
        city: checkout.city,
        courier: selectedShipping ? selectedShipping.serviceName : "Pengiriman Standar",
        etd: selectedShipping ? selectedShipping.etd : "1-2 Hari",
      },
      notes: checkout.notes || null,
      subtotal: cartTotal,
      shipping_fee: currentShippingCost,
      total: finalTotal,
    }).select("id, order_number").single();
    if (error || !order) {
      setCheckoutError(error?.message || "Pesanan belum dapat dibuat.");
    } else {
      const { error: itemsError } = await supabase.from("order_items").insert(cart.map((item) => ({ order_id: order.id, product_id: item.id.startsWith("fallback-") ? null : item.id, product_name: item.name, unit_price: item.price, quantity: item.quantity, subtotal: item.price * item.quantity })));
      if (itemsError) setCheckoutError(itemsError.message);
      else {
        setCart([]);
        setCheckoutOpen(false);
        setPaymentGatewayOrder({ id: order.id, number: order.order_number, total: finalTotal });
        showToast(`Pesanan #${order.order_number} berhasil dibuat! Pilih pembayaran Anda.`);
      }
    }
    setCheckoutLoading(false);
  }

  function changeQuantity(id: string, amount: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? { ...item, quantity: item.quantity + amount }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  return (
    <div className="storefront-shell">
      <div className="topbar">
        <span>Gratis ongkir untuk pesanan di atas Rp500.000</span>
        <span className="topbar-separator">•</span>
        <span>Dibuat fresh berdasarkan pesanan</span>
        <StatusPill status={databaseStatus} />
      </div>

      <header className="navbar">
        <a className="brand" href="#home" aria-label="Sharenpan home">
          <span className="brand-mark">S</span>
          <span>
            sharenpan
            <small>lapis legit premium</small>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Navigasi utama">
          <a href="#home">Home</a>
          <a href="#produk">Produk</a>
          <a href="#cerita">Tentang kami</a>
          <a href="#cara-order">Cara order</a>
          {user && (
            <a href="/customer" className="nav-pesanan-highlight">
              📦 Pesanan
            </a>
          )}
        </nav>
        <div className="nav-actions">
          {user ? (
            <>
              <a className="account-button" href="/customer?tab=profile">
                👤 Profil Saya
              </a>
              <button className="cart-button" onClick={() => setCartOpen(true)}>
                Keranjang <b>{cartCount}</b>
              </button>
              <button
                className="logout-button"
                onClick={async () => {
                  await createClient().auth.signOut();
                  setUser(null);
                }}
              >
                Keluar
              </button>
            </>
          ) : (
            <>
              <button className="account-button" onClick={() => setAuthOpen(true)}>
                Masuk / Daftar
              </button>
              <button className="cart-button" onClick={() => setCartOpen(true)}>
                Keranjang <b>{cartCount}</b>
              </button>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="hero-section content-width" id="home">
          <div className="hero-copy">
            <p className="eyebrow">Rasa legit turun-temurun</p>
            <h1>
              Setiap lapis,
              <br />
              <em>punya cerita.</em>
            </h1>
            <p className="hero-description">
              Lapis legit premium yang dipanggang perlahan dengan butter
              pilihan—lembut, harum, dan dibuat fresh untuk momen yang berarti.
            </p>
            <div className="hero-price-row">
              <strong>{money(featured.price)}</strong>
              <span className="rating">★★★★★ <b>4.9</b></span>
            </div>
            <div className="hero-actions">
              <button
                className="primary-button"
                onClick={() => addToCart(featured)}
              >
                Pesan sekarang <span>→</span>
              </button>
              <a className="secondary-button" href="#produk">
                Lihat menu <span>↓</span>
              </a>
            </div>
            <div className="hero-proof">
              <div className="avatar-stack" aria-hidden="true">
                <i>R</i>
                <i>N</i>
                <i>A</i>
              </div>
              <span>
                <strong>1.200+ pelanggan puas</strong>
                <small>freshly baked since 2014</small>
              </span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-glow" />
            <div className="photo-frame">
              <img src={featured.imageUrl} alt={`${featured.name} Sharenpan`} />
            </div>
            <div className="floating-card butter-card">
              <span>✦</span>
              <small>made with</small>
              <strong>100% butter</strong>
            </div>
            <div className="floating-card freshness-card">
              <strong>24</strong>
              <small>hours</small>
              <b>freshness</b>
            </div>
            <span className="hero-note">
              dipanggang
              <br />
              <b>perlahan</b>
            </span>
          </div>
        </section>

        <section className="featured-section content-width" id="produk">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Best seller minggu ini</p>
              <h2>
                Yang bikin ingin
                <br />
                <em>tambah lagi.</em>
              </h2>
            </div>
            <span className="section-count">{products.length} pilihan rasa</span>
          </div>
          <div className="filter-row" role="tablist" aria-label="Filter produk">
            {(["all", "best", "classic", "premium"] as Filter[]).map(
              (item) => (
                <button
                  key={item}
                  className={filter === item ? "filter active" : "filter"}
                  onClick={() => setFilter(item)}
                >
                  {item === "all"
                    ? "Semua"
                    : item === "best"
                      ? "Terlaris"
                      : item === "classic"
                        ? "Classic"
                        : "Premium"}
                </button>
              ),
            )}
          </div>
          <div className="product-grid">
            {filteredProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-image" onClick={() => { setDetailProduct(product); setDetailSize("full"); setDetailQty(1); }} style={{ cursor: "pointer" }}>
                  <span className="product-tag">{product.tag}</span>
                  <img src={product.imageUrl} alt={product.name} />
                </div>
                <div className="product-info">
                  <div className="product-meta">
                    <span className="rating">★★★★★ <b>{product.rating}</b></span>
                    <small>Resep Tradisional Fresh</small>
                  </div>
                  <h3 onClick={() => { setDetailProduct(product); setDetailSize("full"); setDetailQty(1); }} style={{ cursor: "pointer" }}>
                    {product.name}
                  </h3>
                  <p>{product.description}</p>
                  <div className="product-footer">
                    <div>
                      <strong>{money(product.price)}</strong>
                      <small>{product.stock} stok tersedia</small>
                    </div>
                    <button
                      className="add-button"
                      onClick={() => { setDetailProduct(product); setDetailSize("full"); setDetailQty(1); }}
                      title="Lihat Detail & Pilih Ukuran"
                    >
                      +
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="trust-row content-width">
          <div>
            <strong>★★★★★</strong>
            <span>4.9 customer rating</span>
          </div>
          <div>
            <strong>2.500+</strong>
            <span>lapis legit terjual</span>
          </div>
          <div>
            <strong>100%</strong>
            <span>real butter</span>
          </div>
          <div>
            <strong>2014</strong>
            <span>dipercaya sejak</span>
          </div>
        </section>

        <section className="story-section content-width" id="cerita">
          <div className="story-image">
            <img src="/assets/lapis-legit.jpg" alt="Tekstur lapis legit Sharenpan" />
            <span className="story-card">
              EST.
              <strong>2014</strong>
            </span>
          </div>
          <div className="story-copy">
            <p className="eyebrow">Dibuat dengan sabar</p>
            <h2>
              Bukan sekadar kue,
              <br />
              ini <em>warisan rasa.</em>
            </h2>
            <p>
              Di Sharenpan, kami percaya hal-hal baik memang membutuhkan waktu.
              Setiap lapis dipanggang dengan api kecil dan perhatian penuh—
              menghasilkan tekstur lembut, aroma butter yang hangat, dan rasa
              yang tinggal lebih lama.
            </p>
            <a className="text-link" href="#cara-order">
              Kenali cara order <span>→</span>
            </a>
          </div>
        </section>

        <section className="order-banner content-width" id="cara-order">
          <div>
            <p className="eyebrow">Pesan untuk momen spesialmu</p>
            <h2>
              Freshly baked.
              <br />
              Thoughtfully made.
            </h2>
          </div>
          <div className="order-steps">
            <div>
              <b>01</b>
              <span>Pilih rasa favorit</span>
            </div>
            <div>
              <b>02</b>
              <span>Tentukan tanggal kirim</span>
            </div>
            <div>
              <b>03</b>
              <span>Nikmati setiap lapis</span>
            </div>
          </div>
        </section>
      </main>

      <aside className={cartOpen ? "cart-drawer open" : "cart-drawer"}>
        <div className="drawer-head">
          <div>
            <p className="eyebrow">Pesananmu</p>
            <h3>Keranjang</h3>
          </div>
          <button onClick={() => setCartOpen(false)} aria-label="Tutup keranjang">
            ×
          </button>
        </div>
        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="cart-empty">
              Keranjangmu masih kosong.
              <br />
              Yuk pilih rasa favoritmu.
            </div>
          ) : (
            cart.map((item) => (
              <div className="cart-line" key={item.id}>
                <img src={item.imageUrl} alt="" />
                <div>
                  <strong>{item.name}</strong>
                  <small>{money(item.price)}</small>
                  <div className="quantity-control">
                    <button onClick={() => changeQuantity(item.id, -1)}>−</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => changeQuantity(item.id, 1)}>+</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="cart-footer">
          <div>
            <span>Subtotal</span>
            <strong>{money(cartTotal)}</strong>
          </div>
          <button
            className="primary-button full-button"
            onClick={() => cart.length ? (user ? setCheckoutOpen(true) : setAuthOpen(true)) : showToast("Tambahkan produk terlebih dahulu")}
          >
            Lanjut checkout <span>→</span>
          </button>
        </div>
      </aside>
      {cartOpen && (
        <button
          className="overlay"
          aria-label="Tutup keranjang"
          onClick={() => setCartOpen(false)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => showToast("Berhasil masuk. Silakan lanjutkan pesanan.")} />}
      {checkoutOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCheckoutOpen(false)}>
          <section className="checkout-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setCheckoutOpen(false)} aria-label="Tutup">×</button>
            <p className="eyebrow">Langkah Terakhir</p>
            <h2>Lengkapi Pesananmu</h2>
            <p className="modal-description">Isi alamat pengiriman untuk menghitung ongkir & memilih kurir.</p>

            <form className="stack-form" onSubmit={submitCheckout}>
              <label>
                Nama Penerima
                <input value={checkout.name} onChange={(event) => setCheckout({ ...checkout, name: event.target.value })} required placeholder="Nama lengkap Anda" />
              </label>

              <label>
                Nomor WhatsApp
                <input value={checkout.phone} onChange={(event) => setCheckout({ ...checkout, phone: event.target.value })} required placeholder="0812xxxxxxxx" />
              </label>

              <label>
                Alamat Lengkap
                <textarea value={checkout.address} onChange={(event) => setCheckout({ ...checkout, address: event.target.value })} required rows={2} placeholder="Jalan, No. Rumah, RT/RW, Kelurahan, Kecamatan" />
              </label>

              <label>
                Kota / Kabupaten Tujuan
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    value={checkout.city}
                    onChange={(event) => {
                      const val = event.target.value;
                      setCheckout({ ...checkout, city: val });
                      if (val.length >= 3) calculateShipping(val);
                    }}
                    onBlur={() => calculateShipping(checkout.city)}
                    required
                    placeholder="Contoh: Bandung, Jakarta Selatan, Surabaya"
                  />
                  <button
                    type="button"
                    onClick={() => calculateShipping(checkout.city)}
                    className="secondary-button"
                    style={{ minHeight: "auto", padding: "0 14px", fontSize: "11px", whiteSpace: "nowrap" }}
                  >
                    {shippingLoading ? "Menghitung..." : "Cek Ongkir 🚚"}
                  </button>
                </div>
              </label>

              {/* Shipping Options Selector */}
              {shippingOptions.length > 0 && (
                <div style={{ background: "#fbf6f0", padding: "14px", borderRadius: "12px", border: "1px solid #e8decb", margin: "6px 0" }}>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: "#6f4932", display: "block", marginBottom: "8px" }}>
                    🚚 Pilih Kurir Pengiriman ({Math.max(1, Math.ceil(cartWeight / 1000))} kg):
                  </span>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {shippingOptions.map((opt) => (
                      <label
                        key={opt.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: selectedShipping?.id === opt.id ? "2px solid #6f4932" : "1px solid #e2d5c5",
                          background: selectedShipping?.id === opt.id ? "#fffbf5" : "#ffffff",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="radio"
                            name="shipping_courier"
                            checked={selectedShipping?.id === opt.id}
                            onChange={() => setSelectedShipping(opt)}
                          />
                          <div>
                            <strong style={{ fontSize: "12px", display: "block" }}>{opt.serviceName}</strong>
                            <small style={{ fontSize: "9px", color: "#8c7868" }}>{opt.description} ({opt.etd})</small>
                          </div>
                        </div>
                        <strong style={{ color: "#6f4932", fontSize: "12px" }}>
                          {opt.isFree ? "GRATIS" : money(opt.cost)}
                        </strong>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label>
                Catatan Pesanan (opsional)
                <textarea value={checkout.notes} onChange={(event) => setCheckout({ ...checkout, notes: event.target.value })} rows={2} placeholder="Contoh: Tolong bungkus pita ucapan ulang tahun" />
              </label>

              {checkoutError && <p className="form-message">{checkoutError}</p>}

              {/* Rincian Tagihan Checkout */}
              <div className="checkout-total" style={{ flexDirection: "column", alignItems: "stretch", gap: "6px", borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span>Subtotal Kue</span>
                  <strong>{money(cartTotal)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span>Ongkos Kirim ({selectedShipping ? selectedShipping.courierName : "Belum dipilih"})</span>
                  <strong style={{ color: selectedShipping?.isFree ? "#278044" : "inherit" }}>
                    {selectedShipping ? (selectedShipping.isFree ? "GRATIS" : money(selectedShipping.cost)) : "Rp0"}
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed var(--line)", paddingTop: "8px", marginTop: "4px" }}>
                  <span style={{ fontWeight: "700" }}>Total Tagihan Final</span>
                  <strong style={{ fontSize: "24px", color: "#6f4932" }}>{money(finalTotal)}</strong>
                </div>
              </div>

              <button className="primary-button full-button" disabled={checkoutLoading}>
                {checkoutLoading ? "Mencatat pesanan..." : `Lanjut Pembayaran (${money(finalTotal)})`} <span>→</span>
              </button>
            </form>
          </section>
        </div>
      )}
      {paymentGatewayOrder && (
        <PaymentGatewayModal
          orderId={paymentGatewayOrder.id}
          orderNumber={paymentGatewayOrder.number}
          totalAmount={paymentGatewayOrder.total}
          onClose={() => setPaymentGatewayOrder(null)}
          onSuccess={() => {
            setPaymentGatewayOrder(null);
            showToast("Pembayaran berhasil dikonfirmasi! Pesanan Anda diproses.");
          }}
        />
      )}

      {/* PRODUCT DETAIL MODAL */}
      {detailProduct && (
        <div className="modal-backdrop" role="presentation" onClick={() => setDetailProduct(null)}>
          <div className="product-detail-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDetailProduct(null)}>×</button>

            <div className="detail-grid">
              <div className="detail-image-box">
                <span className="product-tag">{detailProduct.tag}</span>
                <img src={detailProduct.imageUrl} alt={detailProduct.name} />
              </div>

              <div className="detail-info-box">
                <p className="eyebrow">Resep Warisan Sejak 2014</p>
                <h2>{detailProduct.name}</h2>
                <p className="detail-description">{detailProduct.description}</p>

                {/* Size Selector */}
                <div className="size-selector-box">
                  <span className="section-label">Pilih Ukuran Kue:</span>
                  <div className="size-options">
                    <button
                      type="button"
                      className={`size-btn ${detailSize === "full" ? "selected" : ""}`}
                      onClick={() => setDetailSize("full")}
                    >
                      <strong>Full Size (20 × 20 cm)</strong>
                      <small>Berat ~1.000g • {money(detailProduct.price)}</small>
                    </button>
                    <button
                      type="button"
                      className={`size-btn ${detailSize === "half" ? "selected" : ""}`}
                      onClick={() => setDetailSize("half")}
                    >
                      <strong>Half Size (10 × 20 cm)</strong>
                      <small>Berat ~500g • {money(Math.round(detailProduct.price * 0.55))}</small>
                    </button>
                  </div>
                </div>

                {/* Premium Ingredients & Storage Advice */}
                <div className="product-highlights">
                  <div>
                    <span>🧈 Komposisi Premium</span>
                    <small>100% Butter Wijsman, Telur Segar Pilihan, Terigu Premium, Bebas Pengawet.</small>
                  </div>
                  <div>
                    <span>📦 Masa Simpan & Penyimpanan</span>
                    <small>3 - 5 hari di suhu ruang | Hingga 3 minggu dalam kulkas/chiller.</small>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="detail-action-row">
                  <div className="detail-price-tag">
                    <span>Total:</span>
                    <strong>{money((detailSize === "full" ? detailProduct.price : Math.round(detailProduct.price * 0.55)) * detailQty)}</strong>
                  </div>

                  <div className="detail-qty-control">
                    <button onClick={() => setDetailQty(Math.max(1, detailQty - 1))}>−</button>
                    <span>{detailQty}</span>
                    <button onClick={() => setDetailQty(detailQty + 1)}>+</button>
                  </div>

                  <button
                    className="primary-button"
                    onClick={() => {
                      const itemPrice = detailSize === "full" ? detailProduct.price : Math.round(detailProduct.price * 0.55);
                      const sizeLabel = detailSize === "full" ? "20x20 cm" : "10x20 cm";
                      for (let i = 0; i < detailQty; i++) {
                        addToCart({
                          ...detailProduct,
                          price: itemPrice,
                          name: `${detailProduct.name} (${sizeLabel})`,
                        });
                      }
                      setDetailProduct(null);
                    }}
                  >
                    + Tambah Keranjang <span>→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
