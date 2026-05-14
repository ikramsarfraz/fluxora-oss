import Categories from "@/modules/distribution/categories/components/categories-page";
import { SettingsPageHeader } from "@/modules/core/workspace-settings/components/settings-hub/settings-page-header";

export default function CategoriesSettingsPage() {
  return (
    <div>
      <SettingsPageHeader
        title="Categories"
        description="Group products into categories used by the price chart, inventory, and reports."
      />
      <Categories />
    </div>
  );
}
