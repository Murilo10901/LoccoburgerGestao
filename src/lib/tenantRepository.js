import { getCurrentUser } from './auth.js'
import { supabase } from './supabaseClient.js'

export async function getDataOwnerId() {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select('store_owner_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data?.store_owner_id) return user.id

  return data.store_owner_id
}
