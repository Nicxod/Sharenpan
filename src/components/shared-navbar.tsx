"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NavbarVariant = "storefront" | "lacak" | "customer";

interface SharedNavbarProps {
  variant?: NavbarVariant;
  /** For storefront only: cart item count */
  cartCount?: number;
  /** For storefront only: open cart drawer */
  onCartOpen?: () => void;
  /** For storefront only: open auth modal */
  onAuthOpen?: () => void;
  /** For customer dashboard: callback for sign-out (optional, defaults to redirect) */
  onSignOut?: () => void;
}

export default function SharedNavbar({
  variant = "storefront",
  cartCount = 0,
  onCartOpen,
  onAuthOpen,
  onSignOut,
}: SharedNavbarProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  async function handleSignOut() {
    if (onSignOut) {
      onSignOut();
    } else {
      await createClient().auth.signOut();
      window.location.href = "/";
    }
  }

  const isLacak    = pathname === "/lacak";
  const isCustomer = pathname?.startsWith("/customer");

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        {variant === "storefront" ? (
          <>
            <span className="scarcity-top-badge">🔥 Batch Hari Ini: Sisa 4 Loyang Lagi!</span>
            <span className="topbar-separator">•</span>
            <span>Gratis ongkir min. Rp500.000</span>
            <span className="topbar-separator">•</span>
            <span>Dipanggang Fresh Per Pesanan</span>
          </>
        ) : (
          <>
            <span>Gratis ongkir untuk pesanan di atas Rp500.000</span>
            <span className="topbar-separator">•</span>
            <span>Dibuat fresh berdasarkan pesanan</span>
          </>
        )}
      </div>

      {/* Main Navbar */}
      <header className="navbar">
        {/* Brand */}
        <Link
          className="brand"
          href={variant === "storefront" ? "#home" : "/"}
          aria-label="Sharenpan home"
        >
          <img src="/assets/logo.png" alt="Sharenpan Logo" className="brand-logo-img" />
          <span>
            sharenpan
            <small>premium homemade cakes</small>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="desktop-nav" aria-label="Navigasi utama">
          {variant === "storefront" ? (
            <>
              <a href="#home">Home</a>
              <a href="#produk">Produk</a>
              <a href="#cerita">Tentang kami</a>
              <a href="#cara-order">Cara order</a>
              <a href="/lacak" className={`nav-pesanan-highlight${isLacak ? " active-nav" : ""}`}>
                📦 Lacak Pesanan
              </a>
            </>
          ) : (
            <>
              <Link href="/">Home</Link>
              <Link href="/#produk">Shop</Link>
              <Link href="/#cerita">Story</Link>
              <Link href="/#special-edition">Gifts</Link>
              <Link
                href="/lacak"
                className={`nav-pesanan-highlight${isLacak ? " active-nav" : ""}`}
              >
                📦 Lacak Pesanan
              </Link>
            </>
          )}
        </nav>

        {/* Desktop Actions */}
        <div className="nav-actions">
          {variant === "customer" ? (
            /* Customer Dashboard: show back to store + sign out */
            <>
              <Link href="/" className="account-button">
                🛍️ Ke Toko
              </Link>
              <button className="logout-button" onClick={handleSignOut}>
                Keluar
              </button>
            </>
          ) : user ? (
            /* Logged in on storefront / lacak */
            <>
              <Link className="account-button" href="/customer">
                👤 Profil Saya
              </Link>
              {onCartOpen && (
                <button className="cart-button" onClick={onCartOpen}>
                  Keranjang <b>{cartCount}</b>
                </button>
              )}
              <button
                className="logout-button"
                onClick={handleSignOut}
              >
                Keluar
              </button>
            </>
          ) : (
            /* Not logged in */
            <>
              {onAuthOpen && (
                <button className="account-button" onClick={onAuthOpen}>
                  Masuk / Daftar
                </button>
              )}
              {onCartOpen && (
                <button className="cart-button" onClick={onCartOpen}>
                  Keranjang <b>{cartCount}</b>
                </button>
              )}
            </>
          )}
        </div>

        {/* Mobile: Cart + Hamburger */}
        <div className="mobile-nav-controls">
          {onCartOpen && (
            <button
              className="mobile-cart-btn"
              onClick={onCartOpen}
              aria-label="Keranjang"
            >
              🛒
              {cartCount > 0 && <span className="mobile-cart-badge">{cartCount}</span>}
            </button>
          )}
          <button
            className="hamburger-btn"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu navigasi"
            aria-expanded={mobileOpen}
          >
            <span className={mobileOpen ? "ham-line open" : "ham-line"} />
            <span className={mobileOpen ? "ham-line open" : "ham-line"} />
            <span className={mobileOpen ? "ham-line open" : "ham-line"} />
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="mobile-menu-backdrop" onClick={() => setMobileOpen(false)}>
          <nav
            className="mobile-menu-drawer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Menu mobile"
          >
            <div className="mobile-menu-top">
              <div className="brand" style={{ pointerEvents: "none" }}>
                <img src="/assets/logo.png" alt="Sharenpan Logo" className="brand-logo-img" />
                <span>
                  sharenpan
                  <small style={{ display: "block", fontSize: "8px", fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "#a1795a" }}>
                    premium homemade cakes
                  </small>
                </span>
              </div>
              <button
                className="mobile-menu-close"
                onClick={() => setMobileOpen(false)}
                aria-label="Tutup menu"
              >
                ×
              </button>
            </div>

            <div className="mobile-menu-links">
              {variant === "storefront" ? (
                <>
                  <a href="#home"       onClick={() => setMobileOpen(false)}>🏠 Home</a>
                  <a href="#produk"     onClick={() => setMobileOpen(false)}>🎂 Produk</a>
                  <a href="#cerita"     onClick={() => setMobileOpen(false)}>💬 Tentang kami</a>
                  <a href="#cara-order" onClick={() => setMobileOpen(false)}>📋 Cara order</a>
                  <a href="/lacak" className="nav-pesanan-highlight" onClick={() => setMobileOpen(false)}>
                    📦 Lacak Pesanan
                  </a>
                </>
              ) : (
                <>
                  <Link href="/"             onClick={() => setMobileOpen(false)}>🏠 Home</Link>
                  <Link href="/#produk"      onClick={() => setMobileOpen(false)}>🎂 Produk</Link>
                  <Link href="/#cerita"      onClick={() => setMobileOpen(false)}>💬 Tentang kami</Link>
                  <Link href="/#cara-order"  onClick={() => setMobileOpen(false)}>📋 Cara order</Link>
                  <Link href="/lacak" className={`nav-pesanan-highlight${isLacak ? " active-nav" : ""}`} onClick={() => setMobileOpen(false)}>
                    📦 Lacak Pesanan
                  </Link>
                </>
              )}
            </div>

            <div className="mobile-menu-footer">
              {variant === "customer" ? (
                <>
                  <Link href="/" className="primary-button full-button" style={{ textAlign: "center" }} onClick={() => setMobileOpen(false)}>
                    🛍️ Kembali ke Toko
                  </Link>
                  <button
                    className="logout-button full-button"
                    style={{ width: "100%", marginTop: "8px" }}
                    onClick={() => { handleSignOut(); setMobileOpen(false); }}
                  >
                    Keluar
                  </button>
                </>
              ) : user ? (
                <>
                  <Link href="/customer" className="primary-button full-button" style={{ textAlign: "center" }} onClick={() => setMobileOpen(false)}>
                    👤 Profil Saya
                  </Link>
                  <button
                    className="logout-button full-button"
                    style={{ width: "100%", marginTop: "8px" }}
                    onClick={() => { handleSignOut(); setMobileOpen(false); }}
                  >
                    Keluar
                  </button>
                </>
              ) : (
                <>
                  {onAuthOpen && (
                    <button
                      className="primary-button full-button"
                      onClick={() => { onAuthOpen(); setMobileOpen(false); }}
                    >
                      Masuk / Daftar
                    </button>
                  )}
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
