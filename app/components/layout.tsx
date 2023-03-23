import { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useWallet } from '@solana/wallet-adapter-react'
require('@solana/wallet-adapter-react-ui/styles.css')

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false },
)

type Props = {
  children: ReactNode
}

const Layout = ({ children }: Props) => {
  const wallet = useWallet()

  if (!wallet.connected) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
        <WalletMultiButton />
      </div>
    )
  } else {
    return <main>{children}</main>
  }
}

export default Layout
