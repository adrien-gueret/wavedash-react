import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useState,
  useRef,
} from "react";
import type { WavedashSDK, WavedashConfig } from "@wvdsh/sdk-js";

import { AudioProvider } from "./audio";

export type WavedashContextValue =
  | {
      isRunningInWavedash: true;
      wavedash: WavedashSDK;
    }
  | {
      isRunningInWavedash: false;
      wavedash?: null;
    };

const WavedashContext = createContext<WavedashContextValue>({
  isRunningInWavedash: false,
  wavedash: null,
});

export type WavedashProviderProps = {
  children: ReactNode;
  preload?: {
    audio?: Record<string, string | string[]>;
    images?: string[];
    videos?: string[];
  };
  config?: WavedashConfig;
  defaultSoundsVolume?: number;
  defaultMusicVolume?: number;
};

const ASSETS_PRELOAD_TIMEOUT_MS = 5000;

function createAssetSettler(onSettled: () => void): () => void {
  let isSettled = false;
  let timeoutId = -1;

  const settleAsset = () => {
    if (isSettled) {
      return;
    }

    isSettled = true;
    window.clearTimeout(timeoutId);
    onSettled();
  };

  timeoutId = window.setTimeout(settleAsset, ASSETS_PRELOAD_TIMEOUT_MS);
  return settleAsset;
}

export function WavedashProvider({
  children,
  preload,
  config,
  defaultSoundsVolume,
  defaultMusicVolume,
}: WavedashProviderProps) {
  const hasStartedPreload = useRef(false);
  const [isInit, setIsInit] = useState(false);
  const [audioMap] = useState(() => new Map<string, HTMLAudioElement>());

  const contextValue: WavedashContextValue = useMemo(
    () =>
      typeof window !== "undefined" && window.Wavedash
        ? {
            isRunningInWavedash: true,
            wavedash: window.Wavedash,
          }
        : {
            isRunningInWavedash: false,
            wavedash: null,
          },
    [],
  );

  const init = useCallback(() => {
    setIsInit(true);

    if (!contextValue.isRunningInWavedash) {
      return;
    }

    contextValue.wavedash.updateLoadProgressZeroToOne(1);
    contextValue.wavedash.init(config);
  }, [contextValue, config]);

  useEffect(() => {
    if (isInit || hasStartedPreload.current) {
      return;
    }

    hasStartedPreload.current = true;

    const { audio = {}, images = [], videos = [] } = preload ?? {};
    const audioEntries = Object.entries(audio);
    const totalCount = audioEntries.length + images.length + videos.length;
    let loadedCount = 0;

    if (totalCount === 0) {
      init();
      return;
    }

    const preloadContainer = document.createElement("div");
    preloadContainer.style.display = "none";
    document.body.appendChild(preloadContainer);

    const handleAssetLoad = () => {
      loadedCount += 1;

      if (contextValue.isRunningInWavedash) {
        contextValue.wavedash.updateLoadProgressZeroToOne(
          loadedCount / totalCount,
        );
      }

      if (loadedCount === totalCount) {
        init();
      }
    };

    audioEntries.forEach(([name, src]) => {
      const audioElement = new Audio();
      audioElement.preload = "metadata";
      const settleAsset = createAssetSettler(handleAssetLoad);

      if (Array.isArray(src)) {
        src.forEach((srcUrl) => {
          const sourceElement = document.createElement("source");
          sourceElement.src = srcUrl;

          if (srcUrl.endsWith(".mp3")) {
            sourceElement.type = "audio/mpeg";
          } else if (srcUrl.endsWith(".ogg")) {
            sourceElement.type = "audio/ogg";
          } else if (srcUrl.endsWith(".wav")) {
            sourceElement.type = "audio/wav";
          } else if (srcUrl.endsWith(".webm")) {
            sourceElement.type = "audio/webm";
          }
          audioElement.appendChild(sourceElement);
        });
      } else {
        audioElement.src = src;
      }

      audioElement.addEventListener("loadedmetadata", settleAsset, {
        once: true,
      });
      audioElement.addEventListener("error", settleAsset, { once: true });

      audioElement.load();

      audioMap.set(name, audioElement);
      preloadContainer.appendChild(audioElement);
    });

    images.forEach((src) => {
      const img = new Image();
      img.src = src;
      const settleAsset = createAssetSettler(handleAssetLoad);

      img.addEventListener("load", settleAsset, { once: true });
      img.addEventListener("error", settleAsset, { once: true });
      preloadContainer.appendChild(img);
    });

    videos.forEach((src) => {
      const videoElement = document.createElement("video");
      videoElement.preload = "metadata";
      videoElement.src = src;
      const settleAsset = createAssetSettler(handleAssetLoad);

      videoElement.addEventListener("loadedmetadata", settleAsset, {
        once: true,
      });
      videoElement.addEventListener("error", settleAsset, { once: true });

      videoElement.load();

      preloadContainer.appendChild(videoElement);
    });
  }, [isInit, preload, contextValue, audioMap, init]);

  return (
    <WavedashContext value={contextValue}>
      <AudioProvider
        audioMap={audioMap}
        defaultSoundsVolume={defaultSoundsVolume}
        defaultMusicVolume={defaultMusicVolume}
      >
        {isInit ? children : null}
      </AudioProvider>
    </WavedashContext>
  );
}

export function useWavedash(): WavedashContextValue {
  return useContext(WavedashContext);
}
