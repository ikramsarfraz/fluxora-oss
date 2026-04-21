import { NextResponse } from "next/server";
import { getProductById } from "@/services/products";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idParam } = await context.params;
    const id = idParam;

    const product = await getProductById(id);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load product" },
      { status: 500 },
    );
  }
}
