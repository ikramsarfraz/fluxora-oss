import { getCustomers } from "@/services/customers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await getCustomers();
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load customers" },
      { status: 500 },
    );
  }
}
