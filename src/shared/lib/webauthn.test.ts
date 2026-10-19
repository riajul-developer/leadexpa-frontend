import { afterEach, describe, expect, it, vi } from "vitest";

import { createPasskey, getPasskey, PasskeyCancelled, passkeysSupported } from "./webauthn";

// jsdom has no WebAuthn: these tests cover the hand-conversion path.

const bytes = (...b: number[]) => new Uint8Array(b).buffer;

class FakeAttestation {
  clientDataJSON = bytes(1, 2, 3);
  attestationObject = bytes(0xfb, 0xff); // base64url "-_8"
  getTransports = () => ["internal"];
}
class FakeAssertion {
  clientDataJSON = bytes(4);
  authenticatorData = bytes(5, 6);
  signature = bytes(7);
  userHandle = bytes(8, 9);
}

function install(create?: unknown, get?: unknown) {
  vi.stubGlobal("PublicKeyCredential", function PublicKeyCredential() {});
  vi.stubGlobal("AuthenticatorAttestationResponse", FakeAttestation);
  Object.defineProperty(navigator, "credentials", {
    configurable: true,
    value: { create: vi.fn(create as never), get: vi.fn(get as never) },
  });
}

const credential = (response: unknown) => ({
  id: "AQID",
  rawId: bytes(1, 2, 3),
  type: "public-key",
  response,
  getClientExtensionResults: () => ({}),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("webauthn", () => {
  it("decodes base64url options and encodes the attestation back", async () => {
    install(async (opts: CredentialCreationOptions) => {
      const pk = opts.publicKey!;
      expect(new Uint8Array(pk.challenge as ArrayBuffer)).toEqual(new Uint8Array([0xfb, 0xff]));
      expect(new Uint8Array(pk.user.id as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
      expect(new Uint8Array(pk.excludeCredentials![0]!.id as ArrayBuffer)).toEqual(new Uint8Array([4]));
      return credential(new FakeAttestation());
    });
    expect(passkeysSupported()).toBe(true);
    const out = await createPasskey({
      publicKey: {
        challenge: "-_8",
        user: { id: "AQID", name: "a@b.c", displayName: "A" },
        excludeCredentials: [{ id: "BA", type: "public-key" }],
      },
    });
    expect(out).toMatchObject({
      id: "AQID",
      rawId: "AQID",
      type: "public-key",
      response: { clientDataJSON: "AQID", attestationObject: "-_8", transports: ["internal"] },
    });
  });

  it("encodes an assertion with its user handle", async () => {
    install(undefined, async () => credential(new FakeAssertion()));
    const out = await getPasskey({ publicKey: { challenge: "AA", allowCredentials: [] } });
    expect(out.response).toEqual({
      clientDataJSON: "BA",
      authenticatorData: "BQY",
      signature: "Bw",
      userHandle: "CAk",
    });
  });

  it("treats a dismissed prompt as cancelled, not as an error", async () => {
    install(undefined, async () => {
      throw new DOMException("The operation either timed out or was not allowed.", "NotAllowedError");
    });
    await expect(getPasskey({ publicKey: { challenge: "AA" } })).rejects.toBeInstanceOf(PasskeyCancelled);
  });
});
