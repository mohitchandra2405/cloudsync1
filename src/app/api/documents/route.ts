import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const createDocSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
})

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('documents')
    .select('id, title, owner_id, content_text, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, error: null })
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = createDocSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: 'Invalid request body' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({
      owner_id: user.id,
      title: parsed.data.title ?? 'Untitled Document',
    })
    .select('id, title, owner_id, content_text, created_at, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, error: null }, { status: 201 })
}
