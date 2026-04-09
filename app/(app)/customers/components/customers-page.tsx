"use client";

import Link from "next/link";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, endpoints, type Customer } from "@/lib/api";
import type { CustomerListItem } from "@/services/customers";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCustomers } from "@/hooks/use-customers";

const createCustomerSchema = z.object({
  name: z
    .string()
    .transform(s => s.trim())
    .pipe(z.string().min(1, "Please enter a customer name.")),
  street: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  phoneNumber: z.string(),
});

type CreateCustomerValues = z.infer<typeof createCustomerSchema>;

export default function Customers() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const createForm = useForm<CreateCustomerValues>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      name: "",
      street: "",
      city: "",
      state: "",
      zip: "",
      phoneNumber: "",
    },
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editStreet, setEditStreet] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editZip, setEditZip] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");

  //   const {
  //     data: customers,
  //     isLoading,
  //     error: loadError,
  //   } = useQuery<CustomerListItem[]>({
  //     queryKey: ["customers"],
  //     queryFn: async () => {
  //       const res = await fetch("/api/customers", { credentials: "include" });
  //       if (!res.ok) {
  //         const msg = await res.text();
  //         throw new Error(msg || `Failed to load customers (${res.status})`);
  //       }
  //       return res.json() as Promise<CustomerListItem[]>;
  //     },
  //   });

  const { data: customers, isLoading, error: loadError } = useCustomers();

  console.log(customers);

  const updateCustomer = useMutation({
    mutationFn: (input: {
      id: number;
      body: {
        name?: string;
        street?: string | null;
        city?: string | null;
        state?: string | null;
        zip?: string | null;
        phone_number?: string | null;
      };
    }) => api.patch<Customer>(endpoints.customers.update(input.id), input.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["price-chart"] });
      setEditId(null);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const createCustomer = useMutation({
    mutationFn: (body: {
      name: string;
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      phone_number?: string;
    }) => api.post<Customer>(endpoints.customers.create(), body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["price-chart"] });
      createForm.reset();
      setError(null);
      toast.success("Customer added");
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteCustomer = useMutation({
    mutationFn: (id: number) => api.delete(endpoints.customers.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["price-chart"] });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  function onCreateSubmit(data: CreateCustomerValues) {
    setError(null);
    createCustomer.mutate({
      name: data.name,
      street: data.street.trim() || undefined,
      city: data.city.trim() || undefined,
      state: data.state.trim() || undefined,
      zip: data.zip.trim() || undefined,
      phone_number: data.phoneNumber.trim() || undefined,
    });
  }

  const handleDeleteCustomer = (c: CustomerListItem) => {
    if (!window.confirm(`Delete customer ${c.name}? This cannot be undone.`))
      return;
    deleteCustomer.mutate(c.id);
  };

  const startEditCustomer = (c: CustomerListItem) => {
    const addr = c.addresses[0];
    setEditId(c.id);
    setEditName(c.name);
    setEditStreet(addr?.street ?? "");
    setEditCity(addr?.city ?? "");
    setEditState(addr?.state ?? "");
    setEditZip(addr?.zip ?? "");
    setEditPhoneNumber(c.phoneNumber ?? "");
    setError(null);
  };

  const cancelEditCustomer = () => {
    setEditId(null);
    setError(null);
  };

  const handleSaveCustomer = (c: CustomerListItem) => {
    if (!editName.trim()) {
      setError("Customer name is required.");
      return;
    }
    updateCustomer.mutate({
      id: c.id,
      body: {
        name: editName.trim(),
        street: editStreet.trim() || null,
        city: editCity.trim() || null,
        state: editState.trim() || null,
        zip: editZip.trim() || null,
        phone_number: editPhoneNumber.trim() || null,
      },
    });
  };

  if (isLoading) return <div className="loading">Loading customers…</div>;
  if (loadError)
    return (
      <div className="error">
        Failed to load: {(loadError as Error).message}
      </div>
    );

  return (
    <>
      <h1>Customers</h1>
      <p className="weight-label">Add and view customers for sales orders.</p>

      {/* Add customer form */}
      <section
        className="card form-card"
        aria-labelledby="add-customer-heading"
      >
        <Card className="w-full max-w-xl border-0 bg-transparent p-0 shadow-none ring-0">
          <CardHeader className="px-0 pt-0">
            <CardTitle id="add-customer-heading" className="text-[1.1rem]">
              Add customer
            </CardTitle>
            <CardDescription>
              Create a customer record for sales orders and pricing.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <form
              id="form-add-customer"
              onSubmit={createForm.handleSubmit(onCreateSubmit)}
            >
              <FieldGroup>
                <Controller
                  name="name"
                  control={createForm.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-add-customer-name">
                        Customer name *
                      </FieldLabel>
                      <Input
                        {...field}
                        id="form-add-customer-name"
                        aria-invalid={fieldState.invalid}
                        placeholder="e.g. Acme Meats Inc."
                        autoComplete="organization"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="street"
                  control={createForm.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-add-customer-street">
                        Street
                      </FieldLabel>
                      <Input
                        {...field}
                        id="form-add-customer-street"
                        aria-invalid={fieldState.invalid}
                        placeholder="Street address"
                        autoComplete="street-address"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <div className="flex flex-wrap gap-4">
                  <Controller
                    name="city"
                    control={createForm.control}
                    render={({ field, fieldState }) => (
                      <Field
                        data-invalid={fieldState.invalid}
                        className="min-w-40 max-w-50 flex-1"
                      >
                        <FieldLabel htmlFor="form-add-customer-city">
                          City
                        </FieldLabel>
                        <Input
                          {...field}
                          id="form-add-customer-city"
                          aria-invalid={fieldState.invalid}
                          placeholder="City"
                          autoComplete="address-level2"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                  <Controller
                    name="state"
                    control={createForm.control}
                    render={({ field, fieldState }) => (
                      <Field
                        data-invalid={fieldState.invalid}
                        className="max-w-30"
                      >
                        <FieldLabel htmlFor="form-add-customer-state">
                          State
                        </FieldLabel>
                        <Input
                          {...field}
                          id="form-add-customer-state"
                          aria-invalid={fieldState.invalid}
                          placeholder="State"
                          autoComplete="address-level1"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                  <Controller
                    name="zip"
                    control={createForm.control}
                    render={({ field, fieldState }) => (
                      <Field
                        data-invalid={fieldState.invalid}
                        className="max-w-25"
                      >
                        <FieldLabel htmlFor="form-add-customer-zip">
                          ZIP
                        </FieldLabel>
                        <Input
                          {...field}
                          id="form-add-customer-zip"
                          aria-invalid={fieldState.invalid}
                          placeholder="ZIP"
                          autoComplete="postal-code"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </div>
                <Controller
                  name="phoneNumber"
                  control={createForm.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-add-customer-phone">
                        Phone number
                      </FieldLabel>
                      <Input
                        {...field}
                        id="form-add-customer-phone"
                        type="tel"
                        aria-invalid={fieldState.invalid}
                        placeholder="e.g. (555) 123-4567"
                        autoComplete="tel"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                {error && (
                  <div className="text-sm text-destructive" role="alert">
                    {error}
                  </div>
                )}
              </FieldGroup>
            </form>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center gap-2 border-0 bg-transparent px-0 pt-0">
            <Field orientation="horizontal" className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => createForm.reset()}
              >
                Reset
              </Button>
              <Button
                type="submit"
                form="form-add-customer"
                disabled={createCustomer.isPending}
              >
                {createCustomer.isPending ? "Adding…" : "Add customer"}
              </Button>
            </Field>
          </CardFooter>
        </Card>
      </section>

      {/* Customer list */}
      <section
        className="table-section"
        aria-labelledby="customers-table-heading"
      >
        <h2
          id="customers-table-heading"
          style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}
        >
          All customers
        </h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Street</th>
                <th>City</th>
                <th>State</th>
                <th>ZIP</th>
                <th>Phone</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(customers ?? []).map(c => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>
                    {editId === c.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        style={{ width: "100%" }}
                      />
                    ) : (
                      <Link href={`/customers/${c.id}`}>{c.name}</Link>
                    )}
                  </td>
                  <td>
                    {editId === c.id ? (
                      <input
                        type="text"
                        value={editStreet}
                        onChange={e => setEditStreet(e.target.value)}
                        style={{ width: "100%" }}
                      />
                    ) : (
                      (c.addresses[0]?.street ?? "—")
                    )}
                  </td>
                  <td>
                    {editId === c.id ? (
                      <input
                        type="text"
                        value={editCity}
                        onChange={e => setEditCity(e.target.value)}
                        style={{ width: "100%" }}
                      />
                    ) : (
                      (c.addresses[0]?.city ?? "—")
                    )}
                  </td>
                  <td>
                    {editId === c.id ? (
                      <input
                        type="text"
                        value={editState}
                        onChange={e => setEditState(e.target.value)}
                        style={{ width: "100%" }}
                      />
                    ) : (
                      (c.addresses[0]?.state ?? "—")
                    )}
                  </td>
                  <td>
                    {editId === c.id ? (
                      <input
                        type="text"
                        value={editZip}
                        onChange={e => setEditZip(e.target.value)}
                        style={{ width: "100%" }}
                      />
                    ) : (
                      (c.addresses[0]?.zip ?? "—")
                    )}
                  </td>
                  <td>
                    {editId === c.id ? (
                      <input
                        type="text"
                        value={editPhoneNumber}
                        onChange={e => setEditPhoneNumber(e.target.value)}
                        style={{ width: "100%" }}
                      />
                    ) : (
                      (c.phoneNumber ?? "—")
                    )}
                  </td>
                  <td>
                    <Link href={`/customers/${c.id}`} className="btn">
                      Profile & prices
                    </Link>
                  </td>
                  <td>
                    {editId === c.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleSaveCustomer(c)}
                          disabled={updateCustomer.isPending}
                          style={{ marginRight: "0.25rem" }}
                        >
                          {updateCustomer.isPending ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={cancelEditCustomer}
                          disabled={updateCustomer.isPending}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => startEditCustomer(c)}
                          disabled={updateCustomer.isPending}
                          style={{ marginRight: "0.25rem" }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleDeleteCustomer(c)}
                          disabled={deleteCustomer.isPending}
                        >
                          {deleteCustomer.isPending &&
                          deleteCustomer.variables === c.id
                            ? "…"
                            : "Delete"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(customers ?? []).length === 0 && (
          <p className="empty-state">No customers yet. Add one above.</p>
        )}
      </section>
    </>
  );
}
