import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useState,
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

export function WavedashProvider({
  children,
  preload,
  config,
  defaultSoundsVolume,
  defaultMusicVolume,
}: WavedashProviderProps) {
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
    if (isInit) {
      return;
    }

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

      audioElement.addEventListener("canplaythrough", handleAssetLoad, {
        once: true,
      });
      audioElement.addEventListener("error", handleAssetLoad, { once: true });
      audioMap.set(name, audioElement);
      preloadContainer.appendChild(audioElement);
    });

    images.forEach((src) => {
      const img = new Image();
      img.src = src;
      img.addEventListener("load", handleAssetLoad, { once: true });
      img.addEventListener("error", handleAssetLoad, { once: true });
      preloadContainer.appendChild(img);
    });

    videos.forEach((src) => {
      const videoElement = document.createElement("video");
      videoElement.src = src;
      videoElement.addEventListener("canplaythrough", handleAssetLoad, {
        once: true,
      });
      videoElement.addEventListener("error", handleAssetLoad, { once: true });
      preloadContainer.appendChild(videoElement);
    });
  }, [isInit, preload, contextValue, audioMap]);

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
