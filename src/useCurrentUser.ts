import { useWavedash } from "./WavedashProvider";

export default function useCurrentUser() {
  const { isRunningInWavedash, wavedash } = useWavedash();

  if (!isRunningInWavedash) {
    return null;
  }

  return wavedash.getUser();
}
