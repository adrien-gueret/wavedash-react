# wavedash-react

A React library for integrating Wavedash into your React-based game.

## Installation

```bash
npm install wavedash-react
```

## Setup

Wrap your app with the `WavedashProvider` to enable Wavedash features:

```tsx
import { WavedashProvider } from "wavedash-react";

export function App() {
  return (
    <WavedashProvider
      config={{
        debug: true,
      }}
    >
      <YourGame />
    </WavedashProvider>
  );
}
```

You can also preload assets before rendering your app. Audio assets are declared as a `Record` so each sound or music track has a stable id you can use later with the audio hooks:

```tsx
import { WavedashProvider } from "wavedash-react";

export function App() {
  return (
    <WavedashProvider
      preload={{
        audio: {
          click: "./audio/click.mp3",
          title: ["./audio/title.ogg", "./audio/title.mp3"],
          battle: ["./audio/battle.ogg", "./audio/battle.mp3"],
        },
        images: ["./images/logo.png"],
        videos: ["./videos/intro.webm"],
      }}
    >
      <YourGame />
    </WavedashProvider>
  );
}
```

For audio arrays, the browser chooses the first supported source, just like a regular `<audio>` element with multiple `<source>` tags.

## Core Hooks

### useWavedash

Access the Wavedash context to check if your game is running inside Wavedash:

```tsx
import { useWavedash } from "wavedash-react";

export function GameComponent() {
  const { isRunningInWavedash, wavedash } = useWavedash();

  if (!isRunningInWavedash) {
    return <p>Not running in Wavedash environment</p>;
  }

  return <p>Running in Wavedash!</p>;
}
```

You can access the [native Wavedash SDK](https://docs.wavedash.com/sdk/functions) via the `wavedash` object. It exposes all SDK features directly, so if a capability is not wrapped yet by `wavedash-react`, you can still use it through this object.

### useCurrentUser

Get the current logged-in user:

```tsx
import { useCurrentUser } from "wavedash-react";

export function UserProfile() {
  const user = useCurrentUser();

  return user ? <p>Welcome, {user.username}!</p> : <p>Not logged in</p>;
}
```

### UserAvatar

A React component for displaying a user's avatar:

```tsx
import { UserAvatar } from "wavedash-react";

export function Avatar() {
  return <UserAvatar size={64} />;
}

export function OtherPlayerAvatar() {
  return <UserAvatar userId="specific_userid_here" size={64} />;
}
```

## Leaderboards

Three hooks handle different leaderboard scenarios:

#### useLeaderboardEntries

Fetch a range of leaderboard entries:

```tsx
import { useLeaderboardEntries } from "wavedash-react";

export function TopPlayers() {
  const { isLoading, entries } = useLeaderboardEntries("main-leaderboard", {
    start: 0,
    count: 10,
  });

  if (isLoading) return <p>Loading...</p>;

  return (
    <ul>
      {entries.map((entry) => (
        <li key={entry.userId}>
          {entry.username}: {entry.score} pts
        </li>
      ))}
    </ul>
  );
}
```

#### useLeaderboardCurrentUserEntries

Fetch the current user's leaderboard entries:

```tsx
import { useLeaderboardCurrentUserEntries } from "wavedash-react";

export function MyStats() {
  const { isLoading, entries } =
    useLeaderboardCurrentUserEntries("main-leaderboard");

  return (
    <div>{entries.length > 0 && <p>Your rank: {entries[0].globalRank}</p>}</div>
  );
}
```

#### useLeaderboardEntriesAroundCurrentUser

Fetch entries around the current user (ahead and behind):

```tsx
import { useLeaderboardEntriesAroundCurrentUser } from "wavedash-react";

export function NearbyPlayers() {
  const { isLoading, entries } = useLeaderboardEntriesAroundCurrentUser(
    "main-leaderboard",
    { countAhead: 5, countBehind: 5 },
  );

  return <div>{entries.length} players nearby</div>;
}
```

### Submitting a score

Use the `useLeaderboard` hook to access the `submitScore` method:

```tsx
import { useLeaderboard } from "wavedash-react";

export function GameOver({ finalScore }: { finalScore: number }) {
  const { submitScore } = useLeaderboard("main-leaderboard");

  const handleSubmitScore = async () => {
    const entry = await submitScore(finalScore);
    const globalRank = entry?.globalRank ?? null;

    if (globalRank !== null) {
      alert(`Your rank: #${globalRank}`);
    }
  };

  return <button onClick={handleSubmitScore}>Submit Score</button>;
}
```

The `submitScore` method accepts:

- `score` (required): The score value to submit
- `keepBest` (optional): Whether to keep only the best score (default: true)
- `ugcId` (optional): User-generated content ID for additional context

Returns the created or updated leaderboard entry, or `null` if submission failed.

## Audio

The library also exposes helpers to control sound effects and music from the assets preloaded in `WavedashProvider`.

Sound effects and music are disabled by default. Enable them through `useAudio()` before calling `useSound()` or `useMusic()`.

### useAudio

`useAudio()` gives access to the shared audio state and controls:

- `areSoundsEnabled`
- `isMusicEnabled`
- `isAudioEnabled()`
- `soundsVolume`
- `musicVolume`
- `toggleSounds(force?)`
- `toggleMusic(force?)`
- `toggleAudio(force?)`
- `playSound(audioId, loop?)`
- `stopSound(audioId)`
- `playMusic(musicId)`
- `pauseMusic()`
- `resumeMusic()`
- `setSoundsVolume(value)`
- `setMusicVolume(value)`

```tsx
import { useAudio } from "wavedash-react";

