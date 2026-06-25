import {
  type ReactNode,
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
} from "react";

import { useWavedash } from "./WavedashProvider";

export type AudioContextValue = {
  isAudioEnabled: boolean;
  soundsVolume: number;
  musicVolume: number;
  audioMap: Map<string, HTMLAudioElement>;
  toggleAudio: (force?: boolean) => Promise<boolean>;
  playSound: (audioId: string, loop?: boolean) => void;
  stopSound: (audioId: string) => void;
  playMusic: (musicId: string) => void;
  pauseMusic: () => void;
  resumeMusic: () => void;
  setSoundsVolume: (value: number) => void;
  setMusicVolume: (value: number) => void;
};

const AudioContext = createContext<AudioContextValue>({
  isAudioEnabled: false,
  soundsVolume: 1,
  musicVolume: 1,
  audioMap: new Map(),
  toggleAudio: () => Promise.resolve(false),
  playSound: () => {},
  stopSound: () => {},
  playMusic: () => {},
  pauseMusic: () => {},
  resumeMusic: () => {},
  setSoundsVolume: () => {},
  setMusicVolume: () => {},
});

export type AudioProviderProps = {
  children: ReactNode;
  audioMap: Map<string, HTMLAudioElement>;
  defaultSoundsVolume?: number;
  defaultMusicVolume?: number;
};

