import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./secrets";

describe("encrypted settings", () => {
  it("round-trips a secret without storing its plaintext", async () => {
    const encrypted = await encryptSecret("smtp-secret", "instance-key");
    expect(encrypted).not.toContain("smtp-secret");
    await expect(decryptSecret(encrypted, "instance-key")).resolves.toBe("smtp-secret");
  });

  it("cannot be decrypted with another instance key", async () => {
    const encrypted = await encryptSecret("smtp-secret", "instance-key");
    await expect(decryptSecret(encrypted, "different-key")).rejects.toThrow();
  });
});
