// local filesystem storage replacement for supabase storage buckets.
// files are written under public/uploads so next serves them directly.
import { mkdir, readdir, writeFile, unlink } from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

export async function saveUpload(bucket: string, key: string, data: File | Buffer, contentType?: string): Promise<string> {
  const bytes = data instanceof File ? Buffer.from(await data.arrayBuffer()) : data;
  const filePath = path.join(UPLOAD_ROOT, bucket, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
  // the returned path is the public url the old getPublicUrl gave callers
  return `/uploads/${bucket}/${key}`;
}

export async function deleteUpload(bucket: string, key: string): Promise<void> {
  try {
    await unlink(path.join(UPLOAD_ROOT, bucket, key));
  } catch {
    // already gone is the outcome we want anyway
  }
}

// every file under a bucket folder (one level), as bucket-relative keys. used
// to sweep a whole folder when its owner row is deleted.
export async function listUploads(bucket: string, prefix = ""): Promise<string[]> {
  const dir = path.join(UPLOAD_ROOT, bucket, prefix);
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => (prefix ? `${prefix}/${entry.name}` : entry.name));
  } catch {
    return [];
  }
}

// converts a stored public url ("/uploads/profile-photos/p-1/x.jpg") back to the
// bucket + key pair, or null when the url points somewhere else entirely.
export function parseUploadUrl(url: string): { bucket: string; key: string } | null {
  const match = /^\/uploads\/([^/]+)\/(.+)$/.exec(url);
  if (!match) return null;
  return { bucket: match[1], key: match[2] };
}
