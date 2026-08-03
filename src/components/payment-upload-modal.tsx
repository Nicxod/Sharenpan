"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const money = (val: number) => `Rp${val.toLocaleString("id-ID")}`;

export default function PaymentUploadModal({
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setErrorMessage("Harap unggah file berupa gambar (JPG, PNG).");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage("Ukuran gambar maksimal 5 MB.");
        return;
      }
      setErrorMessage("");
      setReceiptFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  async function processPayment() {
    if (!receiptFile) {
      setErrorMessage("Anda belum mengunggah bukti pembayaran.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const supabase = createClient();
      
      // Upload file to receipts bucket
      const extension = receiptFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `qris/${orderNumber}-${Date.now()}.${extension}`;
      
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(filePath, receiptFile, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        // Fallback to product-images if receipts bucket fails/doesn't exist
        const { error: fallbackError } = await supabase.storage
          .from("product-images")
          .upload(filePath, receiptFile, { cacheControl: "3600", upsert: false });
          
        if (fallbackError) {
          throw new Error("Gagal mengunggah bukti bayar: " + fallbackError.message);
        }
      }

      // Get public URL
      const bucket = uploadError ? "product-images" : "receipts";
      const receiptUrl = supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;

      // Update order
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: "pending_verification",
          payment_receipt_url: receiptUrl,
          payment_reference: `QRIS-${Date.now().toString().slice(-6)}`,
        })
        .eq("id", orderId);

      if (error) {
        throw new Error(error.message);
      } else {
        setStep("success");
        setTimeout(() => {
          onSuccess();
        }, 3000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memproses pembayaran. Coba lagi.");
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
        style={{ maxWidth: "500px" }}
      >
        <button className="modal-close" onClick={onClose} aria-label="Tutup">
          ×
        </button>

        {step === "pay" && (
          <>
            <div className="payment-modal-header" style={{ paddingBottom: "16px" }}>
              <span className="payment-badge-secure">🔒 QRIS Pembayaran Resmi</span>
              <h2 id="payment-title">Pembayaran QRIS</h2>
              <p className="payment-order-sub">
                Pesanan <strong>#{orderNumber}</strong> • Tagihan: <span className="highlight-price">{money(totalAmount)}</span>
              </p>
            </div>

            <div className="qris-box" style={{ marginTop: 0 }}>
              <p className="qris-desc" style={{ marginBottom: "16px" }}>Silakan scan QRIS di bawah ini menggunakan M-Banking atau E-Wallet (GoPay, OVO, ShopeePay, DANA) Anda.</p>
              
              <div className="qris-image-container" style={{ textAlign: "center", marginBottom: "20px", background: "#fff", padding: "16px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <img src="/assets/qris.jpg" alt="QRIS Sharenpan" style={{ maxWidth: "100%", maxHeight: "300px", objectFit: "contain" }} />
              </div>
              
              <div className="upload-receipt-section">
                <p className="qris-desc" style={{ marginBottom: "8px", fontWeight: 600 }}>Unggah Bukti Pembayaran</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                    className="file-input" 
                    style={{ padding: "8px", border: "1px dashed var(--line)", borderRadius: "4px", width: "100%", cursor: "pointer" }}
                  />
                  
                  {previewUrl && (
                    <div style={{ textAlign: "center", border: "1px solid var(--line)", borderRadius: "4px", padding: "4px" }}>
                      <img src={previewUrl} alt="Preview Bukti" style={{ maxHeight: "150px", objectFit: "contain" }} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {errorMessage && <p className="form-message" style={{ marginTop: "16px" }}>{errorMessage}</p>}

            <div className="payment-actions stack-actions" style={{ marginTop: "24px" }}>
              <button
                className="primary-button full-button"
                disabled={loading || !receiptFile}
                onClick={processPayment}
                style={{ opacity: (!receiptFile || loading) ? 0.5 : 1, cursor: (!receiptFile || loading) ? "not-allowed" : "pointer" }}
              >
                {loading ? "Mengunggah Bukti..." : "Kirim Bukti Pembayaran"}
              </button>
              <small className="secure-footnote">Tim kami akan memverifikasi pembayaran Anda segera setelah bukti dikirim.</small>
            </div>
          </>
        )}

        {step === "success" && (
          <div className="payment-success-box">
            <div className="success-icon-animated">✓</div>
            <h3>Bukti Terkirim!</h3>
            <p>Terima kasih. Pesanan Anda <strong>#{orderNumber}</strong> sedang menunggu verifikasi pembayaran oleh tim Dapur Sharenpan.</p>
            <div className="loader-bar"><span className="loader-progress"></span></div>
          </div>
        )}
      </div>
    </div>
  );
}
