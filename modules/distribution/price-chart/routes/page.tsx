import { PageHeader } from "@/components/page-header";
import { PriceChartClient } from "../components/price-chart-client";

export default async function PriceChartPage() {
  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Price Chart"
        description="Pick a customer on the left and edit customer-specific prices on the right. Empty fields use the product default price."
      />
      <PriceChartClient />
    </section>
  );
}
