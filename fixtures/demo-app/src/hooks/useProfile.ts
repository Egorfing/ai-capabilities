import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["user", "me"],
    queryFn: () => api.get("/api/users/me"),
  });
}

interface UpdateProfileInput {
  name?: string;
  email?: string;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfileInput) => api.patch("/api/users/me", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}
