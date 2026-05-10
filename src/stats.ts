import { useCallback, useState, useEffect } from "react";

import { useWavedash } from "./WavedashProvider";

export type UseStatReturnValue = [
  number | null,
  (newValue: number, storeNow?: boolean) => boolean,
];

export function useStat(statName: string): UseStatReturnValue {
  const { isRunningInWavedash, wavedash } = useWavedash();

  const [statValue, setStatValue] = useState<number | null>(null);

  useEffect(() => {
    if (!isRunningInWavedash || statValue !== null) {
      return;
    }

    wavedash.requestStats().then(() => {
      const value = wavedash.getStat(statName);
      setStatValue(value);
    });
  }, [isRunningInWavedash, wavedash, statName, statValue]);

  const set = useCallback(
    (newValue: number, storeNow: boolean = true): boolean => {
      if (!isRunningInWavedash) {
        return false;
      }

      const response = wavedash.setStat(statName, newValue, storeNow);

      if (response) {
        setStatValue(newValue);
      }

      return response;
    },
    [isRunningInWavedash, wavedash, statName],
  );

  return [statValue, set];
}
