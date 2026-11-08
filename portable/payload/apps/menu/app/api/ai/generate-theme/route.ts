import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are a restaurant branding and design expert. When given a description of a restaurant's vibe or style, you generate a theme configuration for their digital menu.

Return ONLY valid JSON with this exact shape — no markdown, no explanation, just the raw JSON object:
{
  "primaryColor": "#hex",
  "accentColor": "#hex",
  "bgColor": "#hex",
  "textColor": "#hex",
  "cardBg": "#hex",
  "headerBg": "#hex",
  "headerText": "#hex",
  "font": "serif|sans|display",
  "layout": "list|grid|magazine",
  "cardStyle": "shadow|border|flat",
  "heroStyle": "full-bleed|compact|none",
  "vibe": "short description of the vibe"
}

Rules:
- All hex colors must be valid 6-digit hex codes starting with #
- font must be exactly one of: serif, sans, display
- layout must be exactly one of: list, grid, magazine
- cardStyle must be exactly one of: shadow, border, flat
- heroStyle must be exactly one of: full-bleed, compact, none
- vibe should be 1-2 sentences describing the restaurant's visual identity
- Choose colors that work well together and match the described vibe
- For fine dining: rich colors, serif fonts, magazine layout
- For casual/fast: bright colors, sans fonts, grid layout
- For coffee shops/bakeries: warm earth tones, display font, list layout
- For seafood/beach: ocean blues/greens, sans font, full-bleed hero
`

export async function POST(req: NextRequest) {
  try {
    const { prompt, menuData } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      )
    }

    let userMessage = `Generate a menu theme for this restaurant vibe: ${prompt}`

    if (menuData) {
      if (menuData.restaurant_name) {
        userMessage += `\n\nRestaurant name: ${menuData.restaurant_name}`
      }
      if (menuData.description) {
        userMessage += `\nDescription: ${menuData.description}`
      }
      if (menuData.items && menuData.items.length > 0) {
        const categories = [...new Set(menuData.items.map((i: any) => i.category).filter(Boolean))]
        if (categories.length > 0) {
          userMessage += `\nMenu categories: ${categories.join(', ')}`
        }
      }
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userMessage },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'No text response from AI' },
        { status: 500 }
      )
    }

    // Strip markdown code fences if present
    let raw = textBlock.text.trim()
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    let themeConfig: any
    try {
      themeConfig = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        { error: 'AI returned invalid JSON', raw },
        { status: 500 }
      )
    }

    // Validate required fields
    const required = [
      'primaryColor', 'accentColor', 'bgColor', 'textColor',
      'cardBg', 'headerBg', 'headerText', 'font', 'layout',
      'cardStyle', 'heroStyle', 'vibe',
    ]
    for (const field of required) {
      if (!(field in themeConfig)) {
        themeConfig[field] = getDefault(field)
      }
    }

    return NextResponse.json(themeConfig)
  } catch (err: any) {
    console.error('Error generating theme:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to generate theme' },
      { status: 500 }
    )
  }
}

function getDefault(field: string): string {
  const defaults: Record<string, string> = {
    primaryColor: '#2563eb',
    accentColor: '#f59e0b',
    bgColor: '#f8fafc',
    textColor: '#0f172a',
    cardBg: '#ffffff',
    headerBg: '#2563eb',
    headerText: '#ffffff',
    font: 'sans',
    layout: 'list',
    cardStyle: 'shadow',
    heroStyle: 'compact',
    vibe: '',
  }
  return defaults[field] ?? ''
}
