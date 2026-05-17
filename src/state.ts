import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";

import { useWavedash } from "./WavedashProvider";
import {
  createSaveController,
  type SaveController,
  type SaveLoadStatus,
  type SaveMeta,
  type SaveOptions,
} from "./save";

export type { SaveLoadStatus };

export type { SaveMeta, SaveOptions };

export type State = Record<string, any>;

type Listener = () => void;

type StateStore<T extends State> = {
  getState: () => T;
  setState: (next: T) => void;
  subscribe: (listener: Listener) => () => void;
  destroy: () => void;
};

function createStateStore<T extends State>(initialState: T): StateStore<T> {
  let state: T = initialState;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    setState: (next) => {
      if (Object.is(next, state)) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    destroy: () => {
      listeners.clear();
    },
  };
}

export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  ) {
    return false;
  }

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (
      !Object.is(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    ) {
      return false;
    }
  }

  return true;
}

type AnyStateActions<T> = Record<string, (state: T, ...args: any[]) => T>;

export type StateDefinition<T extends State, A extends AnyStateActions<T>> = {
  initialState: T;
  actions: A;
};

export function defineState<
  T extends State,
  A extends AnyStateActions<T>,
>(state: { initialState: T; actions: A }): StateDefinition<T, A> {
  return state;
}

type BoundAction<H> = H extends (state: any, ...args: infer Args) => infer R
  ? (...args: Args) => R
  : never;

type BoundActions<A> = { [K in keyof A]: BoundAction<A[K]> };

export type SaveControls = {
  saveNow: (fileName?: string) => Promise<boolean>;
  load: (fileName?: string) => Promise<boolean>;
};

export type StateProviderProps = {
  children: ReactNode;
  saveOptions?: SaveOptions;
};

type ProviderHooks = {
  StateProvider: (
    props: StateProviderProps,
  ) => ReturnType<typeof createElement>;
};

type UiHooks<TUi extends State, AUi extends AnyStateActions<TUi>> = {
  useUiSelector: <Selected>(
    selector: (state: TUi) => Selected,
    isEqual?: (a: Selected, b: Selected) => boolean,
  ) => Selected;
  useUiSelectorShallow: <Selected>(
    selector: (state: TUi) => Selected,
  ) => Selected;
  useUiActions: () => BoundActions<AUi>;
};

type PersistentHooks<
  TPersistent extends State,
  APersistent extends AnyStateActions<TPersistent>,
> = {
  usePersistentSelector: <Selected>(
    selector: (state: TPersistent) => Selected,
    isEqual?: (a: Selected, b: Selected) => boolean,
  ) => Selected;
  usePersistentSelectorShallow: <Selected>(
    selector: (state: TPersistent) => Selected,
  ) => Selected;
  usePersistentActions: () => BoundActions<APersistent>;
  usePersistentMeta: () => SaveMeta;
  usePersistentControls: () => SaveControls;
};

const DEFAULT_FILE_NAME = "main";
const DEFAULT_AUTO_SAVE_DEBOUNCE_MS = 500;

type SaveLayerContextValue = {
  save: SaveController | null;
  autoSaveDefault: boolean;
  canAutoSave: boolean;
};

export function createStateContext<
  TUi extends State,
  AUi extends AnyStateActions<TUi>,
>(states: { ui: StateDefinition<TUi, AUi> }): ProviderHooks & UiHooks<TUi, AUi>;
export function createStateContext<
  TPersistent extends State,
  APersistent extends AnyStateActions<TPersistent>,
>(states: {
  persistent: StateDefinition<TPersistent, APersistent>;
}): ProviderHooks & PersistentHooks<TPersistent, APersistent>;
export function createStateContext<
  TUi extends State,
  AUi extends AnyStateActions<TUi>,
  TPersistent extends State,
  APersistent extends AnyStateActions<TPersistent>,
>(states: {
  ui: StateDefinition<TUi, AUi>;
  persistent: StateDefinition<TPersistent, APersistent>;
}): ProviderHooks &
  UiHooks<TUi, AUi> &
  PersistentHooks<TPersistent, APersistent>;
