import { useCallback, useState, useEffect } from "react";

import { useWavedash } from "./WavedashProvider";

export type UseAchievementReturnValue = [
  boolean | null,
  unlock: (storeNow?: boolean) => boolean,
];

export function useAchievement(
  achievementName: string,
): UseAchievementReturnValue {
  const { isRunningInWavedash, wavedash } = useWavedash();

  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isRunningInWavedash || isUnlocked !== null) {
      return;
    }

    wavedash.requestStats().then(() => {
      const value = wavedash.getAchievement(achievementName);
      setIsUnlocked(value);
    });
  }, [isRunningInWavedash, wavedash, achievementName, isUnlocked]);

  const unlock = useCallback(
    (storeNow: boolean = true): boolean => {
      if (!isRunningInWavedash) {
        return false;
      }

      const response = wavedash.setAchievement(achievementName, storeNow);

      if (response) {
        setIsUnlocked(true);
      }

      return response;
    },
    [isRunningInWavedash, wavedash, achievementName],
  );

  return [isUnlocked, unlock];
}
