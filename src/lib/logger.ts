// Lightweight structured logger for Next.js
// In production, outputs JSON; in development, outputs pretty-printed logs

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

// F3 FIX: Filtrer les données sensibles avant de les logger
const SENSITIVE_KEYS = ['password', 'passwd', 'secret', 'token', 'authorization', 'cookie', 'creditcard', 'cardnumber', 'cvv', 'ssn', 'apikey', 'api_key', 'access_token', 'refresh_token']

function sanitizeContext(obj: LogContext): LogContext {
  const sanitized: LogContext = {}
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]'
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeContext(value as LogContext)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

function formatMessage(level: LogLevel, message: string, context?: LogContext) {
  const timestamp = new Date().toISOString()
  const safeContext = context ? sanitizeContext(context) : undefined
  const requestId = safeContext?.requestId || crypto.randomUUID().slice(0, 8)

  if (process.env.NODE_ENV === 'production') {
    // JSON format for production (structured logging)
    return JSON.stringify({
      timestamp,
      level,
      message,
      requestId,
      ...safeContext,
    })
  }

  // Pretty format for development
  const levelColors: Record<LogLevel, string> = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m',  // green
    warn: '\x1b[33m',  // yellow
    error: '\x1b[31m', // red
  }
  const reset = '\x1b[0m'
  return `${levelColors[level]}[${level.toUpperCase()}]${reset} ${timestamp} [${requestId}] ${message}${safeContext ? ' ' + JSON.stringify(safeContext) : ''}`
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (shouldLog('debug')) console.debug(formatMessage('debug', message, context))
  },
  info(message: string, context?: LogContext) {
    if (shouldLog('info')) console.info(formatMessage('info', message, context))
  },
  warn(message: string, context?: LogContext) {
    if (shouldLog('warn')) console.warn(formatMessage('warn', message, context))
  },
  error(message: string, context?: LogContext) {
    if (shouldLog('error')) console.error(formatMessage('error', message, context))
  },
}

export default logger
