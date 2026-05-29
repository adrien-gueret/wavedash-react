import type { WavedashSDK } from "@wvdsh/sdk-js";

import type { State } from "./state";

export type SaveLoadStatus = "idle" | "loading" | "ready" | "error";

export type SaveMeta = {
  loadStatus: SaveLoadStatus;
  isSaving: boolean;
  error: unknown | null;
};

export type SaveOptions = {
  fileName?: string;
  autoSave?: boolean;
  autoLoad?: boolean;
  autoSaveDebounceMs?: number;
};

type Listener = () => void;

export type SaveController = {
  getMeta: () => SaveMeta;
  subscribeMeta: (listener: Listener) => () => void;
  load: (fileName?: string) => Promise<boolean>;
  saveNow: (fileName?: string) => Promise<boolean>;
  scheduleSave: () => void;
  setWavedash: (wavedash?: WavedashSDK) => void;
  destroy: () => void;
};

const rootSavePath = "saves/";

async function loadFromWavedash<T extends State>(
  wavedash: WavedashSDK,
  fileName: string,
): Promise<T | null> {
  const fullPath = `${rootSavePath}${fileName}.json`;

  const doesSaveExist = await wavedash.remoteFileExists(fullPath);

  if (!doesSaveExist.success || !doesSaveExist.data) {
    return null;
  }

  const downloadResult = await wavedash.downloadRemoteFile(fullPath);
  if (!downloadResult?.success) {
    throw new Error(`Failed to download save file at path: ${fullPath}`);
  }

  const fileBytes = await wavedash.readLocalFile(fullPath);
  if (!fileBytes) {
    throw new Error(`Failed to read save file at path: ${fullPath}`);
  }

  const text = new TextDecoder().decode(fileBytes);
  if (!text) return null;

  return JSON.parse(text) as T;
}

async function saveToWavedash(
  wavedash: WavedashSDK,
  fileName: string,
  serialized: string,
): Promise<void> {
  const fullPath = `${rootSavePath}${fileName}.json`;
  const bytes = new TextEncoder().encode(serialized);

  const wroteOk = await wavedash.writeLocalFile(fullPath, bytes);
  if (!wroteOk) {
    throw new Error(`Failed to write save file at path: ${fullPath}`);
  }

  const uploadResult = await wavedash.uploadRemoteFile(fullPath);
  if (!uploadResult?.success) {
    throw new Error(`Failed to upload save file at path: ${fullPath}`);
  }
}

async function loadFromStorage<T extends State>(
  fileName: string,
): Promise<T | null> {
  const data = localStorage.getItem(fileName);
  return data ? JSON.parse(data) : null;
}

async function saveToStorage(
  fileName: string,
  serialized: string,
): Promise<void> {
  localStorage.setItem(fileName, serialized);
}

export type CreateSaveControllerOptions<T extends State> = {
  getState: () => T;
  setState: (next: T) => void;
  fileName: string;
  autoSaveDebounceMs: number;
};

export function createSaveController<T extends State>(
  options: CreateSaveControllerOptions<T>,
): SaveController {
  const {
    getState,
    setState,
    fileName: defaultFileName,
    autoSaveDebounceMs,
  } = options;

  let meta: SaveMeta = { loadStatus: "idle", isSaving: false, error: null };
  let wavedash: WavedashSDK | undefined;
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSavedSerialized: string | null = null;
  let lastSavedFileName: string | null = null;

  const metaListeners = new Set<Listener>();

  const notifyMeta = () => {
    metaListeners.forEach((listener) => listener());
  };

  const setMeta = (patch: Partial<SaveMeta>) => {
    const next = { ...meta, ...patch };
    if (
      next.loadStatus === meta.loadStatus &&
      next.isSaving === meta.isSaving &&
      Object.is(next.error, meta.error)
    ) {
      return;
    }
    meta = next;
    notifyMeta();
  };

  const scheduleSave = () => {
    if (autoSaveTimer !== null) {
      clearTimeout(autoSaveTimer);
    }
    autoSaveTimer = setTimeout(() => {
      autoSaveTimer = null;
      void saveNow();
    }, autoSaveDebounceMs);
  };

  const load = async (fileName: string = defaultFileName): Promise<boolean> => {
    setMeta({ loadStatus: "loading", error: null });
    try {
      const data = wavedash
        ? await loadFromWavedash<T>(wavedash, fileName)
        : await loadFromStorage<T>(fileName);

      if (data !== null && data !== undefined) {
        setState(data);
        lastSavedSerialized = JSON.stringify(data);
        lastSavedFileName = fileName;
      }
      setMeta({ loadStatus: "ready" });
      return true;
    } catch (error) {
      console.error("[wavedash-react] Failed to load save:", error);
      setMeta({ loadStatus: "error", error });
      return false;
    }
  };

  const saveNow = async (
    fileName: string = defaultFileName,
  ): Promise<boolean> => {
    const state = getState();
    const serialized = JSON.stringify(state);
    if (lastSavedSerialized === serialized && lastSavedFileName === fileName) {
      return true;
    }
    setMeta({ isSaving: true, error: null });
    try {
      wavedash
        ? await saveToWavedash(wavedash, fileName, serialized)
        : await saveToStorage(fileName, serialized);

      lastSavedSerialized = serialized;
      lastSavedFileName = fileName;
      setMeta({ isSaving: false });
      return true;
    } catch (error) {
      console.error("[wavedash-react] Failed to save:", error);
      setMeta({ isSaving: false, error });
      return false;
    }
  };

  const setWavedash = (next?: WavedashSDK) => {
    wavedash = next;
  };

  const destroy = () => {
    if (autoSaveTimer !== null) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    metaListeners.clear();
  };

  return {
    getMeta: () => meta,
    subscribeMeta: (listener) => {
      metaListeners.add(listener);
      return () => {
        metaListeners.delete(listener);
      };
    },
    load,
    saveNow,
    scheduleSave,
    setWavedash,
    destroy,
  };
}
