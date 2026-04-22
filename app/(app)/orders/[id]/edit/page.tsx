import { notFound } from "next/navigation";

import { isUuid } from "@/lib/utils/uuid";

import { OrderEditForm } from "../../components/order-edit-form";

export default async function EditSalesOrderRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  return <OrderEditForm orderId={id} />;
}
