"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { UnitOfMeasureListItem } from "@/services/units-of-measure";

type ColumnActions = {
  onEdit: (unit: UnitOfMeasureListItem) => void;
  onDelete: (unit: UnitOfMeasureListItem) => void;
};

export function createColumns(actions: ColumnActions): ColumnDef<UnitOfMeasureListItem>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("name")}</span>
      ),
    },
    {
      accessorKey: "abbreviation",
      header: "Abbreviation",
      cell: ({ row }) => {
        const abbr = row.getValue("abbreviation") as string | null;
        return abbr ? (
          <Badge variant="secondary">{abbr}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "sortOrder",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Sort Order
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <span className="tabular-nums">{row.getValue("sortOrder")}</span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Active",
      cell: ({ row }) => {
        const isActive = row.getValue("isActive") as boolean;
        return isActive ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground" />
        );
      },
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => {
        const notes = row.getValue("notes") as string | null;
        return notes ? (
          <span className="text-muted-foreground text-sm max-w-[200px] truncate block">
            {notes}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const unit = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(unit.id.toString())}
              >
                Copy ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => actions.onEdit(unit)}>
                Edit unit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => actions.onDelete(unit)}
                className="text-destructive focus:text-destructive"
              >
                Delete unit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
