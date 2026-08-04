"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;

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
  const [step, setStep] = useState<"pay" | "success">("pay");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Bukti pembayaran harus berupa gambar.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Ukuran bukti pembayaran maksimal 5 MB.");
      return;
    }
    setErrorMessage("");
    setReceiptFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function processPayment() {
    if (!receiptFile) {
      setErrorMessage("Silakan unggah bukti pembayaran terlebih dahulu.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const supabase = createClient();
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Sesi login berakhir. Silakan login kembali.");

      const extension = receiptFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${orderId}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-receipts")
        .upload(path, receiptFile, { cacheControl: "3600", upsert: false });
      if (uploadError) throw new Error(`Bukti belum bisa diunggah: ${uploadError.message}`);

      const receiptUrl = supabase.storage.from("payment-receipts").getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.rpc("submit_payment_receipt", {
        p_order_id: orderId,
        p_receipt_url: receiptUrl,
        p_payment_reference: `QRIS-${Date.now().toString().slice(-6)}`,
      });
      if (error) throw new Error(error.message);

      setStep("success");
      window.setTimeout(onSuccess, 2200);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal mengirim bukti pembayaran.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title" onMouseDown={(event) => event.stopPropagation()} style={{ maxWidth: "540px" }}>
        <button className="modal-close" onClick={onClose} aria-label="Tutup">×</button>
        {step === "pay" ? (
          <>
            <div className="payment-modal-header">
              <span className="payment-badge-secure">📱 Pembayaran QRIS</span>
              <h2 id="payment-title">Bayar Pesanan</h2>
              <p className="payment-order-sub">Pesanan <strong>#{orderNumber}</strong> · Total: <span className="highlight-price">{money(totalAmount)}</span></p>
            </div>

            <div className="qris-box">
              <p className="qris-desc">Scan QRIS resmi Sharenpan menggunakan mobile banking atau e-wallet, lalu bayar tepat sesuai nominal.</p>
              <div className="qris-image-container" style={{ textAlign: "center", background: "#fff", padding: "10px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                <img src="/assets/qris-sharenpan.jpg" alt="QRIS Sharenpan" style={{ width: "100%", maxHeight: "390px", objectFit: "contain" }} />
              </div>
              <div style={{ textAlign: "center", margin: "14px 0", padding: "12px", background: "#fff8ee", borderRadius: "10px" }}>
                <small>Total yang harus dibayar</small>
                <strong style={{ display: "block", color: "#7a4f28", fontSize: "26px", fontFamily: "Georgia, serif" }}>{money(totalAmount)}</strong>
              </div>
              <label className="upload-receipt-section">
                <strong>Upload bukti transaksi</strong>
                <small style={{ display: "block", color: "var(--muted)", margin: "5px 0 8px" }}>JPG, PNG, atau WEBP · maksimal 5 MB</small>
                <input type="file" accept="image/*" onChange={handleFileChange} className="file-input" />
              </label>
              {previewUrl && <img src={previewUrl} alt="Preview bukti transaksi" style={{ display: "block", maxWidth: "100%", maxHeight: "160px", margin: "12px auto 0", objectFit: "contain", borderRadius: "8px" }} />}
            </div>

            {errorMessage && <p className="form-message" role="alert">{errorMessage}</p>}
            <div className="payment-actions stack-actions">
              <button className="primary-button full-button" disabled={loading || !receiptFile} onClick={processPayment}>
                {loading ? "Mengirim bukti..." : "Kirim Bukti Pembayaran"}
              </button>
              <small className="secure-footnote">Admin akan memeriksa bukti sebelum pembayaran dinyatakan lunas.</small>
            </div>
          </>
        ) : (
          <div className="payment-success-box">
            <div className="success-icon-animated">✓</div>
            <h3>Bukti Pembayaran Terkirim</h3>
            <p>Pesanan <strong>#{orderNumber}</strong> menunggu verifikasi admin. Status akan berubah setelah bukti disetujui.</p>
            <div className="loader-bar"><span className="loader-progress" /></div>
          </div>
        )}
      </div>
    </div>
  );
}
