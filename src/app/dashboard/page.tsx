import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import DashboardClient from './_components/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch documents owned by this user, latest first
  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, content_text, created_at, updated_at, owner_id')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, avatar_url')
    .eq('id', user.id)
    .single()

  return (
    <DashboardClient
      documents={documents ?? []}
      user={{ id: user.id, ...profile }}
    />
  )
}
