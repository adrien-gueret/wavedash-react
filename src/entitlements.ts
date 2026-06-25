import { useCallback, useState, useEffect, useRef } from "react";

import { useWavedash } from "./WavedashProvider";

export type UseEntitlementReturnValue = [
  boolean | null,
  triggerPaywall: () => Promise<boolean>,
];

export function useEntitlement(
  contentIdentifier: string,
): UseEntitlementReturnValue {
  const { isRunningInWavedash, wavedash } = useWavedash();

  const [isEntitled, setIsEntitled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isRunningInWavedash || isEntitled !== null) {
      return;
    }

    wavedash.isEntitled(contentIdentifier).then((response) => {
      if (response.success) {
        setIsEntitled(response.data);
      }
    });
  }, [isRunningInWavedash, wavedash, contentIdentifier, isEntitled]);

  const triggerPaywall = useCallback(async (): Promise<boolean> => {
    if (!isRunningInWavedash) {
      return false;
    }

    const response = await wavedash.triggerPaywall(contentIdentifier);

    if (response.success && response.data) {
      setIsEntitled(true);
      return true;
    }

    return false;
  }, [isRunningInWavedash, wavedash, contentIdentifier]);

  return [isEntitled, triggerPaywall];
}

export function useEntitlements(): {
  isLoading: boolean;
  entitlements: string[];
} {
  const { isRunningInWavedash, wavedash } = useWavedash();

  const [entitlements, setEntitlements] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isRunningInWavedash) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    wavedash
      .getEntitlements()
      .then((response) => {
        if (response.success) {
          setEntitlements(response.data);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isRunningInWavedash, wavedash]);

  return { isLoading, entitlements };
}

export type PaidAssetOptions = {
  mimeType?: string;
};

export type UsePaidAssetReturnValue = {
  isEntitled: boolean | null;
  isLoading: boolean;
  data: Uint8Array | null;
  url: string | null;
  error: Error | null;
  load: () => Promise<boolean>;
};

export function usePaidAsset(
  contentIdentifier: string,
  filePath: string,
  options?: PaidAssetOptions,
): UsePaidAssetReturnValue {
  const { isRunningInWavedash, wavedash } = useWavedash();
  const [isEntitled, triggerPaywall] = useEntitlement(contentIdentifier);

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<Uint8Array | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const { mimeType } = options ?? {};

  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const load = useCallback(async (): Promise<boolean> => {
    if (!isRunningInWavedash) {
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const owned = await triggerPaywall();
      if (!owned) {
        return false;
      }

      const download = await wavedash.downloadRemoteFile(filePath);
      if (!download.success) {
        setError(new Error(download.message));
        return false;
      }

      const bytes = await wavedash.readLocalFile(download.data);
      if (!bytes) {
        setError(new Error(`Could not read downloaded asset "${filePath}"`));
        return false;
      }

      setData(bytes);

      if (mimeType) {
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }

        const nextUrl = URL.createObjectURL(
          new Blob([bytes as BlobPart], { type: mimeType }),
        );
        objectUrlRef.current = nextUrl;
        setUrl(nextUrl);
      }

      return true;
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError
          : new Error(String(caughtError)),
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isRunningInWavedash, wavedash, triggerPaywall, filePath, mimeType]);

  return { isEntitled, isLoading, data, url, error, load };
}
