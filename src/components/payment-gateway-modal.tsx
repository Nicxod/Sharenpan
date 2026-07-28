"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PaymentMethod = "qris" | "bca_va" | "mandiri_va" | "bni_va" | "gopay" | "shopeepay" | "bank_transfer";

const money = (val: number) => `Rp${val.toLocaleString("id-ID")}`;

const paymentOptions: Array<{ id: PaymentMethod; name: string; category: string; icon: string; badge?: string }> = [
  { id: "qris", name: "QRIS (Semua E-Wallet & Bank)", category: "Instan", icon: "📱", badge: "Paling Praktis" },
  { id: "bca_va", name: "BCA Virtual Account", category: "Virtual Account", icon: "🏧" },
  { id: "mandiri_va", name: "Mandiri Virtual Account", category: "Virtual Account", icon: "🏧" },
  { id: "bni_va", name: "BNI Virtual Account", category: "Virtual Account", icon: "🏧" },
  { id: "gopay", name: "GoPay / GoPay Later", category: "E-Wallet", icon: "👛" },
  { id: "shopeepay", name: "ShopeePay", category: "E-Wallet", icon: "👛" },
  { id: "bank_transfer", name: "Transfer Bank Manual", category: "Transfer", icon: "🏦" },
];

export default function PaymentGatewayModal({
  orderId,
  orderNumber,
  totalAmount,
  onClose,
  onSuccess,
}: {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("qris");
  const [step, setStep] = useState<"select" | "pay" | "success">("select");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const vaNumber = `883900${orderId.replace(/[^0-9]/g, "").slice(0, 10) || "8192837401"}`;

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function processPayment() {
    setLoading(true);
    setErrorMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          status: "confirmed",
          payment_reference: `PAY-${selectedMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`,
        })
        .eq("id", orderId);

      if (error) {
        setErrorMessage(error.message);
      } else {
        setStep("success");
        setTimeout(() => {
          onSuccess();
        }, 1800);
      }
    } catch {
      setErrorMessage("Gagal memproses pembayaran. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Tutup">
          ×
        </button>

        {step === "select" && (
          <>
            <div className="payment-modal-header">
              <span className="payment-badge-secure">🔒 Payment Gateway Direct</span>
              <h2 id="payment-title">Pilih Metode Pembayaran</h2>
              <p className="payment-order-sub">
                Pesanan <strong>#{orderNumber}</strong> • Total: <span className="highlight-price">{money(totalAmount)}</span>
              </p>
            </div>

            <div className="payment-methods-grid">
              {paymentOptions.map((opt) => (
                <button
                  key={opt.id}
                  className={`payment-method-card ${selectedMethod === opt.id ? "selected" : ""}`}
                  onClick={() => setSelectedMethod(opt.id)}
                >
                  <span className="method-icon">{opt.icon}</span>
                  <div className="method-info">
                    <strong>{opt.name}</strong>
                    <small>{opt.category}</small>
                  </div>
                  {opt.badge && <span className="method-tag">{opt.badge}</span>}
                  <span className="method-radio">{selectedMethod === opt.id ? "●" : "○"}</span>
                </button>
              ))}
            </div>

            <div className="payment-actions">
              <button className="primary-button full-button" onClick={() => setStep("pay")}>
                Lanjut ke Pembayaran <span>→</span>
              </button>
            </div>
          </>
        )}

        {step === "pay" && (
          <>
            <div className="payment-modal-header">
              <button className="back-pay-btn" onClick={() => setStep("select")}>
                ← Ganti Metode
              </button>
              <h2>Selesaikan Pembayaran</h2>
              <p className="payment-order-sub">
                Total Tagihan: <strong>{money(totalAmount)}</strong>
              </p>
            </div>

            {selectedMethod === "qris" && (
              <div className="qris-box">
                <p className="qris-desc">Scan QRIS ini menggunakan GoPay, OVO, ShopeePay, Dana, atau Mobile Banking Anda</p>
                <div className="qris-card">
                  <div className="qris-header">
                    <strong>QRIS SHARENPAN</strong>
                    <small>NMID: ID102938475928</small>
                  </div>
                  <div className="qris-image-simulated">
                    {/* SVG QR Code Simulation */}
                    <svg viewBox="0 0 200 200" width="160" height="160">
                      <rect width="200" height="200" fill="#ffffff" />
                      {/* Outer frames */}
                      <rect x="15" y="15" width="50" height="50" fill="#000" />
                      <rect x="23" y="23" width="34" height="34" fill="#fff" />
                      <rect x="31" y="31" width="18" height="18" fill="#000" />

                      <rect x="135" y="15" width="50" height="50" fill="#000" />
                      <rect x="143" y="23" width="34" height="34" fill="#fff" />
                      <rect x="151" y="31" width="18" height="18" fill="#000" />

                      <rect x="15" y="135" width="50" height="50" fill="#000" />
                      <rect x="23" y="143" width="34" height="34" fill="#fff" />
                      <rect x="31" y="151" width="18" height="18" fill="#000" />

                      {/* Random QR Pattern Dots */}
                      <rect x="80" y="20" width="15" height="15" fill="#000" />
                      <rect x="100" y="35" width="15" height="15" fill="#000" />
                      <rect x="80" y="60" width="20" height="20" fill="#000" />
                      <rect x="20" y="80" width="20" height="15" fill="#000" />
                      <rect x="50" y="90" width="25" height="25" fill="#000" />
                      <rect x="85" y="95" width="30" height="20" fill="#000" />
                      <rect x="125" y="80" width="20" height="25" fill="#000" />
                      <rect x="155" y="90" width="25" height="25" fill="#000" />
                      <rect x="80" y="130" width="25" height="20" fill="#000" />
                      <rect x="115" y="135" width="20" height="20" fill="#000" />
                      <rect x="145" y="140" width="35" height="15" fill="#000" />
                      <rect x="90" y="165" width="20" height="20" fill="#000" />
                      <rect x="125" y="165" width="20" height="20" fill="#000" />
                    </svg>
                  </div>
                  <div className="qris-footer">
                    <span>⏱ Waktu tersisa: <b className="timer">14:59</b></span>
                  </div>
                </div>
              </div>
            )}

            {selectedMethod.endsWith("_va") && (
              <div className="va-box">
                <p className="va-desc">Transfer ke Nomor Virtual Account berikut dari m-Banking atau ATM:</p>
                <div className="va-card">
                  <span className="va-bank-title">{selectedMethod.replace("_va", "").toUpperCase()} Virtual Account</span>
                  <div className="va-number-row">
                    <strong className="va-number">{vaNumber}</strong>
                    <button className="copy-btn" onClick={() => copyToClipboard(vaNumber)}>
                      {copied ? "✓ Tersalin" : "Salin"}
                    </button>
                  </div>
                  <div className="va-instructions">
                    <small>1. Buka aplikasi m-Banking Anda</small>
                    <small>2. Pilih Bayar/Transfer → Virtual Account</small>
                    <small>3. Masukkan nomor VA di atas dan konfirmasi nama Sharenpan</small>
                  </div>
                </div>
              </div>
            )}

            {(selectedMethod === "gopay" || selectedMethod === "shopeepay") && (
              <div className="ewallet-box">
                <div className="ewallet-card">
                  <span className="ewallet-icon">{selectedMethod === "gopay" ? "👛 GoPay" : "🛒 ShopeePay"}</span>
                  <p>Klik konfirmasi di bawah untuk mensimulasikan otorisasi pembayaran dari aplikasi {selectedMethod === "gopay" ? "GoPay" : "ShopeePay"} Anda.</p>
                </div>
              </div>
            )}

            {selectedMethod === "bank_transfer" && (
              <div className="va-box">
                <p className="va-desc">Transfer manual ke rekening resmi Sharenpan:</p>
                <div className="va-card">
                  <span className="va-bank-title">Bank BCA - Sharenpan Official</span>
                  <div className="va-number-row">
                    <strong className="va-number">829 0182 910</strong>
                    <button className="copy-btn" onClick={() => copyToClipboard("8290182910")}>
                      {copied ? "✓ Tersalin" : "Salin"}
                    </button>
                  </div>
                  <small className="transfer-note">A/N PT Sharenpan Kuliner Nusantara</small>
                </div>
              </div>
            )}

            {errorMessage && <p className="form-message">{errorMessage}</p>}

            <div className="payment-actions stack-actions">
              <button
                className="primary-button full-button simulate-pay-btn"
                disabled={loading}
                onClick={processPayment}
              >
                {loading ? "Memproses Verifikasi..." : "⚡ Konfirmasi / Simulasikan Pembayaran Berhasil"}
              </button>
              <small className="secure-footnote">🔒 Pembayaran langsung terverifikasi secara otomatis di database</small>
            </div>
          </>
        )}

        {step === "success" && (
          <div className="payment-success-box">
            <div className="success-icon-animated">✓</div>
            <h3>Pembayaran Berhasil!</h3>
            <p>Terima kasih. Pesanan Anda <strong>#{orderNumber}</strong> telah dikonfirmasi dan langsung diproses oleh tim Dapur Sharenpan.</p>
            <div className="loader-bar"><span className="loader-progress"></span></div>
          </div>
        )}
      </div>
    </div>
  );
}
