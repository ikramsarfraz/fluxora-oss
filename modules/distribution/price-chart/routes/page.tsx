import { PageHeader } from "@/components/page-header";
import { PriceChartClient } from "../components/price-chart-client";

export default async function PriceChartPage() {
  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Price Chart"
        description="Pick a customer on the left and edit their pricing on the right. Empty fields mean they pay the default — cost × markup. Type a number to override; clear it to fall back."
      />
      <PriceChartClient />
    </section>
  );
}
