import { MainMarket } from '@/components/MainMarket'
import { MyActiveBets } from '@/components/MyActiveBets'
import { TaylorDossier } from '@/components/TaylorDossier'

export function HomePage() {
  return (
    <>
      <MainMarket />
      <MyActiveBets />
      <TaylorDossier />
    </>
  )
}
