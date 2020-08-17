import { AxiosStatic } from "axios"

type EncryptedData = {
  iv: string
  data: string
}

type ExportedFormat = ArrayBuffer

export function decodeBase64URL2(data: string): Uint8Array {
  const decoded = atob(data)
  const buffer = new Uint8Array(decoded.length)
  for (let i = 0; i < data.length; i++) buffer[i] = decoded.charCodeAt(i)
  return buffer
}

export function encodeBase64URL2(data: Uint8Array): string {
  let output = ""
  for (let i = 0; i < data.length; i++) output += String.fromCharCode(data[i])
  return btoa(output)
}

export const encodingFunc: (a: Uint8Array) => string = encodeBase64URL2
export const decodingFunc: (a: string) => Uint8Array = decodeBase64URL2

// This does not work on Firefox
export async function exportPrivateKeyPKCS(key: CryptoKey): Promise<string> {
  const v = await crypto.subtle.exportKey("pkcs8", key)
  return encodingFunc(new Uint8Array(v))
}

export async function exportPrivateKeyJwk(key: CryptoKey): Promise<string> {
  const v = await crypto.subtle.exportKey("jwk", key)
  return JSON.stringify(v)
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const v = await crypto.subtle.exportKey("spki", key)
  return encodingFunc(new Uint8Array(v))
}

// https://stackoverflow.com/a/42590106
// Extended for private key
export async function fingerPrintOfJwk(jwk: JsonWebKey): Promise<string> {
  let s
  if (jwk["d"]) {
    s =
      '{"crv":"' +
      jwk.crv +
      '","d":"' +
      jwk.d +
      '","kty":"' +
      jwk.kty +
      '","x":"' +
      jwk.x +
      '","y":"' +
      jwk.y +
      '"}'
  } else {
    s =
      '{"crv":"' +
      jwk.crv +
      '","kty":"' +
      jwk.kty +
      '","x":"' +
      jwk.x +
      '","y":"' +
      jwk.y +
      '"}'
  }
  // console.log('fingerPrint(): json', s);
  const arr = new TextEncoder().encode(s)
  const hash_arr = await crypto.subtle.digest("SHA-256", arr)
  return encodingFunc(new Uint8Array(hash_arr))
}

export async function fingerPrintOfString(arr: string): Promise<string> {
  const hash_arr = await crypto.subtle.digest("SHA-256", decodingFunc(arr))
  return encodingFunc(new Uint8Array(hash_arr))
}

export function fromUint8Array(arr: Uint8Array): string {
  return new TextDecoder().decode(arr)
}

export async function fingerPrint(
  key: CryptoKey,
  privateKey = false
): Promise<string> {
  const s = await (privateKey ? exportPrivateKeyJwk(key) : exportPublicKey(key))
  return fingerPrintOfString(s)
}

export async function importPublicKey(
  s: string,
  exportable = false
): Promise<CryptoKey | null> {
  // console.log("importPublicKey", data)
  try {
    const data = decodingFunc(s)
    const key = await crypto.subtle.importKey(
      "spki",
      data,
      { name: "ECDH", namedCurve: "P-256" },
      exportable,
      // https://gist.github.com/pedrouid/b4056fd1f754918ddae86b32cf7d803e#ecdh---importkey
      // Usages must be empty for public keys
      []
    )
    // console.log("importPublicKey imported", key)

    return key
  } catch (err) {
    console.error(err)
    return null
  }
}

export async function importPrivateKeyPKCS(
  s: string,
  exportable = false
): Promise<CryptoKey> {
  const data = decodingFunc(s)
  const key = crypto.subtle.importKey(
    "pkcs8",
    data,
    { name: "ECDH", namedCurve: "P-256" },
    exportable,
    // https://gist.github.com/pedrouid/b4056fd1f754918ddae86b32cf7d803e#ecdh---importkey
    // Usages must be empty for public keys
    ["deriveKey", "deriveBits"]
  )
  return key
}

async function getEncryptionKey(
  remotePublicKey: CryptoKey,
  localPrivateKey: CryptoKey
): Promise<CryptoKey> {
  const bits = await crypto.subtle.deriveBits(
    // 鍵共有による共有鍵生成
    { name: "ECDH", public: remotePublicKey },
    localPrivateKey,
    128
  )
  // 共有鍵のSHA-256ハッシュ値を生成
  const digest = await crypto.subtle.digest({ name: "SHA-256" }, bits)
  // ハッシュ値の先頭16オクテットから128ビットAES-GCMの鍵を生成
  // console.log("Importing with digest: ", digest)
  const key = await crypto.subtle.importKey(
    "raw",
    digest.slice(0, 16),
    { name: "AES-GCM", length: 128 },
    true,
    ["encrypt", "decrypt"]
  )
  // console.log("Key obtained: ", key)
  return key
}

