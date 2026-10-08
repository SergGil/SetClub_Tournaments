import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { sendMock, getSignedUrlMock, S3ClientMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  getSignedUrlMock: vi.fn(),
  S3ClientMock: vi.fn(),
}));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    constructor(config: unknown) {
      S3ClientMock(config);
    }
    send = sendMock;
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: getSignedUrlMock }));

// Only sanitizeFileName is under test here - createPresignedUploadUrl/
// deleteObject/publicPhotoUrl all need real R2_* env vars and touch the AWS
// SDK client, which getR2Client() only constructs lazily on first real use
// (see r2.ts's own comment), so importing the module for this one pure
// function needs no env vars and no SDK mocking.
import { createPresignedUploadUrl, deleteObject, publicPhotoUrl, sanitizeFileName } from "@/lib/r2";

describe("sanitizeFileName", () => {
  it("leaves an already-safe name unchanged", () => {
    expect(sanitizeFileName("photo.jpg")).toBe("photo.jpg");
  });

  it("strips a Unix directory portion, keeping only the base name", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
  });

  it("strips a Windows directory portion, keeping only the base name", () => {
    expect(sanitizeFileName("C:\\Users\\admin\\secret.jpg")).toBe("secret.jpg");
  });

  it("replaces every non-portable character with an underscore", () => {
    expect(sanitizeFileName("фото № 1 (фінал)!.jpg")).toBe("_______1_________.jpg");
  });

  it("falls back to 'photo' when the path ends in a separator (empty base name)", () => {
    expect(sanitizeFileName("some/dir/")).toBe("photo");
  });

  it("falls back to 'photo' for an empty input", () => {
    expect(sanitizeFileName("")).toBe("photo");
  });

  it("caps the result at 100 characters, keeping the tail (extension) rather than the head", () => {
    const longName = `${"a".repeat(150)}.jpg`;
    const result = sanitizeFileName(longName);
    expect(result.length).toBe(100);
    expect(result.endsWith(".jpg")).toBe(true);
  });
});

const R2_ENV = {
  R2_ACCOUNT_ID: "acc123",
  R2_ACCESS_KEY_ID: "key-id",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET_NAME: "set-club",
  R2_PUBLIC_URL: "https://pub-abc.r2.dev",
};

describe("R2 client helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // getR2Client caches its client on globalThis outside production - start every test fresh.
    (globalThis as { r2Client?: unknown }).r2Client = undefined;
    for (const [name, value] of Object.entries(R2_ENV)) vi.stubEnv(name, value);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("publicPhotoUrl joins R2_PUBLIC_URL and the object key", () => {
    expect(publicPhotoUrl("tournaments/t1/a.jpg")).toBe("https://pub-abc.r2.dev/tournaments/t1/a.jpg");
  });

  it("publicPhotoUrl fails loudly when R2_PUBLIC_URL is missing", () => {
    vi.stubEnv("R2_PUBLIC_URL", "");
    expect(() => publicPhotoUrl("x.jpg")).toThrow("R2_PUBLIC_URL is not set");
  });

  it("presigns a PUT with the content type and length pinned, valid for 5 minutes", async () => {
    getSignedUrlMock.mockResolvedValueOnce("https://signed.example/upload");
    const url = await createPresignedUploadUrl("tournaments/t1/a.jpg", "image/jpeg", 12345);

    expect(url).toBe("https://signed.example/upload");
    const [, command, options] = getSignedUrlMock.mock.calls[0];
    expect(command.input).toEqual({
      Bucket: "set-club",
      Key: "tournaments/t1/a.jpg",
      ContentType: "image/jpeg",
      ContentLength: 12345,
    });
    expect(options).toEqual({ expiresIn: 300 });
  });

  it("points the S3 client at this account's R2 endpoint with its credentials", async () => {
    getSignedUrlMock.mockResolvedValueOnce("u");
    await createPresignedUploadUrl("k", "image/png", 1);
    expect(S3ClientMock).toHaveBeenCalledWith({
      region: "auto",
      endpoint: "https://acc123.r2.cloudflarestorage.com",
      credentials: { accessKeyId: "key-id", secretAccessKey: "secret" },
    });
  });

  it("reuses one client across calls", async () => {
    getSignedUrlMock.mockResolvedValue("u");
    await createPresignedUploadUrl("k1", "image/png", 1);
    await createPresignedUploadUrl("k2", "image/png", 1);
    expect(S3ClientMock).toHaveBeenCalledTimes(1);
  });

  it("names the missing variable when R2 credentials aren't configured", async () => {
    vi.stubEnv("R2_ACCESS_KEY_ID", "");
    await expect(createPresignedUploadUrl("k", "image/png", 1)).rejects.toThrow("R2_ACCESS_KEY_ID is not set");
  });

  it("deleteObject sends a DeleteObject for the bucket and key", async () => {
    sendMock.mockResolvedValueOnce({});
    await deleteObject("tournaments/t1/a.jpg");
    const command = sendMock.mock.calls[0][0];
    expect(command.input).toEqual({ Bucket: "set-club", Key: "tournaments/t1/a.jpg" });
  });

  it("deleteObject surfaces storage failures so callers can decide to swallow them", async () => {
    sendMock.mockRejectedValueOnce(new Error("network error"));
    await expect(deleteObject("k")).rejects.toThrow("network error");
  });
});
