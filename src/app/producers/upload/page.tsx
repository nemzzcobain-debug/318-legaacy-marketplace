'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import AudioPlayer from '@/components/audio/AudioPlayer'
import { Upload, Music, Image as ImageIcon, X, Check, Loader2, Wand2 } from 'lucide-react'
import { GENRES, MOODS } from '@/types'
import CoverGenerator from '@/components/ai/CoverGenerator'
// Upload utilise des signed URLs generees par l'API (contourne RLS + limite 4.5MB Vercel)

const KEYS = [
  'C Major',
  'C# Major',
  'D Major',
  'D# Major',
  'E Major',
  'F Major',
  'F# Major',
  'G Major',
  'G# Major',
  'A Major',
  'A# Major',
  'B Major',
  'C Minor',
  'C# Minor',
  'D Minor',
  'D# Minor',
  'E Minor',
  'F Minor',
  'F# Minor',
  'G Minor',
  'G# Minor',
  'A Minor',
  'A# Minor',
  'B Minor',
]

export default function UploadBeatPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioPreview, setAudioPreview] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [bpm, setBpm] = useState('')
  const [key, setKey] = useState('')
  const [mood, setMood] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')

  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)

  const [dragOver, setDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [showAiGenerator, setShowAiGenerator] = useState(false)
  const [aiCoverUrl, setAiCoverUrl] = useState<string | null>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (
      !['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav', 'audio/wave'].includes(file.type)
    ) {
      setError('Format non supporte. Utilise MP3 ou WAV.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('Le fichier ne doit pas depasser 50 MB.')
      return
    }

    setAudioFile(file)
    setAudioPreview(URL.createObjectURL(file))
    setError('')

    // Auto-fill title from filename
    if (!title) {
      const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      setTitle(name)
    }
  }

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!audioFile || !title || !genre || !bpm) {
      setError('Remplis tous les champs obligatoires (audio, titre, genre, BPM)')
      return
    }

    setUploading(true)
    setError('')

    try {
      const timestamp = Date.now()
      const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-')
      const audioExt = audioFile.name.split('.').pop() || 'mp3'
      const audioFileName = `${timestamp}-${slug}.${audioExt}`

      let coverFileName: string | null = null
      if (coverFile && coverFile.size > 0) {
        const coverExt = coverFile.name.split('.').pop() || 'jpg'
        coverFileName = `${timestamp}-cover.${coverExt}`
      }

      // 1. Obtenir les signed URLs depuis l'API
      setUploadProgress("Preparation de l'upload...")
      const signedRes = await fetch('/api/beats/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioFileName,
          audioContentType: audioFile.type,
          coverFileName,
          coverContentType: coverFile?.type || null,
        }),
      })

      const signedData = await signedRes.json()
      if (!signedRes.ok) {
        setError(signedData.error || 'Erreur preparation upload')
        setUploading(false)
        return
      }

      // 2. Upload audio directement vers Supabase avec le signed URL
      setUploadProgress('Upload du fichier audio...')
      const audioUploadRes = await fetch(signedData.audio.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': audioFile.type },
        body: audioFile,
      })

      if (!audioUploadRes.ok) {
        setError("Erreur lors de l'upload du fichier audio")
        setUploading(false)
        return
      }

      const audioUrl = signedData.audio.publicUrl

      // 3. Upload cover si fournie (fichier local ou URL IA)
      let coverUrl: string | null = null
      if (aiCoverUrl) {
        // Cover générée par IA — télécharger et uploader vers Supabase
        setUploadProgress('Transfert de la cover IA...')
        try {
          const aiRes = await fetch(aiCoverUrl)
          const aiBlob = await aiRes.blob()
          const aiCoverFileName = `${timestamp}-cover-ai.png`
          const aiSignedRes = await fetch('/api/beats/signed-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioFileName: null,
              audioContentType: null,
              coverFileName: aiCoverFileName,
              coverContentType: 'image/png',
            }),
          })
          const aiSignedData = await aiSignedRes.json()
          if (aiSignedRes.ok && aiSignedData.cover) {
            const aiUploadRes = await fetch(aiSignedData.cover.signedUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'image/png' },
              body: aiBlob,
            })
            if (aiUploadRes.ok) {
              coverUrl = aiSignedData.cover.publicUrl
            }
          }
        } catch (err) {
          console.error('AI cover upload error:', err)
        }
      } else if (coverFile && coverFile.size > 0 && signedData.cover) {
        setUploadProgress('Upload de la cover...')
        const coverUploadRes = await fetch(signedData.cover.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': coverFile.type },
          body: coverFile,
        })
        if (coverUploadRes.ok) {
          coverUrl = signedData.cover.publicUrl
        }
      }

      // 4. Envoyer les metadonnees a l'API
      setUploadProgress('Enregistrement du beat...')
      const res = await fetch('/api/beats/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          genre,
          bpm: parseInt(bpm),
          key: key || null,
          mood: mood || null,
          description: description || null,
          tags: tags
            ? tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
          audioUrl,
          coverUrl,
          audioFileName: audioFile.name,
          audioSize: audioFile.size,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erreur lors de l'enregistrement")
        return
      }

      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch (err) {
      console.error('Upload error:', err)
      setError('Erreur de connexion')
    } finally {
      setUploading(false)
      setUploadProgress('')
    }
  }

  const handleAudioDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    // Simulate change event by creating a synthetic target
    const fakeEvent = {
      target: { files: [file] },
    } as unknown as React.ChangeEvent<HTMLInputElement>
    handleAudioSelect(fakeEvent)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const removeAudio = () => {
    setAudioFile(null)
    setAudioPreview(null)
    setIsPlaying(false)
    if (audioInputRef.current) audioInputRef.current.value = ''
  }

  const removeCover = () => {
    setCoverFile(null)
    setCoverPreview(null)
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <Check size={40} className="text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Beat uploade !</h2>
          <p className="text-gray-400">Redirection vers le dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2">Upload un beat</h1>
          <p className="text-gray-400">Partage ton instrumentale et mets-la aux encheres</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Audio Upload */}
          <div>
            <label className="text-sm font-semibold text-white mb-2 block">
              Fichier audio <span className="text-red-400">*</span>
            </label>
            {!audioFile ? (
              <div
                onClick={() => audioInputRef.current?.click()}
                onDrop={handleAudioDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition group ${
                  dragOver
                    ? 'border-[#e11d48] bg-[#e11d4810]'
                    : 'border-[#1e1e2e] hover:border-[#e11d4840]'
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-[#e11d4810] flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition">
                  <Music size={28} className="text-[#e11d48]" />
                </div>
                <p className="text-white font-semibold mb-1">Glisse ton beat ici</p>
                <p className="text-gray-500 text-sm">MP3 ou WAV, max 50 MB</p>
              </div>
            ) : (
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Music size={16} className="text-[#e11d48]" />
                    <span className="text-sm text-white truncate max-w-[250px]">
                      {audioFile.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({(audioFile.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={removeAudio}
                    className="text-gray-500 hover:text-red-400 transition"
                  >
                    <X size={18} />
                  </button>
                </div>
                {audioPreview && (
                  <AudioPlayer
                    src={audioPreview}
                    compact
                    isPlaying={isPlaying}
                    onPlayToggle={() => setIsPlaying(!isPlaying)}
                  />
                )}
              </div>
            )}
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/mp3,audio/x-wav,audio/wave,audio/mp4,audio/aac,audio/ogg,audio/flac,.mp3,.wav,.m4a,.aac,.ogg,.flac"
              onChange={handleAudioSelect}
              className="hidden"
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="text-sm font-semibold text-white mb-2 block">Cover (optionnel)</label>
            {!coverPreview && !aiCoverUrl && !showAiGenerator ? (
              <div className="flex flex-wrap gap-3">
                <div
                  onClick={() => coverInputRef.current?.click()}
                  className="border-2 border-dashed border-[#1e1e2e] rounded-2xl p-6 text-center cursor-pointer hover:border-[#e11d4840] transition group inline-flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-lg bg-[#e11d4810] flex items-center justify-center group-hover:scale-110 transition">
                    <ImageIcon size={20} className="text-[#e11d48]" />
                  </div>
                  <div className="text-left">
                    <p className="text-white text-sm font-semibold">Ajouter une cover</p>
                    <p className="text-gray-500 text-xs">JPG, PNG, max 5 MB</p>
                  </div>
                </div>
                <div
                  onClick={() => setShowAiGenerator(true)}
                  className="border-2 border-dashed border-purple-500/20 rounded-2xl p-6 text-center cursor-pointer hover:border-purple-500/40 transition group inline-flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition">
                    <Wand2 size={20} className="text-purple-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-purple-300 text-sm font-semibold">Générer avec l&apos;IA</p>
                    <p className="text-gray-500 text-xs">DALL·E 3 — cover unique</p>
                  </div>
                </div>
              </div>
            ) : showAiGenerator && !aiCoverUrl ? (
              <CoverGenerator
                onSelect={(url) => {
                  setAiCoverUrl(url)
                  setShowAiGenerator(false)
                  setCoverFile(null)
                  setCoverPreview(null)
                }}
                onCancel={() => setShowAiGenerator(false)}
              />
            ) : coverPreview || aiCoverUrl ? (
              <div className="relative inline-block">
                <Image
                  src={(aiCoverUrl || coverPreview)!}
                  alt="Cover"
                  width={128}
                  height={128}
                  className="w-32 h-32 rounded-xl object-cover"
                  unoptimized={!!aiCoverUrl}
                />
                {aiCoverUrl && (
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-purple-600/80 backdrop-blur-sm">
                    <span className="text-[9px] text-white font-bold">IA</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    removeCover()
                    setAiCoverUrl(null)
                    setShowAiGenerator(false)
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center"
                >
                  <X size={12} className="text-white" />
                </button>
              </div>
            ) : null}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverSelect}
              className="hidden"
            />
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-semibold text-white mb-2 block">
              Titre <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Midnight Vendetta"
              className="w-full bg-[#13131a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4840] transition"
            />
          </div>

          {/* Genre + BPM + Key row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-semibold text-white mb-2 block">
                Genre <span className="text-red-400">*</span>
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-[#13131a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e11d4840] transition"
              >
                <option value="">Choisir</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-white mb-2 block">
                BPM <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(e.target.value)}
                placeholder="140"
                min="60"
                max="300"
                className="w-full bg-[#13131a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4840] transition"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-white mb-2 block">Tonalite</label>
              <select
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full bg-[#13131a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e11d4840] transition"
              >
                <option value="">Choisir</option>
                {KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mood */}
          <div>
            <label className="text-sm font-semibold text-white mb-2 block">Mood</label>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(mood === m ? '' : m)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold border transition ${
                    mood === m
                      ? 'text-[#e11d48] bg-[#e11d4815] border-[#e11d4830]'
                      : 'text-gray-400 bg-white/[0.02] border-[#1e1e2e] hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-semibold text-white mb-2 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Decris ton beat..."
              rows={3}
              className="w-full bg-[#13131a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4840] transition resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-semibold text-white mb-2 block">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="dark, trap, 808, hard (separes par des virgules)"
              className="w-full bg-[#13131a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4840] transition"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={uploading || !audioFile || !title || !genre || !bpm}
            className="w-full py-4 rounded-xl font-bold text-black text-base flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
          >
            {uploading ? (
              <>
                <Loader2 size={20} className="animate-spin" />{' '}
                {uploadProgress || 'Upload en cours...'}
              </>
            ) : (
              <>
                <Upload size={20} /> Publier le beat
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  )
}
