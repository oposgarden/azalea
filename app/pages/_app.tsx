import type { AppProps } from 'next/app'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { GeistProvider, CssBaseline } from '@geist-ui/core'

require('@solana/wallet-adapter-react-ui/styles.css')

import Layout from '../components/layout'

const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()]

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ConnectionProvider endpoint={process.env.NEXT_PUBLIC_PROVIDER_URL || 'http://127.0.0.1:8899'}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Layout>
            <GeistProvider>
              <CssBaseline />
              <Component {...pageProps} />
            </GeistProvider>
          </Layout>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
export default MyApp
