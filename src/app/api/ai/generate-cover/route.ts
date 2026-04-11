import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Styles visuels prédéfinis pour les covers de beats
const STYLE_PROMPTS: Record<string, string> = {
  abstract:
    'abstract digital art, fluid shapes, vibrant gradients, modern aesthetic, geometric patterns',
  dark: 'dark moody atmosphere, shadows, cinematic lighting, noir style, dramatic contrast',
  neon: 'neon lights, cyberpunk aesthetic, glowing colors, night city vibes, electric atmosphere',
  minimal: 'minimalist design, clean lines, simple shapes, elegant composition, negative space',
  vintage: 'vintage retro style, film grain, warm tones, 90s hip-hop aesthetic, old school vibe',
  futuristic: 'futuristic sci-fi aesthetic, holographic, chrome, space theme, advanced technology',
  street: 'urban street art style, graffiti, concrete textures, raw city aesthetic, gritty',
  nature: 'nature elements, organic textures, earth tones, forest or ocean atmosphere, ethereal',
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Service de génération non configuré' }, { status: 503 })
    }

    const { prompt, style } = await request.json()

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return NextResponse.json(
        { error: 'Décris ta cover en quelques mots (min 3 caractères)' },
        { status: 400 }
      )
    }

    if (prompt.length > 500) {
      return NextResponse.json(
        { error: 'Description trop longue (max 500 caractères)' },
        { status: 400 }
      )
    }

    // Construire le prompt final
    const stylePrompt = style && STYLE_PROMPTS[style] ? STYLE_PROMPTS[style] : ''
    const fullPrompt = `Album cover art for a music beat: ${prompt.trim()}. ${stylePrompt}. Square format, high quality, professional music artwork, no text, no letters, no words, no watermark.`

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: fullPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    })

    const imageUrl = response.data[0]?.url

    if (!imageUrl) {
      return NextResponse.json({ error: 'Erreur lors de la génération' }, { status: 500 })
    }

    return NextResponse.json({ imageUrl })
  } catch (error: unknown) {
    console.error('AI cover generation error:', error)

    // Gérer les erreurs spécifiques d'OpenAI
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      (error as { status: number }).status === 400
    ) {
      return NextResponse.json(
        {
          error: 'Le contenu demandé ne peut pas être généré. Essaie une autre description.',
        },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Erreur serveur lors de la génération' }, { status: 500 })
  }
}
