// filepath: /Users/a200200348/Documents/AajaPadteHai/GeyMatiMataJiApp/admin-dashboard/src/lib/uploads.ts
// Helper for uploading binary files to Firebase Storage with progress.
// Returns the public download URL plus the storage path so that records can
// reference the asset and we can delete it later.

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type StorageReference,
  type UploadTask,
} from "firebase/storage";

import { storage } from "./firebase";

export type UploadProgress = {
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
};

export type UploadResult = {
  url: string;
  storagePath: string;
  contentType: string;
  size: number;
  name: string;
};

export type UploadOptions = {
  folder: string;
  file: File;
  onProgress?: (p: UploadProgress) => void;
};

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export function uploadFile({
  folder,
  file,
  onProgress,
}: UploadOptions): { promise: Promise<UploadResult>; cancel: () => void } {
  const path = `${folder}/${Date.now()}_${safeFileName(file.name)}`;
  const storageRef: StorageReference = ref(storage, path);
  const task: UploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type || undefined,
  });

  const promise = new Promise<UploadResult>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        const percent =
          snap.totalBytes > 0
            ? (snap.bytesTransferred / snap.totalBytes) * 100
            : 0;
        onProgress?.({
          bytesTransferred: snap.bytesTransferred,
          totalBytes: snap.totalBytes,
          percent,
        });
      },
      (err) => reject(err),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({
            url,
            storagePath: path,
            contentType: file.type || "application/octet-stream",
            size: file.size,
            name: file.name,
          });
        } catch (err) {
          reject(err);
        }
      }
    );
  });

  return { promise, cancel: () => task.cancel() };
}

/** Best-effort delete of a storage object. Swallows not-found errors. */
export async function deleteStorageObject(path: string): Promise<void> {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/object-not-found/.test(message)) {
      throw err;
    }
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
