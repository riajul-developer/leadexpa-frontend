"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";

export type HoldingGroup = Schemas["HoldingGroup"];
export type HoldingGroupDetail = Schemas["HoldingGroupDetail"];
export type HoldingGroupReport = Schemas["HoldingGroupReport"];
export type HoldingGroupReportLine = Schemas["HoldingGroupReportLine"];
export type HoldingGroupEligible = Schemas["HoldingGroupEligible"];
export type HoldingGroupInviteCreated = Schemas["HoldingGroupInviteCreated"];
export type AgencyGroupLink = Schemas["AgencyGroupLink"];

export const groupsKey = ["groups"] as const;
export const groupKey = (id: string) => ["groups", id] as const;
export const agencyGroupKey = ["agency-group"] as const;

export function useMyGroups() {
  return useQuery({ queryKey: groupsKey, queryFn: () => unwrap(api.GET("/v1/groups")) });
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: groupKey(id),
    queryFn: () => unwrap(api.GET("/v1/groups/{id}", { params: { path: { id } } })),
  });
}

export function useGroupReport(id: string, from: string, to: string) {
  return useQuery({
    queryKey: [...groupKey(id), "report", from, to],
    queryFn: () => unwrap(api.GET("/v1/groups/{id}/report", { params: { path: { id }, query: { from, to } } })),
    placeholderData: keepPreviousData,
  });
}

export function useEligibleMembers(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...groupKey(id), "eligible"],
    queryFn: () => unwrap(api.GET("/v1/groups/{id}/eligible-members", { params: { path: { id } } })),
    enabled,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; reporting_currency?: string }) => unwrap(api.POST("/v1/groups", { body })),
    meta: { silent: true },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: groupsKey });
      qc.invalidateQueries({ queryKey: agencyGroupKey });
    },
  });
}

export function useGroupActions(id: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: groupKey(id) });
  const path = { params: { path: { id } } };
  return {
    update: useMutation({
      mutationFn: (body: { name: string; reporting_currency: string }) =>
        unwrap(api.PATCH("/v1/groups/{id}", { ...path, body })),
      meta: { silent: true },
      onSuccess: () => {
        refresh();
        qc.invalidateQueries({ queryKey: groupsKey });
      },
    }),
    invite: useMutation({
      mutationFn: () => unwrap(api.POST("/v1/groups/{id}/invites", path)),
      onSuccess: refresh,
    }),
    revokeInvite: useMutation({
      mutationFn: (inviteId: string) =>
        unwrapEmpty(api.DELETE("/v1/groups/{id}/invites/{inviteId}", { params: { path: { id, inviteId } } })),
      onSuccess: refresh,
    }),
    removeAgency: useMutation({
      mutationFn: (agencyId: string) =>
        unwrapEmpty(api.DELETE("/v1/groups/{id}/agencies/{agencyId}", { params: { path: { id, agencyId } } })),
      onSuccess: refresh,
    }),
    setMember: useMutation({
      mutationFn: ({ userId, role }: { userId: string; role: "owner" | "analyst" }) =>
        unwrapEmpty(api.PUT("/v1/groups/{id}/members/{userId}", { params: { path: { id, userId } }, body: { role } })),
      meta: { silent: true },
      onSuccess: refresh,
    }),
    removeMember: useMutation({
      mutationFn: (userId: string) =>
        unwrapEmpty(api.DELETE("/v1/groups/{id}/members/{userId}", { params: { path: { id, userId } } })),
      meta: { silent: true },
      onSuccess: () => {
        refresh();
        qc.invalidateQueries({ queryKey: groupsKey });
      },
    }),
    disband: useMutation({
      mutationFn: () => unwrapEmpty(api.DELETE("/v1/groups/{id}", path)),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: groupsKey });
        qc.invalidateQueries({ queryKey: agencyGroupKey });
      },
    }),
  };
}

export function useAgencyGroup() {
  return useQuery({ queryKey: agencyGroupKey, queryFn: () => unwrap(api.GET("/v1/agencies/current/group")) });
}

export function useAgencyGroupActions() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: agencyGroupKey });
    qc.invalidateQueries({ queryKey: groupsKey });
  };
  return {
    join: useMutation({
      mutationFn: (code: string) => unwrap(api.POST("/v1/agencies/current/group", { body: { code } })),
      meta: { silent: true },
      onSuccess: refresh,
    }),
    leave: useMutation({
      mutationFn: () => unwrapEmpty(api.DELETE("/v1/agencies/current/group")),
      onSuccess: refresh,
    }),
  };
}
