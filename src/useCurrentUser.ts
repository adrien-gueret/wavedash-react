import { useWavedash } from "./WavedashProvider";

export function useCurrentUser() {
  const { isRunningInWavedash, wavedash } = useWavedash();

  if (!isRunningInWavedash) {
    return null;
  }

  return wavedash.getUser();
}
