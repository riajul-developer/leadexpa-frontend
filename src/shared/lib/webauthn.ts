import { useSyncExternalStore } from "react";

import type { Schemas } from "./api/client";

// Browsers without the WebAuthn JSON helpers (Safari < 17.4) get hand conversion.

export type WebAuthnOptions = Schemas["WebAuthnOptions"];
export type WebAuthnCredential = Schemas["WebAuthnCredential"];

export class PasskeyCancelled extends Error {
  constructor() {
    super("passkey cancelled");
    this.name = "PasskeyCancelled";
  }
}

export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function" && !!navigator.credentials;
}

const noSubscribe = () => () => undefined;

/** false during server rendering and hydration, then the real answer. */
export function usePasskeysSupported(): boolean {
  return useSyncExternalStore(noSubscribe, passkeysSupported, () => false);
}

function fromB64url(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function toB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

type Descriptor = { id: string; type: "public-key"; transports?: AuthenticatorTransport[] };
type JSONOptions = Record<string, unknown> & {
  challenge: string;
  user?: { id: string; name: string; displayName: string };
  excludeCredentials?: Descriptor[];
  allowCredentials?: Descriptor[];
};

const descriptors = (list?: Descriptor[]) => list?.map((c) => ({ ...c, id: fromB64url(c.id) }));

function credentialJSON(cred: PublicKeyCredential): WebAuthnCredential {
  if (typeof cred.toJSON === "function") return cred.toJSON() as WebAuthnCredential;
  const r = cred.response;
  const response: Record<string, unknown> = { clientDataJSON: toB64url(r.clientDataJSON) };
  if (r instanceof AuthenticatorAttestationResponse) {
    response.attestationObject = toB64url(r.attestationObject);
    response.transports = r.getTransports?.() ?? [];
  } else {
    const a = r as AuthenticatorAssertionResponse;
    response.authenticatorData = toB64url(a.authenticatorData);
    response.signature = toB64url(a.signature);
    if (a.userHandle) response.userHandle = toB64url(a.userHandle);
  }
  return {
    id: cred.id,
    rawId: toB64url(cred.rawId),
    type: "public-key",
    response,
    clientExtensionResults: cred.getClientExtensionResults(),
  } as WebAuthnCredential;
}

function cancelled(e: unknown): boolean {
  return e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "AbortError");
}

export async function createPasskey(options: WebAuthnOptions): Promise<WebAuthnCredential> {
  const pk = options.publicKey as JSONOptions;
  const publicKey: PublicKeyCredentialCreationOptions =
    typeof PublicKeyCredential.parseCreationOptionsFromJSON === "function"
      ? PublicKeyCredential.parseCreationOptionsFromJSON(pk as unknown as PublicKeyCredentialCreationOptionsJSON)
      : ({
          ...pk,
          challenge: fromB64url(pk.challenge),
          user: { ...pk.user!, id: fromB64url(pk.user!.id) },
          excludeCredentials: descriptors(pk.excludeCredentials),
        } as unknown as PublicKeyCredentialCreationOptions);
  try {
    const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
    if (!cred) throw new PasskeyCancelled();
    return credentialJSON(cred);
  } catch (e) {
    throw cancelled(e) ? new PasskeyCancelled() : e;
  }
}

export async function getPasskey(options: WebAuthnOptions): Promise<WebAuthnCredential> {
  const pk = options.publicKey as JSONOptions;
  const publicKey: PublicKeyCredentialRequestOptions =
    typeof PublicKeyCredential.parseRequestOptionsFromJSON === "function"
      ? PublicKeyCredential.parseRequestOptionsFromJSON(pk as unknown as PublicKeyCredentialRequestOptionsJSON)
      : ({
          ...pk,
          challenge: fromB64url(pk.challenge),
          allowCredentials: descriptors(pk.allowCredentials),
        } as unknown as PublicKeyCredentialRequestOptions);
  try {
    const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
    if (!cred) throw new PasskeyCancelled();
    return credentialJSON(cred);
  } catch (e) {
    throw cancelled(e) ? new PasskeyCancelled() : e;
  }
}
