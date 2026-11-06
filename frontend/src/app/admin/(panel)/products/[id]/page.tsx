"use client";

import { useParams } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { Alert, Spinner } from "@/components/ui";
import type { Product } from "@/lib/types";
import { useData } from "@/lib/use-data";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useData<{ product: Product }>(`/admin/products/${id}`);
  if (error) return <Alert>{error.message}</Alert>;
  if (!data) return <div className="flex justify-center py-20 text-gray-400"><Spinner className="h-6 w-6" /></div>;
  return <ProductForm key={data.product.id} initial={data.product} />;
}
