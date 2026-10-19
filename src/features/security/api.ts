"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { meKey } from "@/shared/lib/session";
import { createPasskey, getPasskey } from "@/shared/lib/webauthn";

export type SecurityOverview = Schemas["SecurityOverview"];
export type Session = Schemas["Session"];
export type MFAMethod = Schemas["MFAMethod"];

export const securityKey = ["security"] as const;
export const sessionsKey = ["sessions"] as const;

export function useSecurity() {
  return useQuery({ queryKey: securityKey, queryFn: () => unwrap(api.GET("/v1/me/security")) });
}

export function useSessions() {
  return useQuery({ queryKey: sessionsKey, queryFn: () => unwrap(api.GET("/v1/me/sessions")) });
}

export function methodsOf(s: SecurityOverview | undefined): MFAMethod[] {
  if (!s) return [];
  const m: MFAMethod[] = [];
  if (s.passkeys.length > 0) m.push("passkey");
  if (s.totp_enabled) m.push("totp");
  if (s.recovery_codes_remaining > 0) m.push("recovery_code");
  return m;
}

/** me: false holds /me back so a lifted gate can't unmount on-screen recovery codes. */
export function useRefreshSecurity() {
  const qc = useQueryClient();
  return ({ me = true }: { me?: boolean } = {}) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: securityKey }),
      qc.invalidateQueries({ queryKey: sessionsKey }),
      me ? qc.invalidateQueries({ queryKey: meKey }) : undefined,
    ]);
}

export function useVerifySession() {
  const refresh = useRefreshSecurity();
  return useMutation({
    mutationFn: async (p: { method: MFAMethod; code?: string }) => {
      if (p.method !== "passkey") {
        return unwrapEmpty(api.POST("/v1/me/security/verify", { body: { method: p.method, code: p.code } }));
      }
      const ceremony = await unwrap(api.POST("/v1/me/security/verify/passkey-options"));
      const credential = await getPasskey(ceremony.options);
      return unwrapEmpty(
        api.POST("/v1/me/security/verify", {
          body: { method: "passkey", challenge_id: ceremony.challenge_id, credential },
        }),
      );
    },
    meta: { silent: true },
    onSuccess: () => refresh(),
  });
}

export function useAddPasskey() {
  const refresh = useRefreshSecurity();
  return useMutation({
    mutationFn: async (name: string) => {
      const ceremony = await unwrap(api.POST("/v1/me/security/passkeys/options"));
      const credential = await createPasskey(ceremony.options);
      return unwrap(
        api.POST("/v1/me/security/passkeys", {
          body: { challenge_id: ceremony.challenge_id, name: name.trim(), credential },
        }),
      );
    },
    meta: { silent: true },
    onSuccess: () => refresh({ me: false }),
  });
}
