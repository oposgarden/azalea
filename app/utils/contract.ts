import { Program, AnchorProvider } from '@coral-xyz/anchor'
import { WalletContextState } from '@solana/wallet-adapter-react'
import { PublicKey, type Connection } from '@solana/web3.js'
import idl from '../time_locked_fund.json'
import { TimeLockedFund } from '../types/time_locked_fund'

const programID = new PublicKey('EJReuMV3KRJVJBSQPhU1aTr5SZWUQfRXc14hiFY2gBoc')

const getProvider = ({
  wallet,
  connection,
}: {
  wallet: WalletContextState
  connection: Connection
}) => {
  if (wallet.publicKey && wallet.signAllTransactions && wallet.signTransaction) {
    const provider = new AnchorProvider(
      connection,
      {
        publicKey: wallet.publicKey,
        signAllTransactions: wallet.signAllTransactions,
        signTransaction: wallet.signTransaction,
      },
      {
        preflightCommitment: 'processed',
      },
    )

    return provider
  } else {
    return undefined
  }
}

const getProgram = ({
  wallet,
  connection,
}: {
  wallet: WalletContextState
  connection: Connection
}) => {
  const provider = getProvider({
    wallet,
    connection,
  })
  const program = new Program(idl as any, programID, provider) as Program<TimeLockedFund>

  return program
}

export { getProvider, getProgram }
