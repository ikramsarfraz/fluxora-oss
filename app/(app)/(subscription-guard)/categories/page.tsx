import Categories from "./components/categories-page";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getProductCategories } from "@/services/products";

export default async function CategoriesPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => getProductCategories(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Categories />
    </HydrationBoundary>
  );
}
