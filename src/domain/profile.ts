export const NICKNAME_MIN_LENGTH = 1;
export const NICKNAME_MAX_LENGTH = 32;

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_BUCKET = "avatars";

export type NicknameResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

export type AvatarFile = {
  size: number;
  type: string;
  name: string;
};

export function validateNickname(raw: string): NicknameResult {
  const value = (raw || "").trim();
  if (value.length < NICKNAME_MIN_LENGTH) {
    return { ok: false, message: "Enter a nickname." };
  }
  if (value.length > NICKNAME_MAX_LENGTH) {
    return { ok: false, message: `Keep your nickname to ${NICKNAME_MAX_LENGTH} characters or fewer.` };
  }
  return { ok: true, value };
}

export function validateAvatarFile(file: AvatarFile): NicknameResult {
  if (!AVATAR_MIME_TYPES.includes(file.type)) {
    return { ok: false, message: "Choose a JPEG, PNG, or WebP image." };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, message: "Choose an image smaller than 2 MB." };
  }
  if (file.size === 0) {
    return { ok: false, message: "That image looks empty. Try another one." };
  }
  return { ok: true, value: file.name };
}

function avatarExtension(filename: string, mimeType: string): string {
  const fromName = filename.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "webp"].includes(fromName)) return fromName === "jpg" ? "jpeg" : fromName;
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpeg";
}

export function avatarPathFor(userId: string, filename: string, mimeType: string, stamp: number): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9-]/g, "");
  return `${safeUser}/${stamp}.${avatarExtension(filename, mimeType)}`;
}
