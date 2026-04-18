"use client";

import { SectionCards } from "./components/section-cards";
import { ChartAreaInteractive } from "./components/chart-area-interactive";
import { PageHeader } from "@/components/page-header";

export default function Home() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-4">
      <div className="px-4 pt-2 lg:px-6">
        <PageHeader
          title="Dashboard"
          description="Overview of your distribution operations and key metrics."
        />
      </div>
      <div className="flex flex-col gap-6">
        <SectionCards />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
      </div>
    </div>
  );
}
