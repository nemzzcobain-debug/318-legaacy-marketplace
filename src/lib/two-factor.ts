import crypto from 'crypto'

/**
 * 2FA TOTP Implementation for 318 LEGAACY Marketplace
 * Uses HMAC-based One-Time Password (HOTP/TOTP) algorithm
 * Compatible with Google Authenticator, Authy, etc.
 *
 * Required npm package: otpauth (install with: npm install otpauth)
 */

const APP_NAME = '318 LEGAACY Marketplace'

/**
 * Generate a random base32-encoded secret for TOTP
 */
export function generateTOTPSecret(): string {
  const buffer = crypto.randomBytes(20)
  return base32Encode(buffer)
}

/**
 * Generate the otpauth:// URI for QR code generation
 */
export function generateTOTPUri(secret: string, email: string): string {
  const encodedIssuer = encodeURIComponent(APP_NAME)
  const encodedEmail = encodeURIComponent(email)
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`
}

/**
 * Verify a TOTP code against a secret
 * Allows a time window of ±1 period (30 seconds) for clock drift
 */
export function verifyTOTP(secret: string, code: string): boolean {
  const period = 30
  const now = Math.floor(Date.now() / 1000)

  // Check current, previous, and next time window
  for (let i = -1; i <= 1; i++) {
    const counter = Math.floor((now + i * period) / period)
    const expectedCode = generateHOTP(secret, counter)
    if (expectedCode === code) return true
  }

  return false
}

/**
 * Generate backup codes (8 codes, each 8 characters)
 */
export function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  )
}

// Internal helpers

function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (let i = 0; i < buffer.length; i++) {
    bits += buffer[i].toString(2).padStart(8, '0')
  }
  let result = ''
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substring(i, i + 5).padEnd(5, '0')
    result += alphabet[parseInt(chunk, 2)]
  }
  return result
}

function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of encoded.toUpperCase()) {
    const val = alphabet.indexOf(char)
    if (val === -1) continue
    bits += val.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

function generateHOTP(secret: string, counter: number): string {
  const decodedSecret = base32Decode(secret)
  const buffer = Buffer.alloc(8)
  let tmp = counter
  for (let i = 7; i >= 0; i--) {
    buffer[i] = tmp & 0xff
    tmp = tmp >> 8
  }

  const hmac = crypto.createHmac('sha1', decodedSecret)
  hmac.update(buffer)
  const hmacResult = hmac.digest()

  const offset = hmacResult[hmacResult.length - 1] & 0xf
  const code = (
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff)
  ) % 1000000

  return code.toString().padStart(6, '0')
}