export function createStateContext(states: {
  ui?: StateDefinition<State, AnyStateActions<State>>;
  persistent?: StateDefinition<State, AnyStateActions<State>>;
}): ProviderHooks &
  Partial<UiHooks<State, AnyStateActions<State>>> &
  Partial<PersistentHooks<State, AnyStateActions<State>>> {
  const uiState = states.ui;
  const persistentStateDefinition = states.persistent;

  if (!uiState && !persistentStateDefinition) {
    throw new Error(
      "[wavedash-react] createStateContext requires at least one of " +
        "`ui` or `persistent` state.",
    );
  }

  const uiActions = uiState?.actions ?? {};
  const persistentActions = persistentStateDefinition?.actions ?? {};

  const UiStoreContext = createContext<StateStore<State> | null>(null);
  const SaveStoreContext = createContext<StateStore<State> | null>(null);

  const SaveLayerContext = createContext<SaveLayerContextValue>({
    save: null,
    autoSaveDefault: false,
    canAutoSave: false,
  });

  function StateProvider({ children, saveOptions }: StateProviderProps) {
    const { wavedash } = useWavedash();
    const uiStore = useMemo(
      () => (uiState ? createStateStore<State>(uiState.initialState) : null),
      [],
    );
    const saveStore = useMemo(
      () =>
        persistentStateDefinition
          ? createStateStore<State>(persistentStateDefinition.initialState)
          : null,
      [],
    );

    const fileName = saveOptions?.fileName ?? DEFAULT_FILE_NAME;
    const autoLoad = saveOptions?.autoLoad ?? false;
    const autoSaveDefault = saveOptions?.autoSave ?? false;
    const saveEnabled = saveStore !== null;
    const [hasFinishedInitialLoad, setHasFinishedInitialLoad] = useState(
      !saveEnabled || !autoLoad,
    );
    const autoSaveDebounceMs =
      saveOptions?.autoSaveDebounceMs ?? DEFAULT_AUTO_SAVE_DEBOUNCE_MS;

    const save = useMemo(() => {
      if (!saveEnabled || !saveStore) return null;
      return createSaveController<State>({
        getState: saveStore.getState,
        setState: saveStore.setState,
        fileName,
        autoSaveDebounceMs,
      });
    }, [saveEnabled, saveStore, fileName, autoSaveDebounceMs]);

    const value = useMemo<SaveLayerContextValue>(
      () => ({ save, autoSaveDefault, canAutoSave: hasFinishedInitialLoad }),
      [save, autoSaveDefault, hasFinishedInitialLoad],
    );

    useEffect(() => {
      if (!save) return;
      save.setWavedash(wavedash ?? undefined);
    }, [wavedash, save]);

    useEffect(() => {
      if (!save || !autoLoad) {
        setHasFinishedInitialLoad(true);
        return;
      }
      let cancelled = false;
      setHasFinishedInitialLoad(false);
      void save.load(fileName).finally(() => {
        if (!cancelled) {
          setHasFinishedInitialLoad(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [save, autoLoad, fileName]);

    useEffect(() => {
      return () => {
        save?.destroy();
      };
    }, [save]);

    useEffect(() => {
      return () => {
        uiStore?.destroy();
      };
    }, [uiStore]);

    useEffect(() => {
      return () => {
        saveStore?.destroy();
      };
    }, [saveStore]);

    const saveLayer = createElement(
      SaveLayerContext.Provider,
      { value },
      children,
    );
    const saveStoreLayer = createElement(
      SaveStoreContext.Provider,
      { value: saveStore },
      saveLayer,
    );
    return createElement(
      UiStoreContext.Provider,
      { value: uiStore },
      saveStoreLayer,
    );
  }

  const result: ProviderHooks &
    Partial<UiHooks<State, AnyStateActions<State>>> &
    Partial<PersistentHooks<State, AnyStateActions<State>>> = {
    StateProvider,
  };

  if (uiState) {
    function useUiSelector<Selected>(
      selector: (state: State) => Selected,
      isEqual: (a: Selected, b: Selected) => boolean = Object.is,
    ): Selected {
      const uiStore = useContext(UiStoreContext);
      if (!uiStore) {
        throw new Error(
          "[wavedash-react] useUiSelector requires <StateProvider /> with a ui state.",
        );
      }
      return useSyncExternalStoreWithSelector(
        uiStore.subscribe,
        uiStore.getState,
        uiStore.getState,
        selector,
        isEqual,
      );
    }

    function useUiActions() {
      const uiStore = useContext(UiStoreContext);
      if (!uiStore) {
        throw new Error(
          "[wavedash-react] useUiActions requires <StateProvider /> with a ui state.",
        );
      }
      return useMemo(() => {
        const bound: Record<string, (...args: any[]) => any> = {};
        for (const type of Object.keys(uiActions)) {
          const handler = uiActions[type];
          bound[type] = (...args: any[]) => {
            const nextState = handler(uiStore.getState(), ...args);
            uiStore.setState(nextState);
            return nextState;
          };
        }
        return bound as any;
      }, [uiStore]);
    }

    result.useUiSelector = useUiSelector;
    result.useUiSelectorShallow = (selector) =>
      useUiSelector(selector, shallowEqual);
    result.useUiActions = useUiActions;
  }

  if (persistentStateDefinition) {
    function usePersistentSelector<Selected>(
      selector: (state: State) => Selected,
      isEqual: (a: Selected, b: Selected) => boolean = Object.is,
    ): Selected {
      const saveStore = useContext(SaveStoreContext);
      if (!saveStore) {
        throw new Error(
          "[wavedash-react] usePersistentSelector requires <StateProvider /> with a persistent state.",
        );
      }
      return useSyncExternalStoreWithSelector(
        saveStore.subscribe,
        saveStore.getState,
        saveStore.getState,
        selector,
        isEqual,
      );
    }

    result.usePersistentSelector = usePersistentSelector;
    result.usePersistentSelectorShallow = (selector) =>
      usePersistentSelector(selector, shallowEqual);

    function usePersistentActions() {
      const saveStore = useContext(SaveStoreContext);
      if (!saveStore) {
        throw new Error(
          "[wavedash-react] usePersistentActions requires <StateProvider /> with a persistent state.",
        );
      }
      const { save, autoSaveDefault, canAutoSave } =
        useContext(SaveLayerContext);
      return useMemo(() => {
        const bound: Record<string, (...args: any[]) => any> = {};
        for (const type of Object.keys(persistentActions)) {
          const handler = persistentActions[type];
          bound[type] = (...args: any[]) => {
            const nextState = handler(saveStore.getState(), ...args);
            saveStore.setState(nextState);
            if (save && autoSaveDefault && canAutoSave) save.scheduleSave();
            return nextState;
          };
        }
        return bound as any;
      }, [saveStore, save, autoSaveDefault, canAutoSave]);
    }

    result.usePersistentActions = usePersistentActions;

    result.usePersistentMeta = () => {
      const { save } = useContext(SaveLayerContext);
      if (!save) {
        throw new Error(
          "[wavedash-react] usePersistentMeta requires <StateProvider /> with a persistent state.",
        );
      }
      return useSyncExternalStore(
        save.subscribeMeta,
        save.getMeta,
        save.getMeta,
      );
    };

    result.usePersistentControls = () => {
      const { save } = useContext(SaveLayerContext);
      if (!save) {
        throw new Error(
          "[wavedash-react] usePersistentControls requires <StateProvider /> with a persistent state.",
        );
      }
      const saveNow = useCallback(
        (fileName?: string) => save.saveNow(fileName),
        [save],
      );
      const load = useCallback(
        (fileName?: string) => save.load(fileName),
        [save],
      );
      return { saveNow, load };
    };
  }

  return result;
}