export function AudioSettings() {
  const {
    areSoundsEnabled,
    isMusicEnabled,
    isAudioEnabled,
    toggleSounds,
    toggleMusic,
    playSound,
    soundsVolume,
    musicVolume,
    setSoundsVolume,
    setMusicVolume,
  } = useAudio();

  return (
    <div>
      <button onClick={() => toggleSounds()}>
        Sound effects: {areSoundsEnabled ? "on" : "off"}
      </button>
      <button onClick={() => toggleMusic()}>
        Music: {isMusicEnabled ? "on" : "off"}
      </button>
      <button onClick={() => playSound("click")}>Play click</button>
      <p>Any audio enabled: {isAudioEnabled() ? "yes" : "no"}</p>
      <button onClick={() => setSoundsVolume(0.5)}>
        SFX volume: {soundsVolume}
      </button>
      <button onClick={() => setMusicVolume(0.5)}>
        Music volume: {musicVolume}
      </button>
    </div>
  );
}
```

If you want audio enabled immediately, you can do it once when your app starts:

```tsx
import { useEffect } from "react";
import { useAudio } from "wavedash-react";

export function EnableAudioOnStart() {
  const { toggleSounds, toggleMusic } = useAudio();

  useEffect(() => {
    toggleSounds(true);
    toggleMusic(true);
  }, [toggleSounds, toggleMusic]);

  return null;
}
```

When music is disabled, the currently playing track is paused automatically. If it was paused by the toggle, it resumes automatically when music is re-enabled.

### useSound

`useSound(soundId)` returns functions to control one preloaded sound effect.

```tsx
import { useSound } from "wavedash-react";

export function ShootButton() {
  const { playSound, stopSound } = useSound("click");

  return (
    <div>
      <button onClick={() => playSound()}>Play once</button>
      <button onClick={() => playSound(true)}>Loop</button>
      <button onClick={stopSound}>Stop</button>
    </div>
  );
}
```

### useSounds

`useSounds()` returns global sound controls (not bound to a single id).

```tsx
import { useSounds } from "wavedash-react";

export function GenericSfxButtons() {
  const { playSound, stopSound } = useSounds();

  return (
    <div>
      <button onClick={() => playSound("click")}>Play click</button>
      <button onClick={() => playSound("explosion", true)}>
        Loop explosion
      </button>
      <button onClick={() => stopSound("explosion")}>Stop explosion</button>
    </div>
  );
}
```

### useMusic

`useMusic()` controls the shared music player for the whole app.

```tsx
import { useMusic } from "wavedash-react";

export function MusicControls() {
  const { playMusic, pauseMusic, resumeMusic } = useMusic();

  return (
    <div>
      <button onClick={() => playMusic("title")}>Play title music</button>
      <button onClick={() => playMusic("battle")}>Play battle music</button>
      <button onClick={pauseMusic}>Pause</button>
      <button onClick={resumeMusic}>Resume</button>
    </div>
  );
}
```

Only one music track can play at a time. Starting a new one stops the previous track first.
If you call `playMusic()` with the same track already playing, it is ignored (the track is not restarted from 0).

## Stats

Track custom game stats:

```tsx
import { useStat } from "wavedash-react";

export function StatsDisplay() {
  const [stat, setStat] = useStat("player-kills");
  const kills = stat ?? 0;

  return (
    <div>
      <p>Kills: {kills}</p>
      <button onClick={() => setStat(kills + 1)}>Increment</button>
    </div>
  );
}
```

`useStat(name)` returns a tuple:

- current stat value as `number | null`
- `setStat(newValue, storeNow?)`

## Achievements

Display and unlock achievements:

```tsx
import { useAchievement } from "wavedash-react";

export function AchievementHandler() {
  const [isUnlocked, unlockAchievement] = useAchievement("first-kill");

  return (
    <div>
      <p>Status: {isUnlocked ? "Unlocked" : "Locked"}</p>
      <button onClick={() => unlockAchievement()}>Unlock</button>
    </div>
  );
}
```

`useAchievement(name)` returns a tuple:

- current unlocked state as `boolean | null`
- `unlockAchievement(storeNow?)`

## TypeScript Support

The package ships with TypeScript definitions and can be consumed from both TypeScript and plain JavaScript projects.
