import { NextResponse } from 'next/server'

export async function POST(req: Request) {

  try {

    const body = await req.json()

    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-7-sonnet-20250219',
          max_tokens: 4000,
          system: body.systemPrompt,
          messages: [
            {
              role: 'user',
              content: body.content
            }
          ]
        })
      }
    )

    const data = await response.json()

    const text = data.content?.[0]?.text || '{}'

    return NextResponse.json(JSON.parse(text))

  } catch (err: any) {

    return NextResponse.json(
      {
        error: err.message
      },
      {
        status: 500
      }
    )
  }
}
