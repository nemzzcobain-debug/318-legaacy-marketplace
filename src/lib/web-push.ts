import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign as signJwt,
} from 'crypto'
import { prisma } from '@/lib/prisma'

const RECORD_SIZE = 4096
const MAX_PLAINTEXT_BYTES = 3993

export interface StoredPushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushPayload {
  title: string
  body: string
  url: string
  tag?: string
}

export class WebPushError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message)
    this.name = 'WebPushError'
  }
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

function toBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url')
}

function hmacSha256(key: Buffer, data: Buffer): Buffer {
  return createHmac('sha256', key).update(data).digest()
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
  return hmacSha256(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, length)
}

/**
 * Chiffre un payload conformément à RFC 8291 (aes128gcm).
 * Les paramètres fixes servent aussi à vérifier l'algorithme avec le vecteur
 * de test officiel ; en production ils restent aléatoires.
 */
export function encryptWebPushPayload(
  payload: Buffer,
  subscription: Pick<StoredPushSubscription, 'p256dh' | 'auth'>,
  options?: { salt?: Buffer; senderPrivateKey?: Buffer }
): Buffer {
  if (payload.length > MAX_PLAINTEXT_BYTES) {
    throw new WebPushError(`Payload push trop volumineux (${payload.length} octets)`)
  }

  const receiverPublicKey = fromBase64Url(subscription.p256dh)
  const authSecret = fromBase64Url(subscription.auth)

  if (receiverPublicKey.length !== 65 || receiverPublicKey[0] !== 4) {
    throw new WebPushError('Clé p256dh invalide')
  }
  if (authSecret.length !== 16) {
    throw new WebPushError('Secret auth invalide')
  }

  const sender = createECDH('prime256v1')
  if (options?.senderPrivateKey) {
    sender.setPrivateKey(options.senderPrivateKey)
  } else {
    sender.generateKeys()
  }

  const senderPublicKey = sender.getPublicKey(undefined, 'uncompressed')
  const sharedSecret = sender.computeSecret(receiverPublicKey)
  const salt = options?.salt || randomBytes(16)

  if (salt.length !== 16) {
    throw new WebPushError('Sel de chiffrement invalide')
  }

  // RFC 8291, section 3.4.
  const prkKey = hmacSha256(authSecret, sharedSecret)
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'ascii'),
    receiverPublicKey,
    senderPublicKey,
  ])
  const ikm = hkdfExpand(prkKey, keyInfo, 32)
  const prk = hmacSha256(salt, ikm)
  const cek = hkdfExpand(prk, Buffer.from('Content-Encoding: aes128gcm\0', 'ascii'), 16)
  const nonce = hkdfExpand(prk, Buffer.from('Content-Encoding: nonce\0', 'ascii'), 12)

  // Un unique record, terminé par le délimiteur final 0x02.
  const plaintext = Buffer.concat([payload, Buffer.from([2])])
  const cipher = createCipheriv('aes-128-gcm', cek, nonce)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()])

  const header = Buffer.alloc(21)
  salt.copy(header, 0)
  header.writeUInt32BE(RECORD_SIZE, 16)
  header.writeUInt8(senderPublicKey.length, 20)

  return Buffer.concat([header, senderPublicKey, ciphertext])
}

function createVapidAuthorization(endpoint: string): string {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT

  if (!publicKey || !privateKey || !subject) {
    throw new WebPushError('Configuration VAPID incomplète')
  }
  if (!subject.startsWith('mailto:') && !subject.startsWith('https://')) {
    throw new WebPushError('VAPID_SUBJECT doit commencer par mailto: ou https://')
  }

  const publicKeyBytes = fromBase64Url(publicKey)
  const privateKeyBytes = fromBase64Url(privateKey)
  if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 4 || privateKeyBytes.length !== 32) {
    throw new WebPushError('Clés VAPID invalides')
  }

  const audience = new URL(endpoint).origin
  const header = toBase64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const claims = toBase64Url(
    JSON.stringify({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: subject,
    })
  )
  const unsignedToken = `${header}.${claims}`

  const privateJwk = {
    kty: 'EC',
    crv: 'P-256',
    x: toBase64Url(publicKeyBytes.subarray(1, 33)),
    y: toBase64Url(publicKeyBytes.subarray(33, 65)),
    d: toBase64Url(privateKeyBytes),
  }
  const signingKey = createPrivateKey({ key: privateJwk, format: 'jwk' })
  const signature = signJwt('sha256', Buffer.from(unsignedToken), {
    key: signingKey,
    dsaEncoding: 'ieee-p1363',
  })

  return `vapid t=${unsignedToken}.${toBase64Url(signature)}, k=${publicKey}`
}

export async function sendWebPush(
  subscription: StoredPushSubscription,
  payload: PushPayload
): Promise<void> {
  const endpoint = new URL(subscription.endpoint)
  if (endpoint.protocol !== 'https:') {
    throw new WebPushError('Endpoint push non sécurisé')
  }

  const encryptedBody = encryptWebPushPayload(
    Buffer.from(JSON.stringify(payload), 'utf8'),
    subscription
  )

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: createVapidAuthorization(subscription.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '300',
      Urgency: 'high',
    },
    body: encryptedBody.buffer.slice(
      encryptedBody.byteOffset,
      encryptedBody.byteOffset + encryptedBody.byteLength
    ) as ArrayBuffer,
  })

  if (!response.ok) {
    throw new WebPushError(
      `Le service push a répondu ${response.status}`,
      response.status
    )
  }
}

/**
 * Envoie l'alerte sur tous les appareils de l'utilisateur.
 * Les abonnements expirés sont nettoyés automatiquement.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  if (
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY ||
    !process.env.VAPID_SUBJECT
  ) {
    console.warn('[WEB_PUSH] Configuration VAPID absente')
    return { sent: 0, failed: 0, removed: 0 }
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, p256dh: true, auth: true },
  })

  let sent = 0
  let failed = 0
  const expiredEndpoints: string[] = []

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await sendWebPush(subscription, payload)
        sent += 1
      } catch (error) {
        failed += 1
        if (
          error instanceof WebPushError &&
          (error.statusCode === 404 || error.statusCode === 410)
        ) {
          expiredEndpoints.push(subscription.endpoint)
        } else {
          console.warn('[WEB_PUSH] Échec envoi:', String(error))
        }
      }
    })
  )

  if (expiredEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: expiredEndpoints } },
    })
  }

  return { sent, failed, removed: expiredEndpoints.length }
}
