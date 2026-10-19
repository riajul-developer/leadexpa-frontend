"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";

export type Screen = Schemas["WallboardScreen"];
export type ScreenInput = Schemas["WallboardInput"];
export type Paired = Schemas["WallboardPaired"];

const keys = { list: ["wallboards"] as const };
const path = (id: string) => ({ params: { path: { id } } });

export function useScreens() {
  return useQuery({ queryKey: keys.list, queryFn: () => unwrap(api.GET("/v1/wallboards")) });
}

export function useSaveScreen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: ScreenInput }): Promise<Paired | Screen> =>
      id ? unwrap(api.PUT("/v1/wallboards/{id}", { ...path(id), body })) : unwrap(api.POST("/v1/wallboards", { body })),
    meta: { silent: true },
    onSuccess: (_, { id }) => {
      track(id ? "wallboard.updated" : "wallboard.created");
      void qc.invalidateQueries({ queryKey: keys.list });
    },
  });
}

export function useReplaceToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST("/v1/wallboards/{id}/token", path(id))),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list }),
  });
}

export function useDeleteScreen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrapEmpty(api.DELETE("/v1/wallboards/{id}", path(id))),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list }),
  });
}
