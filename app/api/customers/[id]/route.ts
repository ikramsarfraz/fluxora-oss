import { NextResponse } from "next/server";
import { getCustomerById } from "@/services/customers";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idParam } = await context.params;
    const id = Number(idParam);

    if (Number.isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid customer id" },
        { status: 400 },
      );
    }

    const customer = await getCustomerById(id);

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(customer);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load customer" },
      { status: 500 },
    );
  }
}
