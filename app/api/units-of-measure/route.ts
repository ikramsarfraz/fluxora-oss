import { NextResponse } from "next/server";
import { getUnitsOfMeasure, createUnitOfMeasure } from "@/services/units-of-measure";

export async function GET() {
  try {
    const rows = await getUnitsOfMeasure();
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load units of measure" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const unit = await createUnitOfMeasure({
      name: body.name.trim(),
      abbreviation: body.abbreviation?.trim() || null,
      notes: body.notes?.trim() || null,
      sortOrder: body.sortOrder ?? 0,
      isActive: body.isActive ?? true,
    });

    return NextResponse.json(unit, { status: 201 });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Failed to create unit of measure";
    // Check for unique constraint violation
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: "A unit with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
