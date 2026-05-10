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
  preload?: Partial<Record<"audio" | "image" | "video", string[]>>;
  config?: WavedashConfig;
};

export function WavedashProvider({
  children,
  preload,
  config,
}: WavedashProviderProps) {
  const [isInit, setIsInit] = useState(false);

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

    const { audio = [], image = [], video = [] } = preload ?? {};
    const totalCount = audio.length + image.length + video.length;
    let loadedCount = 0;

    if (totalCount === 0) {
      init();
      return;
    }

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

    audio.forEach((src) => {
      const audioElement = new Audio(src);
      audioElement.addEventListener("canplaythrough", handleAssetLoad, {
        once: true,
      });
      audioElement.addEventListener("error", handleAssetLoad, { once: true });
    });

    image.forEach((src) => {
      const img = new Image();
      img.src = src;
      img.addEventListener("load", handleAssetLoad, { once: true });
      img.addEventListener("error", handleAssetLoad, { once: true });
    });

    video.forEach((src) => {
      const videoElement = document.createElement("video");
      videoElement.src = src;
      videoElement.addEventListener("canplaythrough", handleAssetLoad, {
        once: true,
      });
      videoElement.addEventListener("error", handleAssetLoad, { once: true });
    });
  }, [isInit, preload, contextValue]);

  return (
    <WavedashContext.Provider value={contextValue}>
      {isInit ? children : null}
    </WavedashContext.Provider>
  );
}

export function useWavedash(): WavedashContextValue {
  return useContext(WavedashContext);
}
