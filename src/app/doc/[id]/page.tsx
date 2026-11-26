import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import CollaborativeEditor from './_components/CollaborativeEditor'

interface DocPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('documents')
    .select('title')
    .eq('id', id)
    .single()

  return {
    title: `${data?.title ?? 'Document'} — CloudSync`,
  }
}

export default async function DocumentPage({ params }: DocPageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, title, owner_id')
    .eq('id', id)
    .single()

  if (error || !doc) {
    redirect('/dashboard')
  }

  let readOnly = false
  if (doc.owner_id !== user.id) {
    const { data: collab } = await supabase
      .from('document_collaborators')
      .select('role')
      .eq('document_id', id)
      .eq('user_id', user.id)
      .single()

    if (collab?.role === 'viewer') {
      readOnly = true
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const displayName =
    profile?.full_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Anonymous'

  return (
    <CollaborativeEditor
      documentId={doc.id}
      initialTitle={doc.title}
      readOnly={readOnly}
      user={{
        id: user.id,
        name: displayName,
      }}
    />
  )
}
