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

You can access the [native Wavedash SDK](https://docs.wavedash.com/sdk/functions) via `wavedash` object.

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
    const response = await submitScore(finalScore);
    const { globalRank = null } = response ?? {};

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

Returns the player's global rank after submission, or `null` if submission failed.

## Stats

Track custom game stats:

```tsx
import { useStat } from "wavedash-react";

export function StatsDisplay() {
  const [stat, setStat] = useStat("player-kills");

  return (
    <div>
      <p>Kills: {stat}</p>
      <button onClick={() => setStat(stat + 1)}>Increment</button>
    </div>
  );
}
```

## Achievements

Display and unlock achievements:

```tsx
import { useAchievement } from "wavedash-react";

export function AchievementHandler() {
  const [achievement, unlockAchievement] = useAchievement("first-kill");

  return (
    <div>
      <p>Status: {achievement?.unlocked ? "Unlocked" : "Locked"}</p>
      <button onClick={() => unlockAchievement()}>Unlock</button>
    </div>
  );
}
```
