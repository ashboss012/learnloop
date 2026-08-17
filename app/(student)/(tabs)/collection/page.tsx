export const dynamic = 'force-dynamic'

import { getCollectionState } from '@/app/actions/characters'
import CollectionView from '@/components/CollectionView'

export default async function CollectionPage() {
  const state = await getCollectionState()

  if ('error' in state) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 page-enter">
        <p className="font-semibold" style={{ color: 'var(--wrong)' }}>{state.error}</p>
      </div>
    )
  }

  return <CollectionView initial={state} />
}
