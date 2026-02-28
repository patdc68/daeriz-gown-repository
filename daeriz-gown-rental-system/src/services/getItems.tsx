import { supabase } from './supabase'

export async function getItemsWithBranch() {
  const { data, error } = await supabase
    .from('DBLG_ITEMS')
    .select(`
      *,
      branch:DBLG_SHOP_BRANCH (
        name
      )
    `)

  if (error) throw error

  return data
}