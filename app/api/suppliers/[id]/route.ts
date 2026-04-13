import { NextResponse } from "next/server";
import { getSupplierById } from "@/services/suppliers";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idParam } = await context.params;
    const id = Number(idParam);

    if (Number.isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid supplier id" },
        { status: 400 },
      );
    }

    const supplier = await getSupplierById(id);

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(supplier);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load supplier" },
      { status: 500 },
    );
  }
}
