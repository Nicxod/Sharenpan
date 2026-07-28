import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerDashboard, { type CustomerData } from "@/components/customer-dashboard";

export const dynamic = "force-dynamic";

export default async function CustomerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=login");

  const [{ data: profile }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, role").eq("id", user.id).maybeSingle(),
    supabase.from("orders").select("id, order_number, total, subtotal, shipping_fee, status, payment_status, shipping_address, notes, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);

  if (profile?.role === "admin") redirect("/admin");

  const data: CustomerData = {
    name: profile?.full_name || user.email?.split("@")[0] || "Customer",
    email: user.email || "",
    phone: profile?.phone || "Nomor telepon belum diisi",
    orders: orders ?? [],
  };
  return <CustomerDashboard initialData={data} />;
}

