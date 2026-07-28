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
      shipping_address: { address_line: checkout.address, city: checkout.city },
      notes: checkout.notes || null,
      subtotal: cartTotal,
      total: cartTotal,
    }).select("id, order_number").single();
    if (error || !order) {
      setCheckoutError(error?.message || "Pesanan belum dapat dibuat.");
    } else {
      const { error: itemsError } = await supabase.from("order_items").insert(cart.map((item) => ({ order_id: order.id, product_id: item.id.startsWith("fallback-") ? null : item.id, product_name: item.name, unit_price: item.price, quantity: item.quantity, subtotal: item.price * item.quantity })));
      if (itemsError) setCheckoutError(itemsError.message);
      else {
        setCart([]);
        setCheckoutOpen(false);
        setPaymentGatewayOrder({ id: order.id, number: order.order_number, total: cartTotal });
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
        </nav>
        <div className="nav-actions">
          {user ? (
            <>
              <a className="account-button" href="/customer">
                📦 Akun & Pesanan
              </a>
              <button className="account-button" onClick={async () => { await createClient().auth.signOut(); setUser(null); }}>
                Keluar
              </button>
            </>
          ) : (
            <button className="account-button" onClick={() => setAuthOpen(true)}>Masuk / Daftar</button>
          )}
          <button className="cart-button" onClick={() => setCartOpen(true)}>
            Keranjang <b>{cartCount}</b>
          </button>
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
                <div className="product-image">
                  <span className="product-tag">{product.tag}</span>
                  <img src={product.imageUrl} alt={product.name} />
                </div>
                <div className="product-info">
                  <div className="product-meta">
                    <span className="rating">★★★★★ <b>{product.rating}</b></span>
                    <small>{product.reviews} review</small>
                  </div>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="product-footer">
                    <div>
                      <strong>{money(product.price)}</strong>
                      <small>{product.stock} stok tersedia</small>
                    </div>
                    <button
                      className="add-button"
                      onClick={() => addToCart(product)}
                      aria-label={`Tambah ${product.name}`}
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
      {checkoutOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setCheckoutOpen(false)}><section className="checkout-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setCheckoutOpen(false)} aria-label="Tutup">×</button><p className="eyebrow">Langkah terakhir</p><h2>Lengkapi pesananmu.</h2><p className="modal-description">Pesanan akan dicatat ke akunmu dan diproses oleh tim Sharenpan.</p><form className="stack-form" onSubmit={submitCheckout}><label>Nama penerima<input value={checkout.name} onChange={(event) => setCheckout({ ...checkout, name: event.target.value })} required /></label><label>Nomor WhatsApp<input value={checkout.phone} onChange={(event) => setCheckout({ ...checkout, phone: event.target.value })} required /></label><label>Alamat lengkap<textarea value={checkout.address} onChange={(event) => setCheckout({ ...checkout, address: event.target.value })} required rows={3} /></label><label>Kota<input value={checkout.city} onChange={(event) => setCheckout({ ...checkout, city: event.target.value })} required /></label><label>Catatan (opsional)<textarea value={checkout.notes} onChange={(event) => setCheckout({ ...checkout, notes: event.target.value })} rows={2} /></label>{checkoutError && <p className="form-message">{checkoutError}</p>}<div className="checkout-total"><span>Total pesanan</span><strong>{money(cartTotal)}</strong></div><button className="primary-button full-button" disabled={checkoutLoading}>{checkoutLoading ? "Mencatat pesanan..." : "Konfirmasi pesanan"}<span>→</span></button></form></section></div>}
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
    </div>
  );
}
