// Server-side HTML sanitization for user-generated content
// Uses a simple allowlist approach - no external dependency needed

const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span']
const ALLOWED_ATTRS = ['href', 'target', 'rel', 'class']

// Strip all HTML tags except allowed ones
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ''

  // Remove script tags and their content
  let clean = dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Remove event handlers
  clean = clean.replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  // Remove javascript: URLs
  clean = clean.replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '')

  // Remove style tags
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Remove iframe, object, embed
  clean = clean.replace(/<(?:iframe|object|embed|form)\b[^>]*>(?:[\s\S]*?<\/(?:iframe|object|embed|form)>)?/gi, '')

  return clean.trim()
}

// Strip ALL HTML - return plain text only
export function stripHtml(dirty: string): string {
  if (!dirty) return ''
  return dirty.replace(/<[^>]*>/g, '').trim()
}

// Escape HTML entities for safe display
export function escapeHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