export async function encrypt(
  remotePublicKey: CryptoKey,
  localPrivateKey: CryptoKey,
  input: Uint8Array
): Promise<EncryptedData> {
  console.log("encrypt()")
  //   const fp1 = await fingerPrint1(remotePublicKey)
  //   const fp2 = await fingerPrint1(localPrivateKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  //   console.log("encrypt() start", iv, fromUint8Array(input), {
  //     remote_pub: fp1,
  //     self_prv: fp2,
  //     remotePublicKey,
  //   })

  if (!remotePublicKey || !localPrivateKey) {
    console.error("encrypt(): Keys must be non-null.")
    throw ""
  }
  const encryptionKey = await getEncryptionKey(remotePublicKey, localPrivateKey)
  console.log("encryptionKey", encryptionKey)
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    encryptionKey,
    input
  )
  // このresult(iv, data)を相手に渡す
  const result = {
    iv: encodingFunc(new Uint8Array(iv)),
    data: encodingFunc(new Uint8Array(data)),
  }
  return result
}

export async function decrypt(
  remotePublicKey: CryptoKey,
  localPrivateKey: CryptoKey,
  encrypted: EncryptedData
): Promise<Uint8Array | null> {
  //   const fp1 = await fingerPrint1(remotePublicKey)
  //   const fp2 = await fingerPrint1(localPrivateKey)
  try {
    const encryptionKey = await getEncryptionKey(
      remotePublicKey,
      localPrivateKey
    )
    // console.log('getEncryptionKey', { remotePublicKey, localPrivateKey, encryptionKey })
    // console.log(
    //   "decrypt start",
    //   decodingFunc(encrypted.iv),
    //   encryptionKey,
    //   remotePublicKey,
    //   localPrivateKey,
    //   encrypted
    // )
    // AES-GCMによる復号
    const data = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decodingFunc(encrypted.iv), tagLength: 128 },
      encryptionKey,
      decodingFunc(encrypted.data)
    )
    return new Uint8Array(data)
  } catch (err) {
    console.log(
      "decrypt() error",
      // { remote_pub: fp1, self_prv: fp2 },
      encrypted,
      err
    )
    return null
  }
}

// https://qiita.com/tomoyukilabs/items/eac94fdb2d0ca92f443a
export async function generateKeyPair(
  exportable = false
): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    exportable,
    ["deriveKey", "deriveBits"]
  )
}

// https://stackoverflow.com/questions/34946642/convert-string-to-uint8array-in-javascript
export function toUint8Array(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

export async function encrypt_str(
  remotePublicKey: CryptoKey,
  localPrivateKey: CryptoKey,
  input: string
): Promise<string> {
  const encrypted = await encrypt(
    remotePublicKey,
    localPrivateKey,
    toUint8Array(input)
  )
  return encrypted.iv + ":" + encrypted.data
}

export async function decrypt_str(
  remotePublicKey: CryptoKey,
  localPrivateKey: CryptoKey,
  encrypted: string
): Promise<string | null> {
  const cs = encrypted.split(":")
  const data = { iv: cs[0], data: cs[1] }
  const decrypted = await decrypt(remotePublicKey, localPrivateKey, data)
  return decrypted ? fromUint8Array(decrypted) : null
}

export async function importPrivateKeyJwk(
  data: JsonWebKey,
  publicKey: CryptoKey,
  exportable = false
): Promise<CryptoKey | null> {
  try {
    console.log("importPrivateKeyJwk() importing", data)
    const key = await crypto.subtle.importKey(
      "jwk",
      data,
      { name: "ECDH", namedCurve: "P-256" },
      exportable,
      // https://gist.github.com/pedrouid/b4056fd1f754918ddae86b32cf7d803e#ecdh---importkey
      // Usages must be empty for public keys
      ["deriveKey", "deriveBits"]
    )
    console.log("Imported key", key)
    const s = "Test string"
    const enc = await encrypt_str(publicKey, key, s)
    const s2 = await decrypt_str(publicKey, key, enc)
    if (s == s2) {
      return key
    } else {
      return null
    }
  } catch (err) {
    console.error(err)
    return null
  }
}

export async function generateAndSendKeys(
  axios: AxiosStatic,
  user_id: string,
  force = false
): Promise<{ ok: boolean; pub_str?: string; prv_str?: string }> {
  try {
    const { data: data1 } = await axios.get("/encryption_keys")
    const existing = !!data1.public_key
    if (existing && force) {
      const r = confirm(
        "鍵ペアを新たに作成してサーバーにアップロードしてもよいですか？ 以前の暗号化メッセージはすべて読めなくなります。"
      )
      if (!r) {
        return { ok: false }
      }
    } else if (existing && !force) {
      return { ok: false }
    }
    const keys = await generateKeyPair(true)
    const pub_str = await exportPublicKey(keys.publicKey)
    const prv_str = await exportPrivateKeyJwk(keys.privateKey)
    localStorage[
      "virtual-poster:" + user_id + ":public_key_spki_backup:" + Date.now()
    ] = localStorage["virtual-poster:" + user_id + ":public_key_spki"]
    localStorage[
      "virtual-poster:" + user_id + ":private_key_jwk_backup:" + Date.now()
    ] = localStorage["virtual-poster:" + user_id + ":private_key_jwk"]
    localStorage["virtual-poster:" + user_id + ":public_key_spki"] = pub_str
    localStorage["virtual-poster:" + user_id + ":private_key_jwk"] = prv_str
    const { data } = await axios.post("/public_key", { key: pub_str, force })
    return { ok: !!data.ok, pub_str, prv_str }
  } catch (err) {
    return { ok: false }
  }
}
