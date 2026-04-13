import { getProducts } from "@/services/products";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await getProducts();
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load products" },
      { status: 500 },
    );
  }
}
