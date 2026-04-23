import { NextResponse } from "next/server";
import {
  getUnitOfMeasureById,
  updateUnitOfMeasure,
  deleteUnitOfMeasure,
} from "@/services/units-of-measure";
import { isUuid } from "@/lib/utils/uuid";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idParam } = await context.params;
    if (!isUuid(idParam)) {
      return NextResponse.json(
        { error: "Invalid unit of measure id" },
        { status: 400 },
      );
    }

    const unit = await getUnitOfMeasureById(idParam);

    if (!unit) {
      return NextResponse.json(
        { error: "Unit of measure not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(unit);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load unit of measure" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idParam } = await context.params;
    if (!isUuid(idParam)) {
      return NextResponse.json(
        { error: "Invalid unit of measure id" },
        { status: 400 },
      );
    }

    const body = await req.json();

    const unit = await updateUnitOfMeasure(idParam, {
      name: body.name?.trim(),
      abbreviation:
        body.abbreviation !== undefined
          ? body.abbreviation?.trim() || null
          : undefined,
      notes: body.notes !== undefined ? body.notes?.trim() || null : undefined,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
    });

    if (!unit) {
      return NextResponse.json(
        { error: "Unit of measure not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(unit);
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error ? err.message : "Failed to update unit of measure";
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: "A unit with this name already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idParam } = await context.params;
    if (!isUuid(idParam)) {
      return NextResponse.json(
        { error: "Invalid unit of measure id" },
        { status: 400 },
      );
    }

    await deleteUnitOfMeasure(idParam);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to delete unit of measure" },
      { status: 500 },
    );
  }
}
