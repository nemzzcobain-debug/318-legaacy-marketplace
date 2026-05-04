'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import AudioPlayer from '@/components/audio/AudioPlayer'
import {
  Upload,
  Music,
  Image as ImageIcon,
  X,
  Check,
  Loader2,
  Wand2,
  Gavel,
  Clock,
  DollarSign,
  Tag,
  FileAudio,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react'
import { GENRES, MOODS } from '@/types'
import CoverGenerator from '@/components/ai/CoverGenerator'
// Upload utilise des signed URLs générées par l'API (contourne RLS + limite 4.5MB Vercel)

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
  const [wavFile, setWavFile] = useState<File | null>(null)
  const [stemFiles, setStemFiles] = useState<File[]>([])
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)

  // Prix licences
  const [priceMp3, setPriceMp3] = useState('')
  const [priceWav, setPriceWav] = useState('')
  const [priceStems, setPriceStems] = useState('')

  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [bpm, setBpm] = useState('')
  const [key, setKey] = useState('')
  const [mood, setMood] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')

  // Auction fields
  const [enableAuction, setEnableAuction] = useState(true)
  const [startPrice, setStartPrice] = useState('10')
  const [premiumPrice, setPremiumPrice] = useState('25')
  const [exclusivePrice, setExclusivePrice] = useState('100')
  const [buyNowPrice, setBuyNowPrice] = useState('')
  const [auctionDuration, setAuctionDuration] = useState('24')
  const [licenseType, setLicenseType] = useState('BASIC')
  const [bidIncrement, setBidIncrement] = useState('5')

  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)

  const [dragOver, setDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [showAiGenerator, setShowAiGenerator] = useState(false)
  const [aiCoverUrl, setAiCoverUrl] = useState<string | null>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const wavInputRef = useRef<HTMLInputElement>(null)
  const stemsInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/x-m4a', 'audio/x-flac', 'audio/webm', 'application/octet-stream', '']
    const allowedExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.webm']
    const fileExt = '.' + (file.name.split('.').pop()?.toLowerCase() || '')
    if (!allowedMimeTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
      setError('Format non supporte. Utilise MP3, WAV, FLAC, M4A ou OGG.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('Le fichier ne doit pas dépasser 50 MB.')
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

  const handleWavSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'wav') {
      setError('Le fichier doit être au format WAV')
      return
    }
    if (file.size > 200 * 1024 * 1024) {
      setError('Le fichier WAV ne doit pas dépasser 200 MB')
      return
    }
    setWavFile(file)
    setError('')
  }

  const handleStemsSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const invalidFiles = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase()
      return ext !== 'wav'
    })
    if (invalidFiles.length > 0) {
      setError('Tous les stems doivent être au format WAV')
      return
    }
    const totalSize = files.reduce((sum, f) => sum + f.size, 0)
    if (totalSize > 500 * 1024 * 1024) {
      setError('La taille totale des stems ne doit pas dépasser 500 MB')
      return
    }
    setStemFiles(prev => [...prev, ...files])
    setError('')
  }

  const removeStem = (index: number) => {
    setStemFiles(prev => prev.filter((_, i) => i !== index))
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

      const wavFileName = wavFile ? `${timestamp}-${slug}.wav` : null

      // Préparer les stems pour signed URLs
      const stemsForSigning = stemFiles.map(f => ({ name: f.name, contentType: 'audio/wav' }))

      // 1. Obtenir les signed URLs depuis l'API
      setUploadProgress("Préparation de l'upload...")
      const signedRes = await fetch('/api/beats/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioFileName,
          audioContentType: audioFile.type || 'audio/mpeg',
          coverFileName,
          coverContentType: coverFile?.type || null,
          wavFileName,
          wavContentType: wavFile ? 'audio/wav' : null,
          stems: stemsForSigning.length > 0 ? stemsForSigning : null,
        }),
      })

      const signedData = await signedRes.json()
      if (!signedRes.ok) {
        setError(signedData.error || 'Erreur préparation upload')
        setUploading(false)
        return
      }

      // 2. Upload audio MP3
      setUploadProgress('Upload du MP3...')
      const audioUploadRes = await fetch(signedData.audio.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': audioFile.type || 'audio/mpeg' },
        body: audioFile,
      })

      if (!audioUploadRes.ok) {
        setError("Erreur lors de l'upload du fichier MP3")
        setUploading(false)
        return
      }

      const audioUrl = signedData.audio.publicUrl

      // 3. Upload WAV si fourni
      let wavUrl: string | null = null
      if (wavFile && signedData.wav) {
        setUploadProgress('Upload du WAV...')
        const wavUploadRes = await fetch(signedData.wav.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'audio/wav' },
          body: wavFile,
        })
        if (wavUploadRes.ok) {
          wavUrl = signedData.wav.publicUrl
        }
      }

      // 4. Upload stems individuels
      let uploadedStems: Array<{name: string; url: string; size: number}> = []
      if (stemFiles.length > 0 && signedData.stems) {
        for (let i = 0; i < stemFiles.length; i++) {
          const stemFile = stemFiles[i]
          const stemData = signedData.stems[i]
          if (!stemData) continue
          setUploadProgress(`Upload stem ${i + 1}/${stemFiles.length} (${stemFile.name})...`)
          const stemUploadRes = await fetch(stemData.signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'audio/wav' },
            body: stemFile,
          })
          if (stemUploadRes.ok) {
            uploadedStems.push({
              name: stemFile.name,
              url: stemData.publicUrl,
              size: stemFile.size,
            })
          }
        }
      }

      // 5. Upload cover si fournie
      let coverUrl: string | null = null
      if (aiCoverUrl) {
        coverUrl = aiCoverUrl
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

      // 6. Envoyer les métadonnées à l'API
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
          wavUrl,
          stemsFiles: uploadedStems.length > 0 ? uploadedStems : null,
          priceMp3: priceMp3 || null,
          priceWav: priceWav || null,
          priceStems: priceStems || null,
          audioFileName: audioFile.name,
          audioSize: audioFile.size,
          // Auction data
          enableAuction,
          startPrice: enableAuction ? parseFloat(startPrice) : null,
          premiumPrice: enableAuction && premiumPrice ? parseFloat(premiumPrice) : null,
          exclusivePrice: enableAuction && exclusivePrice ? parseFloat(exclusivePrice) : null,
          buyNowPrice: enableAuction && buyNowPrice ? parseFloat(buyNowPrice) : null,
          auctionDuration: enableAuction ? parseInt(auctionDuration) : null,
          licenseType: enableAuction ? licenseType : null,
          bidIncrement: enableAuction ? parseFloat(bidIncrement) : null,
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
          <h2 className="text-2xl font-bold text-white mb-2">Beat uploadé !</h2>
          <p className="text-gray-400">Redirection vers le dashboard...</p>
        </div>
      </div>
    )
  }

  // Écran hero si aucun fichier audio sélectionné
  if (!audioFile) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
          <div
            onClick={() => audioInputRef.current?.click()}
            onDrop={handleAudioDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`flex flex-col items-center justify-center cursor-pointer transition-all group ${
              dragOver ? 'scale-105' : ''
            }`}
          >
            <div
              className={`w-40 h-40 rounded-full flex items-center justify-center mb-6 transition-all group-hover:scale-110 group-hover:shadow-[0_0_60px_rgba(225,29,72,0.4)] ${
                dragOver
                  ? 'bg-[#e11d48] shadow-[0_0_80px_rgba(225,29,72,0.6)]'
                  : 'bg-[#e11d48]/90 shadow-[0_0_40px_rgba(225,29,72,0.3)]'
              }`}
            >
              <Upload size={48} className="text-white" />
            </div>
            <h1 className="text-4xl font-black text-[#e11d48] tracking-tight mb-2">UPLOAD</h1>
            <p className="text-gray-400 text-center text-sm">
              {dragOver ? 'Lâche ton fichier ici' : 'Clique ou glisse ton beat ici'}
            </p>
            <p className="text-gray-600 text-xs mt-1">MP3, WAV, FLAC · Max 50 MB</p>
          </div>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/mp3,audio/x-wav,audio/wave,audio/mp4,audio/aac,audio/ogg,audio/flac,.mp3,.wav,.m4a,.aac,.ogg,.flac"
            onChange={handleAudioSelect}
            className="hidden"
          />
          {error && (
            <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm max-w-sm text-center">
              {error}
            </div>
          )}
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
          <p className="text-gray-400">Partage ton instrumentale et mets-la aux enchères</p>
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

          {/* WAV Upload */}
          <div>
            <label className="text-sm font-semibold text-white mb-2 block">
              Fichier WAV <span className="text-gray-500 text-xs font-normal">(haute qualité — accessible à l&apos;achat)</span>
            </label>
            {!wavFile ? (
              <div
                onClick={() => wavInputRef.current?.click()}
                className="border-2 border-dashed border-[#1e1e2e] rounded-2xl p-6 text-center cursor-pointer hover:border-blue-500/40 transition group"
              >
                <div className="flex items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition">
                    <FileAudio size={20} className="text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white text-sm font-semibold">Ajouter le fichier WAV</p>
                    <p className="text-gray-500 text-xs">Format WAV uniquement, max 200 MB</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#13131a] border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <FileAudio size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium truncate max-w-[250px]">{wavFile.name}</p>
                    <p className="text-xs text-gray-500">{(wavFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setWavFile(null); if (wavInputRef.current) wavInputRef.current.value = '' }}
                  className="text-gray-500 hover:text-red-400 transition"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <input
              ref={wavInputRef}
              type="file"
              accept=".wav,audio/wav,audio/x-wav"
              onChange={handleWavSelect}
              className="hidden"
            />
          </div>

          {/* Stems Upload */}
          <div>
            <label className="text-sm font-semibold text-white mb-2 block">
              Stems <span className="text-gray-500 text-xs font-normal">(pistes séparées — accessibles à l&apos;achat Stems)</span>
            </label>
            <div className="space-y-2">
              {stemFiles.length > 0 && (
                <div className="bg-[#13131a] border border-purple-500/30 rounded-2xl p-4 space-y-2">
                  {stemFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02]">
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-purple-400" />
                        <span className="text-sm text-white truncate max-w-[200px]">{file.name}</span>
                        <span className="text-xs text-gray-500">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStem(index)}
                        className="text-gray-500 hover:text-red-400 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <p className="text-xs text-gray-500 pt-1">
                    {stemFiles.length} stem{stemFiles.length > 1 ? 's' : ''} — {(stemFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB total
                  </p>
                </div>
              )}
              <div
                onClick={() => stemsInputRef.current?.click()}
                className="border-2 border-dashed border-[#1e1e2e] rounded-2xl p-5 text-center cursor-pointer hover:border-purple-500/40 transition group"
              >
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition">
                    <Plus size={18} className="text-purple-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-purple-300 text-sm font-semibold">
                      {stemFiles.length > 0 ? 'Ajouter d\'autres stems' : 'Ajouter les stems'}
                    </p>
                    <p className="text-gray-500 text-xs">Kick, Snare, Hi-Hat, Melody, Bass... (WAV uniquement)</p>
                  </div>
                </div>
              </div>
            </div>
            <input
              ref={stemsInputRef}
              type="file"
              accept=".wav,audio/wav,audio/x-wav"
              multiple
              onChange={handleStemsSelect}
              className="hidden"
            />
          </div>

          {/* Prix par licence */}
          <div className="border border-[#1e1e2e] rounded-2xl p-5 bg-[#0d0d14]">
            <label className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign size={16} className="text-green-400" />
              Prix des licences (achat direct)
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/5">
                <p className="text-sm font-bold text-blue-400">MP3</p>
                <p className="text-[11px] text-blue-400/70 mb-2">Fichier MP3 uniquement</p>
                <div className="relative">
                  <input
                    type="number"
                    value={priceMp3}
                    onChange={(e) => setPriceMp3(e.target.value)}
                    placeholder="19"
                    min="1"
                    className="w-full bg-[#0a0a12] border border-blue-500/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500/50 transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">€</span>
                </div>
              </div>
              <div className={`p-3 rounded-xl border ${wavFile ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gray-700/30 bg-gray-800/5 opacity-50'}`}>
                <p className="text-sm font-bold text-emerald-400">WAV</p>
                <p className="text-[11px] text-emerald-400/70 mb-2">Fichier WAV HD</p>
                <div className="relative">
                  <input
                    type="number"
                    value={priceWav}
                    onChange={(e) => setPriceWav(e.target.value)}
                    placeholder="39"
                    min="1"
                    disabled={!wavFile}
                    className="w-full bg-[#0a0a12] border border-emerald-500/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500/50 transition disabled:opacity-50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">€</span>
                </div>
              </div>
              <div className={`p-3 rounded-xl border ${stemFiles.length > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-gray-700/30 bg-gray-800/5 opacity-50'}`}>
                <p className="text-sm font-bold text-amber-400">Stems</p>
                <p className="text-[11px] text-amber-400/70 mb-2">WAV + MP3 + Stems</p>
                <div className="relative">
                  <input
                    type="number"
                    value={priceStems}
                    onChange={(e) => setPriceStems(e.target.value)}
                    placeholder="99"
                    min="1"
                    disabled={stemFiles.length === 0}
                    className="w-full bg-[#0a0a12] border border-amber-500/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-amber-500/50 transition disabled:opacity-50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">€</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Les fichiers WAV et Stems ne seront accessibles qu&apos;après achat de la licence correspondante.
            </p>
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

          {/* ─── MISE AUX ENCHÈRES ─── */}
          <div className="border border-[#1e1e2e] rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setEnableAuction(!enableAuction)}
              className="w-full flex items-center justify-between px-5 py-4 bg-[#13131a] hover:bg-[#1a1a25] transition"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${enableAuction ? 'bg-[#e11d4820]' : 'bg-white/5'}`}
                >
                  <Gavel size={20} className={enableAuction ? 'text-[#e11d48]' : 'text-gray-500'} />
                </div>
                <div className="text-left">
                  <p className="text-white font-semibold text-sm">Mettre aux enchères</p>
                  <p className="text-gray-500 text-xs">
                    Configure les paramètres de l&apos;enchère
                  </p>
                </div>
              </div>
              <div
                className={`w-11 h-6 rounded-full relative transition-colors ${enableAuction ? 'bg-[#e11d48]' : 'bg-[#2a2a3a]'}`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enableAuction ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
                />
              </div>
            </button>

            {enableAuction && (
              <div className="px-5 py-5 space-y-5 border-t border-[#1e1e2e] bg-[#0d0d14]">
                {/* Increment + Achat immédiat + Duree */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                      <DollarSign size={14} className="text-green-400" />
                      Increment (EUR)
                    </label>
                    <input
                      type="number"
                      value={bidIncrement}
                      onChange={(e) => setBidIncrement(e.target.value)}
                      placeholder="5"
                      min="1"
                      step="1"
                      className="w-full bg-[#13131a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4840] transition"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                      <Tag size={14} className="text-amber-400" />
                      Achat immédiat
                      <span className="text-gray-500 text-xs font-normal ml-1">optionnel</span>
                    </label>
                    <input
                      type="number"
                      value={buyNowPrice}
                      onChange={(e) => setBuyNowPrice(e.target.value)}
                      placeholder="Ex: 500"
                      min="1"
                      step="1"
                      className="w-full bg-[#13131a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4840] transition"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                      <Clock size={14} className="text-blue-400" />
                      Durée de l&apos;enchère
                    </label>
                    <select
                      value={auctionDuration}
                      onChange={(e) => setAuctionDuration(e.target.value)}
                      className="w-full bg-[#13131a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e11d4840] transition"
                    >
                      <option value="6">6 heures</option>
                      <option value="12">12 heures</option>
                      <option value="24">24 heures</option>
                      <option value="48">48 heures</option>
                      <option value="72">3 jours</option>
                      <option value="168">7 jours</option>
                    </select>
                  </div>
                </div>

                {/* Prix par licence */}
                <div>
                  <label className="text-sm font-semibold text-white mb-3 block">
                    Prix par type de licence (EUR)
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Basic */}
                    <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/5">
                      <p className="text-sm font-bold text-blue-400">Basic</p>
                      <p className="text-[11px] text-blue-400/70 mb-2">Usage non-commercial</p>
                      <input
                        type="number"
                        value={startPrice}
                        onChange={(e) => setStartPrice(e.target.value)}
                        placeholder="10"
                        min="1"
                        className="w-full bg-[#0a0a12] border border-blue-500/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500/50 transition"
                      />
                    </div>
                    {/* Premium */}
                    <div className="p-3 rounded-xl border border-purple-500/30 bg-purple-500/5">
                      <p className="text-sm font-bold text-purple-400">Premium</p>
                      <p className="text-[11px] text-purple-400/70 mb-2">Usage commercial</p>
                      <input
                        type="number"
                        value={premiumPrice}
                        onChange={(e) => setPremiumPrice(e.target.value)}
                        placeholder="25"
                        min="1"
                        className="w-full bg-[#0a0a12] border border-purple-500/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500/50 transition"
                      />
                    </div>
                    {/* Exclusive */}
                    <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
                      <p className="text-sm font-bold text-amber-400">Exclusive</p>
                      <p className="text-[11px] text-amber-400/70 mb-2">Droits exclusifs</p>
                      <input
                        type="number"
                        value={exclusivePrice}
                        onChange={(e) => setExclusivePrice(e.target.value)}
                        placeholder="100"
                        min="1"
                        className="w-full bg-[#0a0a12] border border-amber-500/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-amber-500/50 transition"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
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
            disabled={
              uploading || !audioFile || !title || !genre || !bpm || (enableAuction && !startPrice)
            }
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
                {enableAuction ? <Gavel size={20} /> : <Upload size={20} />}
                {enableAuction ? "Publier et lancer l'enchère" : 'Publier le beat'}
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  )
}
