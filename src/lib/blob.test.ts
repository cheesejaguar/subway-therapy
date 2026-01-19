import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadNoteImage, deleteNoteImage } from "./blob";
import { put, del } from "@vercel/blob";

// Mock @vercel/blob
vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(),
}));

describe("blob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  });

  describe("uploadNoteImage", () => {
    it("should return base64 data directly when no BLOB_READ_WRITE_TOKEN", async () => {
      vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

      const base64Data = "data:image/png;base64,iVBORw0KGgo=";
      const result = await uploadNoteImage(base64Data, "test-note-id");

      expect(result).toBe(base64Data);
      expect(put).not.toHaveBeenCalled();
    });

    it("should upload to blob storage when token is set", async () => {
      vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
      vi.mocked(put).mockResolvedValue({
        url: "https://blob.vercel-storage.com/notes/test.png",
        downloadUrl: "https://blob.vercel-storage.com/notes/test.png",
        pathname: "notes/test.png",
        contentType: "image/png",
        contentDisposition: "inline",
      });

      const base64Data = "data:image/png;base64,iVBORw0KGgo=";
      const result = await uploadNoteImage(base64Data, "test-note-id");

      expect(result).toBe("https://blob.vercel-storage.com/notes/test.png");
      expect(put).toHaveBeenCalledWith(
        "notes/test-note-id.png",
        expect.any(Buffer),
        {
          access: "public",
          contentType: "image/png",
        }
      );
    });

    it("should handle jpeg images", async () => {
      vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
      vi.mocked(put).mockResolvedValue({
        url: "https://blob.vercel-storage.com/notes/test.jpeg",
        downloadUrl: "https://blob.vercel-storage.com/notes/test.jpeg",
        pathname: "notes/test.jpeg",
        contentType: "image/jpeg",
        contentDisposition: "inline",
      });

      const base64Data = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
      await uploadNoteImage(base64Data, "test-note-id");

      expect(put).toHaveBeenCalledWith(
        "notes/test-note-id.jpeg",
        expect.any(Buffer),
        {
          access: "public",
          contentType: "image/jpeg",
        }
      );
    });

    it("should throw error for invalid base64 data", async () => {
      vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");

      const invalidData = "not-valid-base64";

      await expect(uploadNoteImage(invalidData, "test-id")).rejects.toThrow(
        "Invalid base64 image data"
      );
    });

    it("should propagate blob storage errors", async () => {
      vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
      vi.mocked(put).mockRejectedValue(new Error("Upload failed"));

      const base64Data = "data:image/png;base64,iVBORw0KGgo=";

      await expect(uploadNoteImage(base64Data, "test-id")).rejects.toThrow(
        "Upload failed"
      );
    });
  });

  describe("deleteNoteImage", () => {
    it("should skip deletion for base64 data URLs", async () => {
      const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
      await deleteNoteImage(dataUrl);

      expect(del).not.toHaveBeenCalled();
    });

    it("should skip deletion when no BLOB_READ_WRITE_TOKEN", async () => {
      vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

      await deleteNoteImage("https://blob.vercel-storage.com/notes/test.png");

      expect(del).not.toHaveBeenCalled();
    });

    it("should delete from blob storage when token is set", async () => {
      vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
      vi.mocked(del).mockResolvedValue(undefined);

      const url = "https://blob.vercel-storage.com/notes/test.png";
      await deleteNoteImage(url);

      expect(del).toHaveBeenCalledWith(url);
    });

    it("should not throw on deletion errors", async () => {
      vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
      vi.mocked(del).mockRejectedValue(new Error("Delete failed"));

      const url = "https://blob.vercel-storage.com/notes/test.png";

      // Should not throw
      await expect(deleteNoteImage(url)).resolves.toBeUndefined();
    });
  });
});
