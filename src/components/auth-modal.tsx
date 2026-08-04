"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup" | "forgot";

export default function AuthModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
  }

  async function redirectByRole(supabase: ReturnType<typeof createClient>) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };
    window.location.href = profile?.role === "admin" ? "/admin" : "/customer";
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      setMessage(error ? error.message : "Link reset password sudah dikirim. Cek email Anda.");
    } else if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: name.trim(), phone: phone.trim() } },
      });
      if (error) setMessage(error.message);
      else if (!data.session) setMessage("Akun dibuat. Cek email untuk konfirmasi, lalu masuk.");
      else {
        onSuccess?.();
        await redirectByRole(supabase);
      }
    } else {
      let loginEmail = identifier.trim().toLowerCase();
      if (!loginEmail.includes("@")) {
        const { data: lookup } = await supabase.rpc("find_email_by_phone", { phone_input: loginEmail });
        loginEmail = lookup || "";
      }
      const { error } = loginEmail
        ? await supabase.auth.signInWithPassword({ email: loginEmail, password })
        : { error: new Error("Akun tidak ditemukan") };
      if (error) setMessage("Email/nomor telepon atau password belum benar.");
      else {
        onSuccess?.();
        await redirectByRole(supabase);
      }
    }
    setLoading(false);
  }

  const isForgot = mode === "forgot";
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Tutup">×</button>
        <p className="eyebrow">{isForgot ? "Pemulihan akun" : "Pesanan lebih mudah"}</p>
        <h2 id="auth-title">{mode === "login" ? "Selamat datang kembali." : mode === "signup" ? "Buat akun Sharenpan." : "Atur ulang password."}</h2>
        <p className="modal-description">{isForgot ? "Masukkan email akun Anda. Kami akan mengirimkan link untuk membuat password baru." : "Daftar atau masuk terlebih dahulu untuk menyimpan pesanan dan melihat riwayat pembelian."}</p>
        {!isForgot && <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Masuk</button><button className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>Daftar</button></div>}
        <form onSubmit={submit} className="stack-form">
          {mode === "signup" && <><label>Nama lengkap<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} /></label><label>Nomor telepon<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08xxxxxxxxxx" required /></label><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label></>}
          {mode === "login" && <label>Email atau nomor telepon<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="email atau 08xxxxxxxxxx" required /></label>}
          {isForgot && <label>Email akun<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>}
          {mode !== "forgot" && <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} /></label>}
          {message && <p className="form-message">{message}</p>}
          <button className="primary-button full-button" disabled={loading}>{loading ? "Memproses..." : isForgot ? "Kirim link reset" : mode === "login" ? "Masuk ke akun" : "Buat akun"}<span>→</span></button>
        </form>
        {mode === "login" && <button className="forgot-link" onClick={() => changeMode("forgot")}>Lupa password?</button>}
        {isForgot && <button className="back-auth-link" onClick={() => changeMode("login")}>← Kembali ke login</button>}
      </section>
    </div>
  );
}
