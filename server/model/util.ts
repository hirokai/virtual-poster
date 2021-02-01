import crypto from "crypto"

export const random_str = (N?: number): string => {
  const MAX_LENGTH = 100
  const MIN_LENGTH = 10
  N = N ? N : MIN_LENGTH + Math.floor(Math.random() * (MAX_LENGTH - MIN_LENGTH))
  return crypto
    .randomBytes(N)
    .toString("base64")
    .substring(0, N)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}
