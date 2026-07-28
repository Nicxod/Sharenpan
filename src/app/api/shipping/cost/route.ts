import { NextResponse } from "next/server";

export type ShippingOption = {
  id: string;
  courierName: string;
  serviceName: string;
  description: string;
  cost: number;
  etd: string;
  isFree?: boolean;
};

// Default store origin
const STORE_ORIGIN_CITY = "bandung";
const FREE_SHIPPING_MINIMUM = 500000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { destinationCity = "", weightGram = 500, subtotal = 0 } = body;

    const cityLower = destinationCity.toLowerCase().trim();
    const weightKg = Math.max(1, Math.ceil(weightGram / 1000));
    const apiKey = process.env.RAJAONGKIR_API_KEY || process.env.NEXT_PUBLIC_RAJAONGKIR_API_KEY || "";

    const options: ShippingOption[] = [];
    const isBandungArea =
      cityLower.includes("bandung") || cityLower.includes("cimahi") || cityLower.includes("kbb");

    // 1. Instant Courier for Local Bandung & Cimahi
    if (isBandungArea) {
      const isFree = subtotal >= FREE_SHIPPING_MINIMUM;
      options.push({
        id: "gosend_instant",
        courierName: "GoSend / GrabExpress",
        serviceName: "Instant (1-2 Jam)",
        description: "Pengiriman langsung dari dapur Sharenpan Bandung",
        cost: isFree ? 0 : 20000,
        etd: "Hari ini (1-2 jam)",
        isFree,
      });

      options.push({
        id: "gosend_sameday",
        courierName: "GoSend / GrabExpress",
        serviceName: "Same Day",
        description: "Tiba di hari yang sama khusus area Bandung",
        cost: isFree ? 0 : 14000,
        etd: "Hari ini (6-8 jam)",
        isFree,
      });
    }

    // 2. Try fetching live API (Binderbyte / RajaOngkir)
    let fetchedLiveApi = false;
    if (apiKey && cityLower && !isBandungArea) {
      try {
        // Binderbyte Cost API test
        const binderUrl = `https://api.binderbyte.com/v1/cost?api_key=${apiKey}&courier=jne&origin=${STORE_ORIGIN_CITY}&destination=${encodeURIComponent(
          cityLower
        )}&weight=${weightKg}`;
        
        const res = await fetch(binderUrl, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 200 && data.data && data.data.costs) {
            data.data.costs.forEach((costItem: { service: string; description?: string; cost: Array<{ value: number; etd?: string }> }, idx: number) => {
              const price = costItem.cost[0]?.value || 25000;
              const etdRaw = costItem.cost[0]?.etd || "1-2 hari";
              options.push({
                id: `jne_live_${idx}`,
                courierName: "JNE Express",
                serviceName: `JNE ${costItem.service}`,
                description: costItem.description || "Pengiriman cepat khusus lapis legit fresh",
                cost: price * weightKg,
                etd: `${etdRaw} hari`,
              });
            });
            fetchedLiveApi = true;
          }
        }
      } catch (err) {
        console.warn("Binderbyte API Live cost fetch failed, using smart fallback rates:", err);
      }
    }

    // 3. Smart Rate Calculator Fallback (If not local Bandung & Live API not returned)
    if (!fetchedLiveApi && !isBandungArea) {
      const isJabodetabek =
        cityLower.includes("jakarta") ||
        cityLower.includes("bogor") ||
        cityLower.includes("depok") ||
        cityLower.includes("tangerang") ||
        cityLower.includes("bekasi");

      const isJawa =
        isJabodetabek ||
        cityLower.includes("semarang") ||
        cityLower.includes("surabaya") ||
        cityLower.includes("yogyakarta") ||
        cityLower.includes("solo") ||
        cityLower.includes("malang") ||
        cityLower.includes("cirebon") ||
        cityLower.includes("sukabumi") ||
        cityLower.includes("tasikmalaya");

      // JNE YES (Yakin Esok Sampai - 1 Hari)
      const yesRatePerKg = isJabodetabek ? 22000 : isJawa ? 28000 : 42000;
      options.push({
        id: "jne_yes",
        courierName: "JNE Express",
        serviceName: "JNE YES (1 Hari Sampai)",
        description: "Sangat direkomendasikan untuk Lapis Legit fresh luar kota",
        cost: yesRatePerKg * weightKg,
        etd: "1 Hari (Esok Tiba)",
      });

      // SiCepat BEST (1 Hari Sampai)
      const sicepatRatePerKg = isJabodetabek ? 19000 : isJawa ? 25000 : 38000;
      options.push({
        id: "sicepat_best",
        courierName: "SiCepat",
        serviceName: "SiCepat BEST (Besok Sampai Tujuan)",
        description: "Pengiriman cepat khusus makanan",
        cost: sicepatRatePerKg * weightKg,
        etd: "1 Hari",
      });

      // J&T Express
      const jntRatePerKg = isJabodetabek ? 18000 : isJawa ? 24000 : 36000;
      options.push({
        id: "jnt_ez",
        courierName: "J&T Express",
        serviceName: "J&T EZ Express",
        description: "Pengiriman reguler terpercaya",
        cost: jntRatePerKg * weightKg,
        etd: "1-2 Hari",
      });
    }

    return NextResponse.json({
      success: true,
      origin: "Kota Bandung",
      destination: destinationCity,
      weightGram,
      weightKg,
      options,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Gagal menghitung ongkos kirim" },
      { status: 500 }
    );
  }
}
