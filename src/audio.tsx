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
  areSoundsEnabled: boolean;
  isMusicEnabled: boolean;
  soundsVolume: number;
  musicVolume: number;
  audioMap: Map<string, HTMLAudioElement>;
  isAudioEnabled: () => boolean;
  toggleSounds: (force?: boolean) => boolean;
  toggleMusic: (force?: boolean) => boolean;
  toggleAudio: (force?: boolean) => boolean;
  playSound: (audioId: string, loop?: boolean) => void;
  stopSound: (audioId: string) => void;
  playMusic: (musicId: string) => void;
  pauseMusic: () => void;
  resumeMusic: () => void;
  setSoundsVolume: (value: number) => void;
  setMusicVolume: (value: number) => void;
};

const AudioContext = createContext<AudioContextValue>({
  areSoundsEnabled: false,
  isMusicEnabled: false,
  soundsVolume: 1,
  musicVolume: 1,
  audioMap: new Map(),
  isAudioEnabled: () => false,
  toggleSounds: () => false,
  toggleMusic: () => false,
  toggleAudio: () => false,
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
  const [areSoundsEnabled, setAreSoundsEnabled] = useState(false);
  const [isMusicEnabled, setIsMusicEnabled] = useState(false);
  const [soundsVolume, setSoundsVolumeState] = useState(defaultSoundsVolume);
  const [musicVolume, setMusicVolumeState] = useState(defaultMusicVolume);
  const currentMusicRef = useRef<HTMLAudioElement | null>(null);
  const shouldResumeMusicRef = useRef(false);

  const areSoundsEnabledRef = useRef(areSoundsEnabled);
  const isMusicEnabledRef = useRef(isMusicEnabled);
  const soundsVolumeRef = useRef(soundsVolume);
  const musicVolumeRef = useRef(musicVolume);

  const isAudioEnabled = useCallback(() => {
    return areSoundsEnabledRef.current || isMusicEnabledRef.current;
  }, []);

  const toggleSounds = useCallback((force?: boolean) => {
    const newValue = force !== undefined ? force : !areSoundsEnabledRef.current;
    areSoundsEnabledRef.current = newValue;
    setAreSoundsEnabled(newValue);
    return newValue;
  }, []);

  const toggleMusic = useCallback((force?: boolean) => {
    const newValue = force !== undefined ? force : !isMusicEnabledRef.current;
    isMusicEnabledRef.current = newValue;
    setIsMusicEnabled(newValue);
    return newValue;
  }, []);

  const toggleAudio = useCallback(
    (force?: boolean) => {
      const newValue = force !== undefined ? force : !isAudioEnabled();
      toggleSounds(newValue);
      toggleMusic(newValue);
      return newValue;
    },
    [isAudioEnabled, toggleSounds, toggleMusic],
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
      if (!areSoundsEnabledRef.current) {
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
      if (!isMusicEnabledRef.current) {
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
    if (!isMusicEnabledRef.current) {
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

    if (!isMusicEnabled) {
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
  }, [isMusicEnabled, musicVolume]);

  useEffect(() => {
    if (!wavedash) {
      return;
    }

    const unsubscribe = wavedash.on(
      wavedash.Events.MUTE_CHANGED,
      ({ isMuted }) => {
        toggleAudio(!isMuted);
      },
    );

    return unsubscribe;
  }, [wavedash]);

  return (
    <AudioContext
      value={{
        areSoundsEnabled,
        isMusicEnabled,
        isAudioEnabled,
        toggleSounds,
        toggleMusic,
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
