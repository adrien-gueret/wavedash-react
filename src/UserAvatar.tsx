import type { ReactNode } from "react";
import { type Id } from "@wvdsh/sdk-js";

import { useWavedash } from "./WavedashProvider";

export type UserAvatarProps = {
  userId?: Id<"users">;
  size?: number;
  defaultAvatar?: ReactNode;
};

export default function UserAvatar({
  userId,
  size,
  defaultAvatar = null,
}: UserAvatarProps) {
  const { isRunningInWavedash, wavedash } = useWavedash();

  if (!isRunningInWavedash) {
    return defaultAvatar;
  }

  const finalUserId = userId ?? wavedash.getUserId();
  const finalSize = size ?? wavedash.AvatarSize.SMALL;

  const userAvatarUrl = wavedash.getUserAvatarUrl(finalUserId, finalSize);

  return userAvatarUrl ? (
    <img src={userAvatarUrl} alt="" width={finalSize} height={finalSize} />
  ) : (
    defaultAvatar
  );
}
