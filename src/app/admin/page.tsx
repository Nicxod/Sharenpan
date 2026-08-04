import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminDashboard, { type AdminData } from "@/components/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=login");

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/?admin=forbidden");

  const [{ data: products }, { data: orders }, { data: orderItems }, { data: customers }, { data: feedback }] = await Promise.all([
    supabase.from("products").select("id, name, slug, price, stock, status, image_url, created_at").order("created_at", { ascending: false }),
    supabase.from("orders").select("id, order_number, customer_name, customer_email, customer_phone, total, status, payment_status, payment_receipt_url, payment_reference, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("order_items").select("product_id, product_name, quantity, subtotal").limit(2000),
    supabase.from("profiles").select("id, full_name, phone, role, created_at").order("created_at", { ascending: false }).limit(1000),
    supabase.from("customer_feedback").select("id, order_id, customer_name, customer_email, rating_score, message, created_at").order("created_at", { ascending: false }).limit(500),
  ]);

  const data: AdminData = {
    adminName: profile.full_name || user.email?.split("@")[0] || "Admin",
    products: products ?? [],
    orders: orders ?? [],
    orderItems: orderItems ?? [],
    customers: customers ?? [],
    feedbacks: feedback ?? [],
  };

  return <AdminDashboard initialData={data} />;
}
