const DEFAULT_BASE_URL = 'https://api.ircamamplify.io'

export type IrcamScanResult = {
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED'
  probability?: number
  suspectedModel?: string | null
  suspectedVersion?: string | null
  detectorVersion?: string | null
  error?: string | null
}

function getConfiguration() {
  const token = process.env.IRCAM_AMPLIFY_API_TOKEN?.trim()
  const baseUrl = (process.env.IRCAM_AMPLIFY_API_URL || DEFAULT_BASE_URL).replace(/\/$/, '')

  if (!token) {
    throw new Error('IRCAM_NOT_CONFIGURED')
  }

  return { token, baseUrl }
}

export function isIrcamAiMusicConfigured() {
  return Boolean(process.env.IRCAM_AMPLIFY_API_TOKEN?.trim())
}

async function ircamFetch(path: string, init?: RequestInit) {
  const { token, baseUrl } = getConfiguration()
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  })

  const raw = await response.text()
  let payload: any = null
  try {
    payload = raw ? JSON.parse(raw) : null
  } catch {
    payload = raw
  }

  if (!response.ok) {
    const message =
      payload?.detail || payload?.message || payload?.error || `IRCAM_HTTP_${response.status}`
    throw new Error(String(message))
  }

  return payload
}

export async function startIrcamAiMusicScan(audioUrl: string) {
  const payload = await ircamFetch('/aidetector/v2', {
    method: 'POST',
    body: JSON.stringify({
      audioUrlList: [audioUrl],
      timeAnalysis: true,
    }),
  })

  const jobId = payload?.id
  if (!jobId || typeof jobId !== 'string') {
    throw new Error('IRCAM_JOB_ID_MISSING')
  }

  return jobId
}

export async function getIrcamAiMusicScan(jobId: string): Promise<IrcamScanResult> {
  const payload = await ircamFetch(`/aidetector/v2/${encodeURIComponent(jobId)}`)
  const jobInfos = payload?.job_infos || payload
  const jobStatus = String(jobInfos?.job_status || '').toLowerCase()
  const report = jobInfos?.report_info?.report || jobInfos?.report || payload?.report
  const result = report?.resultList?.[0]

  if (result?.status === 'success') {
    const probability = Number(result.aiProbability)
    return {
      status: 'COMPLETED',
      probability: Number.isFinite(probability)
        ? Math.max(0, Math.min(100, Math.round(probability)))
        : undefined,
      suspectedModel: result.suspectedModel || null,
      suspectedVersion: result.modelVersion || null,
      detectorVersion: report.apiVersion || null,
    }
  }

  if (result?.status === 'error') {
    return {
      status: 'FAILED',
      error: result.message || report?.errorMessage || 'Analyse audio IRCAM impossible',
      detectorVersion: report?.apiVersion || null,
    }
  }

  if (['failed', 'error', 'cancelled', 'canceled'].includes(jobStatus)) {
    return {
      status: 'FAILED',
      error: report?.errorMessage || jobInfos?.error || 'Analyse audio IRCAM impossible',
      detectorVersion: report?.apiVersion || null,
    }
  }

  return { status: 'PROCESSING' }
}
