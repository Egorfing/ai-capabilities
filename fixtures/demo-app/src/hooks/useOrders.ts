import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

interface OrderFilters {
  page?: number;
  limit?: number;
  status?: "pending" | "shipped" | "delivered" | "cancelled";
}

export function useOrders(filters: OrderFilters = {}) {
  return useQuery({
    queryKey: ["orders", filters],
    queryFn: () => api.get("/api/orders", { params: filters }),
  });
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ["orders", orderId],
    queryFn: () => api.get(`/api/orders/${orderId}`),
    enabled: !!orderId,
  });
}

interface CreateOrderInput {
  items: { productId: string; quantity: number }[];
  shippingAddressId: string;
  paymentMethodId?: string;
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => api.post("/api/orders", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.delete(`/api/orders/${orderId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
