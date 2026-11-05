import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth";

describe("password hashing", () => {
  it("stays within the Workers PBKDF2 limit of 100,000 iterations and verifies", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(Number(hash.split("$")[1])).toBeLessThanOrEqual(100_000);
    await expect(verifyPassword("correct horse battery", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password!!", hash)).resolves.toBe(false);
  });
});
