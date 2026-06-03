import { useState, useEffect, useCallback, useRef } from "react";
import type {
  Leaderboard,
  LeaderboardSortOrder,
  LeaderboardDisplayType,
  Id,
  LeaderboardEntries,
  UpsertedLeaderboardEntry,
} from "@wvdsh/sdk-js";

import { useWavedash } from "./WavedashProvider";

export type UseLeaderBoardReturnValue = {
  isLoading: boolean;
  leaderboard: Leaderboard | null;
  submitScore: (
    score: number,
    keepBest?: boolean,
    ugcId?: Id<"userGeneratedContent">,
  ) => Promise<UpsertedLeaderboardEntry | null>;
  getEntryCount: () => Promise<number>;
  getEntries: (
    start: number,
    count: number,
    friendsOnly?: boolean,
  ) => Promise<LeaderboardEntries>;
  getEntriesAroundCurrentUser: (
    countAhead: number,
    countBehind: number,
    friendsOnly?: boolean,
  ) => Promise<LeaderboardEntries>;
  getCurrentUserEntries: () => Promise<LeaderboardEntries>;
};

export type LeaderboardOptions = {
  sortOrder?: LeaderboardSortOrder;
  displayType?: LeaderboardDisplayType;
};

export function useLeaderboard(
  leaderboardName: string,
  leaderboardOptions?: LeaderboardOptions,
): UseLeaderBoardReturnValue {
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const onLeaderboardLoadedCallbacks = useRef<
    ((leaderboard: Leaderboard) => void)[]
  >([]);
  const { isRunningInWavedash, wavedash } = useWavedash();

  const { sortOrder, displayType } = leaderboardOptions ?? {};

  useEffect(() => {
    if (!isRunningInWavedash) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    wavedash
      .getOrCreateLeaderboard(
        leaderboardName,
        sortOrder ?? wavedash.LeaderboardSortOrder.DESC,
        displayType ?? wavedash.LeaderboardDisplayType.NUMERIC,
      )
      .then((result) => {
        if (result.success) {
          setLeaderboard(result.data);
          onLeaderboardLoadedCallbacks.current.forEach((callback) =>
            callback(result.data),
          );
          onLeaderboardLoadedCallbacks.current = [];
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isRunningInWavedash, wavedash, leaderboardName, sortOrder, displayType]);

  const waitForLeaderboardId = useCallback(async (): Promise<
    Id<"leaderboards">
  > => {
    if (!isRunningInWavedash) {
      return "" as Id<"leaderboards">;
    }

    if (leaderboard) {
      return leaderboard.id;
    }

    return new Promise((resolve) => {
      onLeaderboardLoadedCallbacks.current.push(
        (loadedLeaderboard: Leaderboard) => {
          resolve(loadedLeaderboard.id);
        },
      );
    });
  }, [isRunningInWavedash, leaderboard]);

  const submitScore = useCallback(
    async (
      score: number,
      keepBest: boolean = true,
      ugcId?: Id<"userGeneratedContent">,
    ): Promise<UpsertedLeaderboardEntry | null> => {
      if (!isRunningInWavedash) {
        return null;
      }

      const leaderboardId = await waitForLeaderboardId();

      const response = await wavedash.uploadLeaderboardScore(
        leaderboardId,
        score,
        keepBest,
        ugcId,
      );

      return response.success ? response.data : null;
    },
    [isRunningInWavedash, waitForLeaderboardId, wavedash],
  );

  const getEntryCount = useCallback(async (): Promise<number> => {
    if (!isRunningInWavedash) {
      return -1;
    }

    const leaderboardId = await waitForLeaderboardId();

    return wavedash.getLeaderboardEntryCount(leaderboardId);
  }, [isRunningInWavedash, waitForLeaderboardId, wavedash]);

  const getEntries = useCallback(
    async (
      start: number,
      count: number,
      friendsOnly?: boolean,
    ): Promise<LeaderboardEntries> => {
      if (!isRunningInWavedash) {
        return [];
      }

      const leaderboardId = await waitForLeaderboardId();

      const response = await wavedash.listLeaderboardEntries(
        leaderboardId,
        start,
        count,
        friendsOnly,
      );

      return response.success ? response.data : [];
    },
    [isRunningInWavedash, waitForLeaderboardId, wavedash],
  );

  const getEntriesAroundCurrentUser = useCallback(
    async (
      countAhead: number,
      countBehind: number,
      friendsOnly?: boolean,
    ): Promise<LeaderboardEntries> => {
      if (!isRunningInWavedash) {
        return [];
      }

      const leaderboardId = await waitForLeaderboardId();

      const response = await wavedash.listLeaderboardEntriesAroundUser(
        leaderboardId,
        countAhead,
        countBehind,
        friendsOnly,
      );

      return response.success ? response.data : [];
    },
    [isRunningInWavedash, waitForLeaderboardId, wavedash],
  );

  const getCurrentUserEntries =
    useCallback(async (): Promise<LeaderboardEntries> => {
      if (!isRunningInWavedash) {
        return [];
      }

      const leaderboardId = await waitForLeaderboardId();

      const response = await wavedash.getMyLeaderboardEntries(leaderboardId);
      return response.success ? response.data : [];
    }, [isRunningInWavedash, waitForLeaderboardId, wavedash]);

  return {
    isLoading,
    leaderboard,
    submitScore,
    getEntryCount,
    getEntries,
    getEntriesAroundCurrentUser,
    getCurrentUserEntries,
  };
}

export type LeaderboardAllEntriesOptions = {
  start: number;
  count: number;
  friendsOnly?: boolean;
};

export type LeaderboardAroundCurrentUserEntriesOptions = {
  countAhead: number;
  countBehind: number;
  friendsOnly?: boolean;
};

export function useLeaderboardEntries(
  leaderboardName: string,
  leaderboardEntriesOptions: LeaderboardAllEntriesOptions,
  leaderboardOptions?: LeaderboardOptions,
): { isLoading: boolean; entries: LeaderboardEntries } {
  const { isLoading: isLeaderboardLoading, getEntries } = useLeaderboard(
    leaderboardName,
    leaderboardOptions,
  );
  const [entries, setEntries] = useState<LeaderboardEntries>([]);

  const [areEntriesLoading, setAreEntriesLoading] = useState(true);

  const { start, count, friendsOnly } = leaderboardEntriesOptions;

  useEffect(() => {
    if (isLeaderboardLoading) {
      return;
    }

    setAreEntriesLoading(true);

    getEntries(start, count, friendsOnly)
      .then(setEntries)
      .finally(() => {
        setAreEntriesLoading(false);
      });
  }, [isLeaderboardLoading, getEntries, start, count, friendsOnly]);

  const isLoading = isLeaderboardLoading || areEntriesLoading;

  return {
    isLoading,
    entries,
  };
}

export function useLeaderboardCurrentUserEntries(
  leaderboardName: string,
  leaderboardOptions?: LeaderboardOptions,
): { isLoading: boolean; entries: LeaderboardEntries } {
  const { isLoading: isLeaderboardLoading, getCurrentUserEntries } =
    useLeaderboard(leaderboardName, leaderboardOptions);
  const [entries, setEntries] = useState<LeaderboardEntries>([]);
  const [areEntriesLoading, setAreEntriesLoading] = useState(true);

  useEffect(() => {
    if (isLeaderboardLoading) {
      return;
    }

    setAreEntriesLoading(true);
    getCurrentUserEntries()
      .then(setEntries)
      .finally(() => {
        setAreEntriesLoading(false);
      });
  }, [isLeaderboardLoading, getCurrentUserEntries]);

  const isLoading = isLeaderboardLoading || areEntriesLoading;

  return {
    isLoading,
    entries,
  };
}

export function useLeaderboardEntriesAroundCurrentUser(
  leaderboardName: string,
  leaderboardEntriesOptions: LeaderboardAroundCurrentUserEntriesOptions,
  leaderboardOptions?: LeaderboardOptions,
): { isLoading: boolean; entries: LeaderboardEntries } {
  const { isLoading: isLeaderboardLoading, getEntriesAroundCurrentUser } =
    useLeaderboard(leaderboardName, leaderboardOptions);
  const [entries, setEntries] = useState<LeaderboardEntries>([]);
  const [areEntriesLoading, setAreEntriesLoading] = useState(true);

  const { countAhead, countBehind, friendsOnly } = leaderboardEntriesOptions;

  useEffect(() => {
    if (isLeaderboardLoading) {
      return;
    }

    setAreEntriesLoading(true);
    getEntriesAroundCurrentUser(countAhead, countBehind, friendsOnly)
      .then(setEntries)
      .finally(() => {
        setAreEntriesLoading(false);
      });
  }, [
    isLeaderboardLoading,
    getEntriesAroundCurrentUser,
    countAhead,
    countBehind,
    friendsOnly,
  ]);

  const isLoading = isLeaderboardLoading || areEntriesLoading;

  return {
    isLoading,
    entries,
  };
}
