import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerDashboard, { type CustomerData } from "@/components/customer-dashboard";

export const dynamic = "force-dynamic";

export default async function CustomerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=login");

  const [{ data: profile }, { data: orders }, { data: vouchers }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, role").eq("id", user.id).maybeSingle(),
    supabase.from("orders").select("id, order_number, total, subtotal, shipping_fee, status, payment_status, shipping_address, notes, desired_delivery_date, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("promo_codes").select("id, code, description, discount_type, discount_value, minimum_purchase, expires_at").eq("active", true).order("created_at", { ascending: false }),
  ]);

  if (profile?.role === "admin") redirect("/admin");

  const orderIds = (orders ?? []).map((order) => order.id);
  const { data: orderItems } = orderIds.length
    ? await supabase.from("order_items").select("order_id, product_name, quantity, unit_price, subtotal").in("order_id", orderIds)
    : { data: [] };

  const data: CustomerData = {
    name: profile?.full_name || user.email?.split("@")[0] || "Customer",
    email: user.email || "",
    phone: profile?.phone || "Nomor telepon belum diisi",
    orders: orders ?? [],
    orderItems: orderItems ?? [],
    vouchers: vouchers ?? [],
  };
  return <CustomerDashboard initialData={data} />;
}
