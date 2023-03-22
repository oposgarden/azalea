import { ReactNode } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
require('@solana/wallet-adapter-react-ui/styles.css')

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
