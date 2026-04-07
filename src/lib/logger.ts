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

function formatMessage(level: LogLevel, message: string, context?: LogContext) {
  const timestamp = new Date().toISOString()
  const requestId = context?.requestId || crypto.randomUUID().slice(0, 8)

  if (process.env.NODE_ENV === 'production') {
    // JSON format for production (structured logging)
    return JSON.stringify({
      timestamp,
      level,
      message,
      requestId,
      ...context,
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
  return `${levelColors[level]}[${level.toUpperCase()}]${reset} ${timestamp} [${requestId}] ${message}${context ? ' ' + JSON.stringify(context) : ''}`
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
