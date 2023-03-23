import { useEffect, useState } from 'react'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import copy from 'copy-to-clipboard'
import * as anchor from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { getProvider, getProgram } from '../../utils/contract'
import { TokenListProvider, TokenInfo, ENV } from '@solana/spl-token-registry'
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
  Badge,
  Button,
  Card,
  Text,
  Spacer,
  Grid,
  Page,
  Description,
  useToasts,
  useMediaQuery,
} from '@geist-ui/core'
import { Lock, Unlock, Check } from '@geist-ui/icons'

const opts = {
  preflightCommitment: 'processed',
}
const programID = new PublicKey('EJReuMV3KRJVJBSQPhU1aTr5SZWUQfRXc14hiFY2gBoc')

const Fund: NextPage = () => {
  const { connection } = useConnection()
  const router = useRouter()
  const { address } = router.query

  const isXS = useMediaQuery('xs')

  const wallet = useWallet()
  const { setToast } = useToasts()
  const [fund, setFund] = useState<any>()
  const [tokenMap, setTokenMap] = useState<Map<string, TokenInfo>>(new Map())

  const getVault = async () => {
    const provider = getProvider({ wallet, connection })
    const program = getProgram({ wallet, connection })

    if (provider) {
      const account = await program.account.fund.fetch(address as string)
      const finalVaultBalance = await provider.connection.getTokenAccountBalance(account.tokenVault)

      const fundFromAccount = {
        ...account,
        address,
        currentAmount: finalVaultBalance.value,
      }

      setFund(fundFromAccount)
    } else {
      setFund(undefined)
    }
  }

  useEffect(() => {
    getVault()
  }, [])

  useEffect(() => {
    new TokenListProvider().resolve().then(tokens => {
      const tokenList = tokens
        .filterByChainId(parseInt(process.env.NEXT_PUBLIC_CHAIN_ID as string) || ENV.Devnet)
        .getList()

      setTokenMap(
        tokenList.reduce((map, item) => {
          map.set(item.address, item)
          return map
        }, new Map()),
      )
    })
  }, [setTokenMap])

  const redeem = async ({ fund }: { fund: PublicKey }) => {
    const provider = getProvider({ wallet, connection })
    const program = getProgram({ wallet, connection })

    if (provider) {
      const fundAccount = await program.account.fund.fetch(fund)

      const redeemerTokenAccount = await getAssociatedTokenAddress(
        fundAccount.mint,
        provider.wallet.publicKey,
      )

      const [token_vault_pda, _token_vault_bump] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(fund.toBytes())],
        program.programId,
      )

      const [token_vault_authority_pda, _token_vault_authority_bump] =
        await anchor.web3.PublicKey.findProgramAddress(
          [Buffer.from(anchor.utils.bytes.utf8.encode('token-vault-authority'))],
          program.programId,
        )

      try {
        await program.methods
          .redeem()
          .accounts({
            mint: fundAccount.mint,
            fund: fund,
            tokenVault: token_vault_pda,
            tokenVaultAuthority: token_vault_authority_pda,
            redeemer: provider.wallet.publicKey,
            redeemerTokenAccount: redeemerTokenAccount,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .rpc()
      } catch (error) {
        console.log(error)
      }

      getVault()
    }
  }

  return (
    <Page width={isXS ? '100%' : undefined}>
      <Head>
        <title>Azalea</title>
        <meta name="description" content="Token locked funds by Shitolabs" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Badge style={{ padding: '8px 16px', position: 'absolute', right: '20px' }} type="success">
        {wallet.publicKey?.toString().substring(0, 6) +
          '...' +
          wallet.publicKey
            ?.toString()
            .substring(
              wallet.publicKey?.toString().length - 6,
              wallet.publicKey?.toString().length,
            )}
      </Badge>
      <Spacer h={2} />

      {fund && (
        <Grid.Container gap={1.5} justify="center">
          <Grid xs={6} key={fund.address.toString()}>
            <Card
              hoverable
              width="100%"
              marginBottom="20px"
              key={fund.address.toString()}
              style={{ position: 'relative' }}
            >
              <div style={{ position: 'absolute', right: '18px', top: '18px' }}>
                {fund.currentAmount.uiAmount == 0 ? (
                  <Check color="green" />
                ) : new Date(fund.redeemTimestamp * 1000) < new Date() ? (
                  <Unlock color="green" />
                ) : (
                  <Lock color="orange" />
                )}
              </div>
              <Text h4 my={0}>
                {new Date(fund.redeemTimestamp * 1000) < new Date()
                  ? 'Unlocked fund'
                  : 'Locked fund'}
              </Text>
              <Spacer h={1} />
              <Description
                title="Amount"
                content={`${fund.currentAmount.uiAmountString} (${
                  tokenMap.get(fund.mint.toString())?.symbol
                })`}
              />
              <Spacer h={1} />
              <Description
                title="Redeemer"
                content={
                  <div
                    style={{
                      cursor: 'pointer',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      maxWidth: '140px',
                    }}
                    onClick={() => {
                      copy(fund.address.toString())
                      setToast({ text: 'Redeemer address copied', delay: 2000 })
                    }}
                  >
                    {fund.redeemer.toString()}
                  </div>
                }
              />
              <Spacer h={1} />
              <Description
                title="Redeem time"
                content={new Date(fund.redeemTimestamp * 1000).toLocaleString()}
              />
              {fund.currentAmount.uiAmount != 0 && (
                <Card.Footer>
                  {fund.redeemer.toString() != wallet.publicKey && (
                    <div
                      style={{
                        cursor: 'pointer',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        maxWidth: '260px',
                      }}
                      onClick={() => {
                        copy(fund.address.toString())
                        setToast({ text: 'Fund address copied', delay: 2000 })
                      }}
                    >
                      Fund address: {fund.address.toString()}
                    </div>
                  )}
                  {fund.redeemer.toString() == wallet.publicKey && (
                    <Button
                      onClick={() =>
                        redeem({
                          fund: new PublicKey(fund.address),
                        })
                      }
                      width="100%"
                    >
                      Redeem
                    </Button>
                  )}
                </Card.Footer>
              )}
            </Card>
          </Grid>
        </Grid.Container>
      )}
    </Page>
  )
}

export default Fund
