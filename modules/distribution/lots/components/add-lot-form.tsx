"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateLot } from "../hooks/use-lots";
import { useSuppliers } from "@/modules/distribution/suppliers/hooks/use-suppliers";

import {
  addLotFormSchema,
  type AddLotFormValues,
} from "./add-lot-form.schema";

const defaultForm: AddLotFormValues = {
  lotNumber: "",
  supplierId: "",
  receiveDate: "",
  expirationDate: "",
};

export default function AddLotForm() {
  const router = useRouter();
  const createLot = useCreateLot();
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers();

  const form = useForm<AddLotFormValues>({
    resolver: zodResolver(addLotFormSchema),
    defaultValues: defaultForm,
  });

  async function onSubmit(data: AddLotFormValues) {
    try {
      await createLot.mutateAsync(data);
      form.reset(defaultForm);
      toast.success(`Lot "${data.lotNumber}" created.`);
      router.push("/inventory/lots");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create lot.",
      );
    }
  }

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="pt-6">
        <form id="form-add-lot" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="lotNumber"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-lot-number">
                    Lot number *
                  </FieldLabel>
                  <Input
                    {...field}
                    id="form-add-lot-number"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. LOT-2026-0001"
                    autoFocus
                  />
                  <FieldDescription>
                    Used for USDA traceability. Must be unique per tenant.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="supplierId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-lot-supplier">
                    Supplier *
                  </FieldLabel>
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                    disabled={suppliersLoading}
                  >
                    <SelectTrigger
                      id="form-add-lot-supplier"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue
                        placeholder={
                          suppliersLoading
                            ? "Loading suppliers..."
                            : "Select a supplier"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(suppliers ?? []).map(supplier => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="receiveDate"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-lot-receive-date">
                    Receive date *
                  </FieldLabel>
                  <Input
                    {...field}
                    id="form-add-lot-receive-date"
                    type="date"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="expirationDate"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-lot-expiration-date">
                    Expiration date *
                  </FieldLabel>
                  <Input
                    {...field}
                    id="form-add-lot-expiration-date"
                    type="date"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    Lots are picked FEFO (first expired, first out).
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 border-t pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/inventory/lots")}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="form-add-lot"
          disabled={createLot.isPending}
        >
          {createLot.isPending ? "Adding…" : "Add lot"}
        </Button>
      </CardFooter>
    </Card>
  );
}
