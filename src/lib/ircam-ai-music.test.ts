import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getIrcamAiMusicScan,
  isIrcamAiMusicConfigured,
  startIrcamAiMusicScan,
} from './ircam-ai-music'

describe('IRCAM AI Music Detector', () => {
  beforeEach(() => {
    process.env.IRCAM_AMPLIFY_API_TOKEN = 'test-token'
    delete process.env.IRCAM_AMPLIFY_API_URL
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.IRCAM_AMPLIFY_API_TOKEN
    delete process.env.IRCAM_AMPLIFY_API_URL
  })

  it('indique si le fournisseur est configuré', () => {
    expect(isIrcamAiMusicConfigured()).toBe(true)
    delete process.env.IRCAM_AMPLIFY_API_TOKEN
    expect(isIrcamAiMusicConfigured()).toBe(false)
  })

  it('lance une analyse avec une URL audio temporaire', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'job-318' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await expect(startIrcamAiMusicScan('https://audio.test/beat.wav')).resolves.toBe('job-318')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.ircamamplify.io/aidetector/v2',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          audioUrlList: ['https://audio.test/beat.wav'],
          timeAnalysis: true,
        }),
      })
    )
  })

  it('normalise un résultat IRCAM terminé', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          job_infos: {
            job_status: 'success',
            report_info: {
              report: {
                apiVersion: '2.1',
                resultList: [
                  {
                    status: 'success',
                    aiProbability: 98.4,
                    suspectedModel: 'Suno',
                    modelVersion: '5.5',
                  },
                ],
              },
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    await expect(getIrcamAiMusicScan('job-318')).resolves.toEqual({
      status: 'COMPLETED',
      probability: 98,
      suspectedModel: 'Suno',
      suspectedVersion: '5.5',
      detectorVersion: '2.1',
    })
  })

  it('ne transforme pas une analyse en cours en résultat définitif', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ job_infos: { job_status: 'processing' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await expect(getIrcamAiMusicScan('job-318')).resolves.toEqual({ status: 'PROCESSING' })
  })
})
