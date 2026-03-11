import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

interface ProductSearchParams {
  q?: string;
  category?: string;
}

export function useProducts(params: ProductSearchParams = {}) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: () => api.get("/api/products", { params }),
  });
}

export function useProductDetails(productId: string) {
  return useQuery({
    queryKey: ["products", productId],
    queryFn: () => api.get(`/api/products/${productId}`),
    enabled: !!productId,
  });
}
