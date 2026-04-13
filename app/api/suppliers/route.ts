import { getSuppliers } from "@/services/suppliers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await getSuppliers();
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load suppliers" },
      { status: 500 },
    );
  }
}
