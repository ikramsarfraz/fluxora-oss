import UnitsOfMeasure from "@/modules/distribution/units-of-measure/components/units-of-measure-page";
import { SettingsPageHeader } from "@/modules/core/workspace-settings/components/settings-hub/settings-page-header";

export default function UnitsOfMeasureSettingsPage() {
  return (
    <div>
      <SettingsPageHeader
        title="Units of Measure"
        description="Per-product purchase, stock, and sales units. Conversions feed pricing and inventory math."
      />
      <UnitsOfMeasure />
    </div>
  );
}
