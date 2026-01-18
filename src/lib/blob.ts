import { put, del } from "@vercel/blob";

/**
 * Upload an image to Vercel Blob storage
 * @param base64Data - Base64 encoded image data (with data:image/... prefix)
 * @param noteId - Unique identifier for the note
 * @returns URL of the uploaded blob
 */
export async function uploadNoteImage(
  base64Data: string,
  noteId: string
): Promise<string> {
  // In development without blob token, return the base64 data directly
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn("BLOB_READ_WRITE_TOKEN not set, using base64 data directly");
    return base64Data;
  }

  try {
    // Extract the base64 content and mime type
    const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error("Invalid base64 image data");
    }

    const mimeType = matches[1];
    const base64Content = matches[2];

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Content, "base64");

    // Determine file extension
    const ext = mimeType.split("/")[1] || "png";
    const filename = `notes/${noteId}.${ext}`;

    // Upload to Vercel Blob
    const blob = await put(filename, buffer, {
      access: "public",
      contentType: mimeType,
    });

    return blob.url;
  } catch (error) {
    console.error("Error uploading to blob storage:", error);
    throw error;
  }
}

/**
 * Delete an image from Vercel Blob storage
 * @param url - URL of the blob to delete
 */
export async function deleteNoteImage(url: string): Promise<void> {
  // Skip if it's a base64 data URL (dev mode)
  if (url.startsWith("data:")) {
    return;
  }

  // Skip if no blob token
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return;
  }

  try {
    await del(url);
  } catch (error) {
    console.error("Error deleting from blob storage:", error);
    // Don't throw - deletion failure shouldn't break the flow
  }
}
