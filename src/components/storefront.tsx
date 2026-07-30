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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkout, setCheckout] = useState({ name: "", phone: "", address: "", city: "", notes: "", deliveryDate: "" });
  const [deliveryDateError, setDeliveryDateError] = useState("");
  const [detailProduct, setDetailProduct] = useState<StorefrontProduct | null>(null);
  const [detailSize, setDetailSize] = useState<"full" | "half">("full");
  const [detailQty, setDetailQty] = useState(1);

  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    type: "percent" | "fixed";
    value: number;
    label: string;
  } | null>(null);
  const [promoMessage, setPromoMessage] = useState("");
  const [promoError, setPromoError] = useState("");

  const [leadMagnetOpen, setLeadMagnetOpen] = useState(false);
  const [leadMagnetContact, setLeadMagnetContact] = useState("");
  const [waWidgetOpen, setWaWidgetOpen] = useState(false);
  const [isGiftOption, setIsGiftOption] = useState(false);
  const [giftDetails, setGiftDetails] = useState({ ribbon: "Pita Emas (Gold)", sender: "", recipient: "", cardMessage: "" });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id, email: data.user.email });
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });

    if (typeof window !== "undefined") {
      const seen = localStorage.getItem("sharenpan_lead_seen");
      if (!seen) {
        const timer = setTimeout(() => setLeadMagnetOpen(true), 2500);
        return () => clearTimeout(timer);
      }
    }

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
  const giftFee = isGiftOption ? 15000 : 0;

  const discountAmount = useMemo(() => {
    if (!appliedPromo || cartTotal <= 0) return 0;
    if (appliedPromo.type === "percent") {
      return Math.round((cartTotal * appliedPromo.value) / 100);
    }
    return Math.min(cartTotal, appliedPromo.value);
  }, [appliedPromo, cartTotal]);

  const finalTotal = Math.max(0, cartTotal - discountAmount + currentShippingCost + giftFee);

  async function handleApplyPromo(codeToApply?: string) {
    const code = (codeToApply || promoInput).trim().toUpperCase();
    if (!code) return;
    setPromoError("");
    setPromoMessage("");

    const localPromos: Record<string, { type: "percent" | "fixed"; value: number; label: string; minCart?: number }> = {
      WELCOME10: { type: "percent", value: 10, label: "Diskon 10% Spesial Pelanggan Baru" },
      SHARENPAN50K: { type: "fixed", value: 50000, label: "Potongan Rp50.000 (Min. Belanja Rp200.000)", minCart: 200000 },
      LEZAT20K: { type: "fixed", value: 20000, label: "Potongan Langsung Rp20.000" },
    };

    if (localPromos[code]) {
      const p = localPromos[code];
      if (p.minCart && cartTotal < p.minCart) {
        setPromoError(`Voucher ${code} memerlukan minimal belanja ${money(p.minCart)}.`);
        return;
      }
      setAppliedPromo({ code, type: p.type, value: p.value, label: p.label });
      setPromoMessage(`Voucher "${code}" berhasil dipasang!`);
      setPromoInput("");
      return;
    }

    try {
      const supabase = createClient();
      const { data } = await supabase.from("promo_codes").select("*").eq("code", code).eq("is_active", true).single();
      if (data) {
        setAppliedPromo({
          code: data.code,
          type: data.discount_type === "percentage" ? "percent" : "fixed",
          value: data.discount_value,
          label: `Diskon ${data.discount_type === "percentage" ? `${data.discount_value}%` : money(data.discount_value)}`,
        });
        setPromoMessage(`Voucher "${data.code}" berhasil dipasang!`);
        setPromoInput("");
        return;
      }
    } catch {
      //
    }

    setPromoError(`Kode voucher "${code}" tidak valid. Coba: WELCOME10 atau SHARENPAN50K`);
  }

  async function submitCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !cart.length) return;

    // Validate delivery date: minimum 2 days from now
    if (!checkout.deliveryDate) {
      setDeliveryDateError("Pilih tanggal pengiriman terlebih dahulu.");
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minDelivery = new Date(today);
    minDelivery.setDate(minDelivery.getDate() + 2);
    const chosen = new Date(checkout.deliveryDate);
    if (chosen < minDelivery) {
      setDeliveryDateError("Pesanan minimal dibuat 2 hari sebelum pengiriman. Pilih tanggal yang lebih jauh.");
      return;
    }
    setDeliveryDateError("");

    setCheckoutLoading(true);
    setCheckoutError("");
    const supabase = createClient();

    const formattedNotes = isGiftOption
      ? `[🎁 HAMPERS GIFT BOX - ${giftDetails.ribbon}] Dari: ${giftDetails.sender || "-"} | Untuk: ${giftDetails.recipient || "-"} | Pesan: "${giftDetails.cardMessage || "-"}" | Catatan Tambahan: ${checkout.notes || "-"}`
      : checkout.notes || null;

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
      notes: formattedNotes,
      desired_delivery_date: checkout.deliveryDate,
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
        <span className="scarcity-top-badge">🔥 Batch Hari Ini: Sisa 4 Loyang Lagi!</span>
        <span className="topbar-separator">•</span>
        <span>Gratis ongkir min. Rp500.000</span>
        <span className="topbar-separator">•</span>
        <span>Dipanggang Fresh Per Pesanan</span>
        <StatusPill status={databaseStatus} />
      </div>

      <header className="navbar">
        <a className="brand" href="#home" aria-label="Sharenpan home">
          <img src="/assets/logo.png" alt="Sharenpan Logo" className="brand-logo-img" />
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
          <a href="/lacak" className="nav-pesanan-highlight">
            📦 Lacak Pesanan
          </a>
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

        {/* Mobile: Cart + Hamburger */}
        <div className="mobile-nav-controls">
          <button className="mobile-cart-btn" onClick={() => setCartOpen(true)} aria-label="Keranjang">
            🛒
            {cartCount > 0 && <span className="mobile-cart-badge">{cartCount}</span>}
          </button>
          <button
            className="hamburger-btn"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Menu navigasi"
            aria-expanded={mobileMenuOpen}
          >
            <span className={mobileMenuOpen ? "ham-line open" : "ham-line"} />
            <span className={mobileMenuOpen ? "ham-line open" : "ham-line"} />
            <span className={mobileMenuOpen ? "ham-line open" : "ham-line"} />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <nav className="mobile-menu-drawer" onClick={(e) => e.stopPropagation()} aria-label="Menu mobile">
            <div className="mobile-menu-top">
              <div className="brand" style={{ pointerEvents: "none" }}>
                <img src="/assets/logo.png" alt="Sharenpan Logo" className="brand-logo-img" />
                <span>sharenpan<small style={{ display: "block", fontSize: "8px", fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "#a1795a" }}>lapis legit premium</small></span>
              </div>
              <button className="mobile-menu-close" onClick={() => setMobileMenuOpen(false)} aria-label="Tutup menu">×</button>
            </div>
            <div className="mobile-menu-links">
              <a href="#home" onClick={() => setMobileMenuOpen(false)}>🏠 Home</a>
              <a href="#produk" onClick={() => setMobileMenuOpen(false)}>🎂 Produk</a>
              <a href="#cerita" onClick={() => setMobileMenuOpen(false)}>💬 Tentang kami</a>
              <a href="#cara-order" onClick={() => setMobileMenuOpen(false)}>📋 Cara order</a>
              <a href="/lacak" className="nav-pesanan-highlight" style={{ display: "flex" }} onClick={() => setMobileMenuOpen(false)}>📦 Lacak Pesanan</a>
            </div>
            <div className="mobile-menu-footer">
              {user ? (
                <>
                  <a href="/customer?tab=profile" className="primary-button full-button" style={{ textAlign: "center" }} onClick={() => setMobileMenuOpen(false)}>👤 Profil Saya</a>
                  <button className="logout-button full-button" style={{ width: "100%", marginTop: "8px" }} onClick={async () => { await createClient().auth.signOut(); setUser(null); setMobileMenuOpen(false); }}>Keluar</button>
                </>
              ) : (
                <button className="primary-button full-button" onClick={() => { setAuthOpen(true); setMobileMenuOpen(false); }}>Masuk / Daftar</button>
              )}
            </div>
          </nav>
        </div>
      )}

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
            {products.length === 0 ? (
              /* Skeleton Loading Cards */
              Array.from({ length: 3 }).map((_, i) => (
                <div className="product-card skeleton-card" key={i} aria-hidden="true">
                  <div className="skeleton-image" />
                  <div className="product-info" style={{ gap: "10px", display: "flex", flexDirection: "column", padding: "16px" }}>
                    <div className="skeleton-line" style={{ width: "40%", height: "10px" }} />
                    <div className="skeleton-line" style={{ width: "75%", height: "16px" }} />
                    <div className="skeleton-line" style={{ width: "90%", height: "10px" }} />
                    <div className="skeleton-line" style={{ width: "90%", height: "10px" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                      <div className="skeleton-line" style={{ width: "35%", height: "18px" }} />
                      <div className="skeleton-circle" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              filteredProducts.map((product) => (
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
                        <small style={{ color: product.stock <= 15 ? "#a05448" : "inherit", fontWeight: product.stock <= 15 ? "700" : "normal" }}>
                          {product.stock <= 15 ? `🔥 Sisa ${product.stock} loyang hari ini` : `${product.stock} stok tersedia`}
                        </small>
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
              ))
            )}
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

        {/* VIDEO HOMEMADE KITCHEN SECTION */}
        <section className="desire-section content-width" id="homemade">
          <div className="section-heading desire-heading">
            <div>
              <p className="eyebrow">Dibuat Sepenuh Hati</p>
              <h2>Dari Dapur Kami,<br /><em>sampai ke momen Anda.</em></h2>
            </div>
            <p className="desire-intro">Setiap lapis dipanggang perlahan, dikemas dengan rapi, lalu dikirim fresh untuk orang-orang tersayang.</p>
          </div>
          <div className="homemade-grid">
            <article className="video-story-card">
              <div className="video-frame">
                <video autoPlay muted loop playsInline controls preload="metadata">
                  <source src="/assets/homemade-kitchen-1.mp4" type="video/mp4" />
                </video>
              </div>
              <div className="video-card-copy">
                <span className="video-step">01 / PROSES HOMEMADE</span>
                <h3>Adonan Pilihan, Dibuat Fresh Setiap Hari.</h3>
                <p>Butter harum Wijsman dan telur pilihan dipersiapkan dengan teliti sebelum dipanggang selapis demi selapis.</p>
              </div>
            </article>
            <article className="video-story-card video-story-card-offset">
              <div className="video-frame">
                <video autoPlay muted loop playsInline controls preload="metadata">
                  <source src="/assets/homemade-kitchen-2.mp4" type="video/mp4" />
                </video>
              </div>
              <div className="video-card-copy">
                <span className="video-step">02 / PEMANGGANGAN PERLAHAN</span>
                <h3>Lapis demi Lapis, Dipanggang Sempurna.</h3>
                <p>Ketelitian api dan kesabaran menghasilkan tekstur yang luar biasa lembut dan wangi khas warisan resep.</p>
              </div>
            </article>
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

        {/* SPECIAL EDITION VIDEO BANNER */}
        <section className="special-edition content-width">
          <div className="special-video">
            <video autoPlay muted loop playsInline controls preload="metadata">
              <source src="/assets/special-edition-lebaran.mp4" type="video/mp4" />
            </video>
          </div>
          <div className="special-copy">
            <p className="eyebrow">Special Edition Hampers</p>
            <h2>Momen Manis <em>Bersama Keluarga.</em></h2>
            <p>Hadirkan kehangatan lapis legit premium Sharenpan di setiap perayaan hari raya & momen spesial bersama orang tercinta.</p>
            <div className="special-details">
              <span><b>100%</b> Real Butter Wijsman</span>
              <span><b>Fresh</b> Baked Daily</span>
              <span><b>Custom</b> Gift Card & Ribbon</span>
            </div>
            <button className="primary-button" onClick={() => setCartOpen(true)}>
              Pesan Hampers Sekarang <span>→</span>
            </button>
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

        {/* UGC & SOCIAL PROOF GALLERY SECTION */}
        <section className="ugc-section content-width">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Cerita & Ulasan Pelanggan</p>
              <h2>📸 #SharenpanMoments</h2>
            </div>
            <a href="https://www.instagram.com/sharenpan_/" target="_blank" rel="noopener noreferrer" className="secondary-button" style={{ display: "inline-flex", gap: "6px", alignItems: "center", minHeight: "auto", padding: "8px 16px", fontSize: "12px" }}>
              Follow @sharenpan_ ↗
            </a>
          </div>

          <div className="ugc-grid">
            <div className="ugc-card">
              <div className="ugc-badge">⭐ 5.0 Rating</div>
              <p className="ugc-quote">"Harum butter Wijsman langsung kerasa banget pas dus dibuka! Teksturnya super lembut, 1 loyang habis sekeluarga pas kumpul Lebaran."</p>
              <div className="ugc-author">
                <strong>Diana Pratiwi</strong>
                <small>Verified Buyer • Bandung</small>
              </div>
            </div>

            <div className="ugc-card">
              <div className="ugc-badge">🎁 Hampers Gift</div>
              <p className="ugc-quote">"Pesan paket hampers pita emas untuk mertua. Packaging-nya sangat mewah dan rasa lapis legit prune-nya dapet pujian terus!"</p>
              <div className="ugc-author">
                <strong>Budi Santoso</strong>
                <small>Verified Buyer • Jakarta</small>
              </div>
            </div>

            <div className="ugc-card">
              <div className="ugc-badge">☕ Coffee Companion</div>
              <p className="ugc-quote">"Legitnya pas, gak manis bikin enek. Cocok banget disandingkan sama kopi hitam hangat pas sore-sore."</p>
              <div className="ugc-author">
                <strong>Melissa V.</strong>
                <small>Verified Buyer • Surabaya</small>
              </div>
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
                <div className="cart-item-image-box">
                  <img src={item.imageUrl} alt={item.name} />
                </div>
                <div className="cart-item-info">
                  <strong>{item.name}</strong>
                  <small>{money(item.price)}</small>
                  <div className="cart-item-bottom">
                    <div className="quantity-control">
                      <button onClick={() => changeQuantity(item.id, -1)}>−</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => changeQuantity(item.id, 1)}>+</button>
                    </div>
                    <span className="cart-item-subtotal">{money(item.price * item.quantity)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="cart-footer">
          {/* Voucher Section */}
          <div className="voucher-cart-box" style={{ background: "#fbf6f0", padding: "10px", borderRadius: "10px", border: "1px solid #e8decb", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", fontWeight: "800", color: "#6f4932", display: "block", marginBottom: "6px" }}>
              🎟️ Punya Kode Voucher / Promo?
            </span>
            {appliedPromo ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fdf3e5", padding: "6px 10px", borderRadius: "8px", border: "1px solid #e5cdb2" }}>
                <div>
                  <strong style={{ fontSize: "12px", color: "#6f4932" }}>{appliedPromo.code}</strong>
                  <small style={{ display: "block", fontSize: "10px", color: "#8c6d56" }}>{appliedPromo.label}</small>
                </div>
                <button
                  type="button"
                  onClick={() => { setAppliedPromo(null); setPromoMessage(""); setPromoError(""); }}
                  style={{ border: 0, background: "transparent", color: "#a05448", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                >
                  Hapus
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder="Kode: WELCOME10"
                  style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #d8c8b8", fontSize: "12px", textTransform: "uppercase" }}
                />
                <button
                  type="button"
                  onClick={() => handleApplyPromo()}
                  style={{ padding: "6px 12px", borderRadius: "6px", background: "#6f4932", color: "#fff", border: 0, fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                >
                  Gunakan
                </button>
              </div>
            )}
            {promoMessage && <small style={{ color: "#2d7a42", fontSize: "10px", display: "block", marginTop: "4px" }}>{promoMessage}</small>}
            {promoError && <small style={{ color: "#a05448", fontSize: "10px", display: "block", marginTop: "4px" }}>{promoError}</small>}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>Subtotal Produk</span>
            <span style={{ fontSize: "13px" }}>{money(cartTotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", color: "#2d7a42" }}>
              <span style={{ fontSize: "12px" }}>Diskon Voucher ({appliedPromo?.code})</span>
              <span style={{ fontSize: "13px", fontWeight: "700" }}>−{money(discountAmount)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: "8px", marginTop: "4px" }}>
            <span>Total Belanja</span>
            <strong style={{ fontSize: "18px", color: "var(--brown)" }}>{money(Math.max(0, cartTotal - discountAmount))}</strong>
          </div>
          <button
            className="primary-button full-button"
            style={{ marginTop: "12px" }}
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

              {/* Delivery Date Picker */}
              {(() => {
                const todayDate = new Date();
                todayDate.setHours(0, 0, 0, 0);
                const minDate = new Date(todayDate);
                minDate.setDate(minDate.getDate() + 2);
                const minDateStr = minDate.toISOString().split("T")[0];
                return (
                  <div className="delivery-date-section">
                    <div className="delivery-date-banner">
                      <span className="delivery-date-icon">🗓️</span>
                      <div>
                        <strong>Pesanan minimal 2 hari sebelum pengiriman</strong>
                        <small>Lapis legit kami dipanggang fresh setiap hari. Tanggal tersedia mulai <b>{minDate.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}</b>.</small>
                      </div>
                    </div>
                    <label style={{ marginTop: "10px" }}>
                      <span className="delivery-date-label">Tanggal Pengiriman yang Diinginkan <span style={{ color: "#a05448" }}>*</span></span>
                      <input
                        type="date"
                        min={minDateStr}
                        value={checkout.deliveryDate}
                        onChange={(e) => {
                          setCheckout({ ...checkout, deliveryDate: e.target.value });
                          setDeliveryDateError("");
                        }}
                        required
                        className={deliveryDateError ? "input-error" : ""}
                        style={{ width: "100%", boxSizing: "border-box" }}
                      />
                    </label>
                    {checkout.deliveryDate && !deliveryDateError && (
                      <div className="delivery-date-confirm">
                        ✅ Estimasi tiba: <strong>{new Date(checkout.deliveryDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong>
                      </div>
                    )}
                    {deliveryDateError && (
                      <div className="delivery-date-error">⚠️ {deliveryDateError}</div>
                    )}
                  </div>
                );
              })()}

              {/* Hampers & Gift Box Customization */}
              <div className="gift-option-box" style={{ background: "#fbf6f0", padding: "14px", borderRadius: "12px", border: "1px solid #e8decb", margin: "10px 0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontWeight: "700", color: "#6f4932", fontSize: "13px" }}>
                  <input
                    type="checkbox"
                    checked={isGiftOption}
                    onChange={(e) => setIsGiftOption(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "#6f4932" }}
                  />
                  🎁 Bungkus sebagai Hampers & Gift Box (+Rp15.000)
                </label>
                <small style={{ display: "block", fontSize: "11px", color: "#8c7868", marginTop: "4px", marginLeft: "28px" }}>
                  Termasuk Box Premium Sharenpan, Pita Satin Eksklusif, dan Kartu Ucapan Custom.
                </small>

                {isGiftOption && (
                  <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px", paddingTop: "10px", borderTop: "1px dashed #e2d5c5" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#5c4433" }}>Pilih Warna Pita:</span>
                      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                        {["Pita Emas (Gold)", "Pita Merah Marun", "Pita Hijau Mint"].map((rib) => (
                          <button
                            type="button"
                            key={rib}
                            onClick={() => setGiftDetails({ ...giftDetails, ribbon: rib })}
                            style={{
                              padding: "6px 10px",
                              fontSize: "11px",
                              borderRadius: "6px",
                              border: giftDetails.ribbon === rib ? "2px solid #6f4932" : "1px solid #dcd1c4",
                              background: giftDetails.ribbon === rib ? "#ffffff" : "#fdf8f2",
                              fontWeight: giftDetails.ribbon === rib ? "700" : "500",
                              cursor: "pointer",
                            }}
                          >
                            {rib}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <input
                        placeholder="Nama Pengirim (Dari)"
                        value={giftDetails.sender}
                        onChange={(e) => setGiftDetails({ ...giftDetails, sender: e.target.value })}
                        style={{ padding: "8px 10px", fontSize: "12px", borderRadius: "6px", border: "1px solid #dcd1c4" }}
                      />
                      <input
                        placeholder="Nama Penerima (Untuk)"
                        value={giftDetails.recipient}
                        onChange={(e) => setGiftDetails({ ...giftDetails, recipient: e.target.value })}
                        style={{ padding: "8px 10px", fontSize: "12px", borderRadius: "6px", border: "1px solid #dcd1c4" }}
                      />
                    </div>
                    <textarea
                      placeholder="Pesan Ucapan di Kartu (misal: Selamat Hari Raya / Happy Birthday! Semoga makin sukses & sehat selalu.)"
                      value={giftDetails.cardMessage}
                      onChange={(e) => setGiftDetails({ ...giftDetails, cardMessage: e.target.value })}
                      rows={2}
                      style={{ padding: "8px 10px", fontSize: "12px", borderRadius: "6px", border: "1px solid #dcd1c4" }}
                    />
                  </div>
                )}
              </div>

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
                {discountAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#2d7a42" }}>
                    <span>Diskon Voucher ({appliedPromo?.code})</span>
                    <strong style={{ fontWeight: "700" }}>−{money(discountAmount)}</strong>
                  </div>
                )}
                {isGiftOption && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#6f4932" }}>
                    <span>Opsi Hampers & Gift Box</span>
                    <strong style={{ fontWeight: "700" }}>+Rp15.000</strong>
                  </div>
                )}
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
      {/* FLOATING WHATSAPP CHAT WIDGET */}
      <div className="wa-floating-container">
        {waWidgetOpen && (
          <div className="wa-chat-box">
            <div className="wa-chat-header">
              <div className="wa-agent-info">
                <span className="wa-online-dot" />
                <div>
                  <strong>CS Sharenpan Bandung</strong>
                  <small>Online • Balas dalam ~2 menit</small>
                </div>
              </div>
              <button className="wa-close-btn" onClick={() => setWaWidgetOpen(false)}>×</button>
            </div>
            <div className="wa-chat-body">
              <p className="wa-bubble">
                Halo Kak! 👋 Ada yang bisa kami bantu seputar varian lapis legit, paket hampers, atau estimasi pengiriman ke kota Kakak?
              </p>
              <div className="wa-quick-chips">
                <a
                  href="https://wa.me/62895321759440?text=Halo%20Sharenpan%2C%20saya%20mau%20tanya%20paket%20hampers%20lapis%20legit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wa-chip"
                >
                  🎁 Tanya Paket Hampers
                </a>
                <a
                  href="https://wa.me/62895321759440?text=Halo%20Sharenpan%2C%20apakah%20bisa%20kirim%20ke%20kota%20saya%3F"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wa-chip"
                >
                  🚚 Cek Pengiriman CS
                </a>
                <a
                  href="https://wa.me/62895321759440?text=Halo%20Sharenpan%2C%20saya%20mau%20konsultasi%20pesanan%20khusus"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wa-chip"
                >
                  💬 Konsultasi Pesanan
                </a>
              </div>
            </div>
            <div className="wa-chat-footer">
              <a
                href="https://wa.me/62895321759440?text=Halo%20Sharenpan%2C%20saya%20ingin%20bertanya%20seputar%20lapis%20legit"
                target="_blank"
                rel="noopener noreferrer"
                className="wa-send-btn"
              >
                Mulai Chat WhatsApp (+62 895-3217-59440) 💬
              </a>
            </div>
          </div>
        )}
        <button
          className="wa-floating-btn"
          onClick={() => setWaWidgetOpen((v) => !v)}
          aria-label="Chat WhatsApp CS Sharenpan"
        >
          <span className="wa-icon">💬</span>
          <span className="wa-btn-label">Tanya CS WA</span>
        </button>
      </div>

      {/* LEAD MAGNET POPUP MODAL (WELCOME10 VOUCHER) */}
      {leadMagnetOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setLeadMagnetOpen(false)}>
          <div className="lead-magnet-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => {
                setLeadMagnetOpen(false);
                if (typeof window !== "undefined") localStorage.setItem("sharenpan_lead_seen", "true");
              }}
            >
              ×
            </button>
            <div className="lead-magnet-content">
              <span className="lead-badge">🎁 HADIAH SPESIAL PENGUNJUNG BARU</span>
              <h2>Dapatkan Diskon 10%</h2>
              <p className="lead-desc">
                Masukkan WhatsApp atau email kamu untuk mengklaim kode voucher <strong>WELCOME10</strong> secara instan untuk pesanan pertamamu di Sharenpan.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!leadMagnetContact.trim()) return;
                  if (typeof window !== "undefined") localStorage.setItem("sharenpan_lead_seen", "true");
                  handleApplyPromo("WELCOME10");
                  setLeadMagnetOpen(false);
                  showToast("🎉 Voucher WELCOME10 berhasil diklaim & dipasang!");
                }}
                className="lead-form"
              >
                <input
                  type="text"
                  placeholder="Nomor WhatsApp / Email Anda"
                  value={leadMagnetContact}
                  onChange={(e) => setLeadMagnetContact(e.target.value)}
                  required
                  className="lead-input"
                />
                <button type="submit" className="primary-button full-button" style={{ marginTop: "10px" }}>
                  Klaim Diskon 10% Sekarang ➔
                </button>
              </form>
              <small className="lead-footer-note">
                🔒 Data aman. Tanpa spam, langsung dipotong di keranjang!
              </small>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
