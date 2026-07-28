"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) { setMessage("Password dan konfirmasi belum sama."); return; }
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setMessage(error ? error.message : "Password berhasil diperbarui.");
    setSuccess(!error);
    setLoading(false);
  }

  return <main className="reset-page"><section className="reset-card"><Link className="brand" href="/"><span className="brand-mark">S</span><span>sharenpan<small>lapis legit premium</small></span></Link><p className="eyebrow">Pemulihan akun</p><h1>Buat password baru.</h1><p>Gunakan password baru untuk kembali masuk ke akun Sharenpan Anda.</p>{success ? <><div className="success-message">{message}</div><Link className="primary-button full-button" href="/">Kembali ke toko <span>→</span></Link></> : <form className="stack-form" onSubmit={submit}><label>Password baru<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label><label>Ulangi password<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={6} required /></label>{message && <p className="form-message">{message}</p>}<button className="primary-button full-button" disabled={loading}>{loading ? "Menyimpan..." : "Simpan password"}<span>→</span></button></form>}</section></main>;
}
