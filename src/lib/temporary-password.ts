import { randomInt } from "node:crypto";

const DIGITS = "0123456789";

function pick(source: string) {
  return source[randomInt(0, source.length)];
}

export function generateTemporaryPassword(length = 6) {
  if (length < 6) throw new Error("Temporary passwords must contain at least 6 digits.");
  const characters: string[] = [];
  while (characters.length < length) characters.push(pick(DIGITS));
  return characters.join("");
}