export function AudioProvider({
  children,
  audioMap,
  defaultSoundsVolume = 1,
  defaultMusicVolume = 1,
}: AudioProviderProps) {
  const { wavedash } = useWavedash();
  const [isAudioEnabled, setIsAudioEnabledState] = useState(false);
  const [soundsVolume, setSoundsVolumeState] = useState(defaultSoundsVolume);
  const [musicVolume, setMusicVolumeState] = useState(defaultMusicVolume);
  const currentMusicRef = useRef<HTMLAudioElement | null>(null);
  const shouldResumeMusicRef = useRef(false);
  const isSyncingFromHostRef = useRef(false);

  const isAudioEnabledRef = useRef(isAudioEnabled);
  const soundsVolumeRef = useRef(soundsVolume);
  const musicVolumeRef = useRef(musicVolume);

  const setAudioEnabledLocal = useCallback((value: boolean) => {
    isAudioEnabledRef.current = value;
    setIsAudioEnabledState(value);
  }, []);

  const requestMuteOnHost = useCallback(
    (muted: boolean): Promise<boolean> => {
      if (!wavedash || isSyncingFromHostRef.current) {
        return Promise.resolve(true);
      }
      return wavedash.requestMute(muted);
    },
    [wavedash],
  );

  const toggleAudio = useCallback(
    async (force?: boolean) => {
      const previous = isAudioEnabledRef.current;
      const newValue = force !== undefined ? force : !previous;
      if (newValue === previous) {
        return previous;
      }
      setAudioEnabledLocal(newValue);

      const applied = await requestMuteOnHost(!newValue);
      if (applied) {
        setAudioEnabledLocal(newValue);
        return newValue;
      }
      return previous;
    },
    [requestMuteOnHost, setAudioEnabledLocal],
  );

  const setSoundsVolume = useCallback((value: number) => {
    soundsVolumeRef.current = value;
    setSoundsVolumeState(value);
  }, []);

  const setMusicVolume = useCallback((value: number) => {
    musicVolumeRef.current = value;
    setMusicVolumeState(value);
  }, []);

  const playSound = useCallback(
    (audioId: string, loop: boolean = false) => {
      if (!isAudioEnabledRef.current) {
        return;
      }

      const audio = audioMap.get(audioId);
      if (!audio) {
        console.warn(`Audio with id "${audioId}" not found.`);
        return;
      }

      audio.volume = soundsVolumeRef.current;
      audio.loop = loop;
      audio.currentTime = 0;
      audio.play().catch((error) => {
        console.error(`Failed to play sound "${audioId}":`, error);
      });
    },
    [audioMap],
  );

  const stopSound = useCallback(
    (audioId: string) => {
      const audio = audioMap.get(audioId);
      if (!audio) {
        return;
      }

      audio.pause();
      audio.currentTime = 0;
    },
    [audioMap],
  );

  const playMusic = useCallback(
    (musicId: string) => {
      if (!isAudioEnabledRef.current) {
        return;
      }

      const audio = audioMap.get(musicId);
      if (!audio) {
        console.warn(`Audio with id "${musicId}" not found.`);
        return;
      }

      if (currentMusicRef.current === audio && !audio.paused) {
        return;
      }

      if (currentMusicRef.current && currentMusicRef.current !== audio) {
        currentMusicRef.current.pause();
        currentMusicRef.current.currentTime = 0;
      }

      audio.volume = musicVolumeRef.current;
      audio.loop = true;
      audio.currentTime = 0;
      audio.play().catch((error) => {
        console.error(`Failed to play music "${musicId}":`, error);
      });

      shouldResumeMusicRef.current = false;
      currentMusicRef.current = audio;
    },
    [audioMap],
  );

  const pauseMusic = useCallback(() => {
    if (currentMusicRef.current) {
      shouldResumeMusicRef.current = false;
      currentMusicRef.current.pause();
    }
  }, []);

  const resumeMusic = useCallback(() => {
    if (!isAudioEnabledRef.current) {
      return;
    }

    if (currentMusicRef.current) {
      currentMusicRef.current.play().catch((error) => {
        console.error("Failed to resume music:", error);
      });
      shouldResumeMusicRef.current = false;
    }
  }, []);

  useEffect(() => {
    const currentMusic = currentMusicRef.current;

    if (!currentMusic) {
      return;
    }

    currentMusic.volume = musicVolume;

    if (!isAudioEnabled) {
      shouldResumeMusicRef.current = !currentMusic.paused;
      currentMusic.pause();
      return;
    }

    if (!shouldResumeMusicRef.current) {
      return;
    }

    currentMusic.play().catch((error) => {
      console.error("Failed to resume music:", error);
    });
    shouldResumeMusicRef.current = false;
  }, [isAudioEnabled, musicVolume]);

  useEffect(() => {
    if (!wavedash) {
      return;
    }

    isSyncingFromHostRef.current = true;
    wavedash.requestMute(true).finally(() => {
      isSyncingFromHostRef.current = false;
    });

    const unsubscribe = wavedash.on(
      wavedash.Events.MUTE_CHANGED,
      ({ isMuted }) => {
        isSyncingFromHostRef.current = true;
        try {
          setAudioEnabledLocal(!isMuted);
        } finally {
          isSyncingFromHostRef.current = false;
        }
      },
    );

    return unsubscribe;
  }, [wavedash, setAudioEnabledLocal]);

  return (
    <AudioContext
      value={{
        isAudioEnabled,
        toggleAudio,
        playSound,
        stopSound,
        playMusic,
        pauseMusic,
        resumeMusic,
        soundsVolume,
        musicVolume,
        setSoundsVolume,
        setMusicVolume,
        audioMap,
      }}
    >
      {children}
    </AudioContext>
  );
}

export function useAudio(): AudioContextValue {
  return useContext(AudioContext);
}

export function useSound(audioId: string) {
  const { playSound: playSoundFromContext, stopSound: stopSoundFromContext } =
    useAudio();

  const playSound = useCallback(
    (loop: boolean = false) => {
      playSoundFromContext(audioId, loop);
    },
    [playSoundFromContext, audioId],
  );

  const stopSound = useCallback(() => {
    stopSoundFromContext(audioId);
  }, [stopSoundFromContext, audioId]);

  return { playSound, stopSound };
}

export function useSounds() {
  const { playSound, stopSound } = useAudio();

  return { playSound, stopSound };
}

export function useMusic() {
  const { playMusic, pauseMusic, resumeMusic } = useAudio();
  return { playMusic, pauseMusic, resumeMusic };
}
