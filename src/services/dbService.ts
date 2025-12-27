
import { PhotoMetadata } from "../types";

const DB_NAME = "VisionSortDB";
const DB_VERSION = 1;
const STORE_PHOTOS = "photos";
const STORE_NOTES = "notes";

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.createObjectStore(STORE_PHOTOS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_NOTES)) {
        db.createObjectStore(STORE_NOTES, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const savePhoto = async (photo: PhotoMetadata) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_PHOTOS, "readwrite");
    const store = transaction.objectStore(STORE_PHOTOS);
    
    // URLはセッションごとに生成し直すため、保存しない（Blobを元に復元する）
    const dataToSave = { ...photo };
    delete (dataToSave as any).url;

    const request = store.put(dataToSave);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deletePhoto = async (photoId: string) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_PHOTOS, STORE_NOTES], "readwrite");
    transaction.objectStore(STORE_PHOTOS).delete(photoId);
    transaction.objectStore(STORE_NOTES).delete(photoId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getAllPhotos = async (): Promise<PhotoMetadata[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_PHOTOS, "readonly");
    const store = transaction.objectStore(STORE_PHOTOS);
    const request = store.getAll();

    request.onsuccess = () => {
      const photos = request.result.map((p: any) => ({
        ...p,
        url: p.fileBlob ? URL.createObjectURL(p.fileBlob) : ""
      }));
      resolve(photos);
    };
    request.onerror = () => reject(request.error);
  });
};

export const saveNote = async (photoId: string, note: string) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NOTES, "readwrite");
    const store = transaction.objectStore(STORE_NOTES);
    const request = store.put({ id: photoId, note });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllNotes = async (): Promise<Record<string, string>> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NOTES, "readonly");
    const store = transaction.objectStore(STORE_NOTES);
    const request = store.getAll();

    request.onsuccess = () => {
      const notes: Record<string, string> = {};
      request.result.forEach((item: { id: string, note: string }) => {
        notes[item.id] = item.note;
      });
      resolve(notes);
    };
    request.onerror = () => reject(request.error);
  });
};

export const clearAllData = async () => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_PHOTOS, STORE_NOTES], "readwrite");
    transaction.objectStore(STORE_PHOTOS).clear();
    transaction.objectStore(STORE_NOTES).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};
