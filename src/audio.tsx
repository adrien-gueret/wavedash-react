import {
  type ReactNode,
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
} from "react";

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
  playMusic: (musicId: string) => void;
  pauseMusic: () => void;
  resumeMusic: () => void;
  setSoundsVolume: React.Dispatch<React.SetStateAction<number>>;
  setMusicVolume: React.Dispatch<React.SetStateAction<number>>;
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
  playMusic: () => {},
  pauseMusic: () => {},
  resumeMusic: () => {},
  setSoundsVolume: () => {},
  setMusicVolume: () => {},
});

export type AudioProviderProps = {
  children: ReactNode;
  audioMap: Map<string, HTMLAudioElement>;
};

export function AudioProvider({ children, audioMap }: AudioProviderProps) {
  const [areSoundsEnabled, setAreSoundsEnabled] = useState(false);
  const [isMusicEnabled, setIsMusicEnabled] = useState(false);
  const [soundsVolume, setSoundsVolume] = useState(1);
  const [musicVolume, setMusicVolume] = useState(1);
  const currentMusicRef = useRef<HTMLAudioElement | null>(null);
  const shouldResumeMusicRef = useRef(false);

  const isAudioEnabled = useCallback(() => {
    return areSoundsEnabled || isMusicEnabled;
  }, [areSoundsEnabled, isMusicEnabled]);

  const toggleSounds = useCallback(
    (force?: boolean) => {
      const newValue = force !== undefined ? force : !areSoundsEnabled;
      setAreSoundsEnabled(newValue);
      return newValue;
    },
    [areSoundsEnabled],
  );

  const toggleMusic = useCallback(
    (force?: boolean) => {
      const newValue = force !== undefined ? force : !isMusicEnabled;
      setIsMusicEnabled(newValue);
      return newValue;
    },
    [isMusicEnabled],
  );

  const toggleAudio = useCallback(
    (force?: boolean) => {
      const newValue = force !== undefined ? force : !isAudioEnabled();
      toggleSounds(newValue);
      toggleMusic(newValue);
      return newValue;
    },
    [isAudioEnabled, toggleSounds, toggleMusic],
  );

  const playMusic = useCallback(
    (musicId: string) => {
      if (!isMusicEnabled) {
        return;
      }

      if (currentMusicRef.current) {
        currentMusicRef.current.pause();
        currentMusicRef.current.currentTime = 0;
      }

      const audio = audioMap.get(musicId);
      if (!audio) {
        console.warn(`Audio with id "${musicId}" not found.`);
        return;
      }

      audio.volume = musicVolume;
      audio.loop = true;
      audio.currentTime = 0;
      audio.play().catch((error) => {
        console.error(`Failed to play music "${musicId}":`, error);
      });

      shouldResumeMusicRef.current = false;
      currentMusicRef.current = audio;
    },
    [audioMap, isMusicEnabled, musicVolume],
  );

  const pauseMusic = useCallback(() => {
    if (currentMusicRef.current) {
      shouldResumeMusicRef.current = false;
      currentMusicRef.current.pause();
    }
  }, []);

  const resumeMusic = useCallback(() => {
    if (!isMusicEnabled) {
      return;
    }

    if (currentMusicRef.current) {
      currentMusicRef.current.play().catch((error) => {
        console.error("Failed to resume music:", error);
      });
      shouldResumeMusicRef.current = false;
    }
  }, [isMusicEnabled]);

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

  return (
    <AudioContext
      value={{
        areSoundsEnabled,
        isMusicEnabled,
        isAudioEnabled,
        toggleSounds,
        toggleMusic,
        toggleAudio,
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
  const { audioMap, areSoundsEnabled, soundsVolume } = useAudio();

  const getAudio = useCallback(() => {
    const audio = audioMap.get(audioId);

    if (!audio) {
      console.warn(`Audio with id "${audioId}" not found.`);
      return null;
    }

    return audio;
  }, [audioId, audioMap]);

  const playSound = useCallback(
    (loop: boolean = false) => {
      if (!areSoundsEnabled) {
        return;
      }

      const audio = getAudio();
      if (!audio) {
        return;
      }

      audio.volume = soundsVolume;
      audio.loop = loop;
      audio.currentTime = 0;
      audio.play().catch((error) => {
        console.error(`Failed to play sound "${audioId}":`, error);
      });
    },
    [audioId, areSoundsEnabled, getAudio, soundsVolume],
  );

  const stopSound = useCallback(() => {
    const audio = getAudio();
    if (!audio) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
  }, [getAudio]);

  return { playSound, stopSound };
}

export function useMusic() {
  const { playMusic, pauseMusic, resumeMusic } = useAudio();

  return { playMusic, pauseMusic, resumeMusic };
}
