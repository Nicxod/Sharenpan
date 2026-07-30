import { Metadata } from "next";
import OrderTracker from "@/components/order-tracker";

export const metadata: Metadata = {
  title: "Lacak Pesanan | Sharenpan",
  description:
    "Lacak status pesanan lapis legit Sharenpan kamu tanpa perlu login. Cukup masukkan nomor pesanan.",
};

export default function LacakPage() {
  return <OrderTracker />;
}
