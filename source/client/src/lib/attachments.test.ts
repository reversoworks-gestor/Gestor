import { describe, expect, it } from "vitest";
import { stripDownloadUrlToken } from "./attachments";

describe("stripDownloadUrlToken", () => {
  it("removes the legacy bearer URL and retains secure object metadata", () => {
    const attachment = {
      id: "file-1",
      name: "drawing.pdf",
      storagePath: "workspaces/reverso-private/documents/order-1/file-1-drawing.pdf",
      downloadUrl: "https://firebasestorage.googleapis.com/v0/b/example/o/file?alt=media&token=secret",
      size: 128,
      contentType: "application/pdf",
    };

    expect(stripDownloadUrlToken(attachment)).toEqual({
      id: "file-1",
      name: "drawing.pdf",
      storagePath: "workspaces/reverso-private/documents/order-1/file-1-drawing.pdf",
      size: 128,
      contentType: "application/pdf",
    });
    expect(attachment.downloadUrl).toContain("token=secret");
  });
});
