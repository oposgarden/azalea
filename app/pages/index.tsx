import { useEffect, useState } from 'react'
import type { NextPage } from 'next'
import Head from 'next/head'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { Formik } from 'formik'
import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN, web3 } from '@project-serum/anchor'
import { TokenListProvider, TokenInfo, ENV } from '@solana/spl-token-registry'
import { PublicKey } from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMint,
  AccountLayout,
} from '@solana/spl-token'
import idl from '../time_locked_fund.json'
import {
  Badge,
  Button,
  Text,
  Input,
  Select,
  Spacer,
  Grid,
  Page,
  Modal,
  Loading,
  useMediaQuery,
} from '@geist-ui/core'
import FundCard from '../components/FundCard'

const opts = {
  preflightCommitment: 'processed',
}
const programID = new PublicKey('ChwWD7uj781ybLCd2fNQXqgewPBWdNzNLm3VtpnjUPqt')

const Home: NextPage = () => {
  const { connection } = useConnection()
  const isXS = useMediaQuery('xs')

  const [loading, setLoading] = useState(false)

  const wallet = useWallet()
  const [funds, setFunds] = useState<any[]>([])
  const [mintAccounts, setMintAccounts] = useState<any[]>([])

  const [openFunds, setOpenFunds] = useState<any[]>([])
  const [lockedFunds, setLockedFunds] = useState<any[]>([])
  const [redeemedFunds, setRedeemedFunds] = useState<any[]>([])

  const [createFundModalOpen, setCreateFundModalOpen] = useState(false)
  const closeCreateFundModalHandler = () => {
    setCreateFundModalOpen(false)
  }

  const [redeemFundModalOpen, setRedeemFundModalOpen] = useState(false)
  const closeRedeemFundModalHandler = () => {
    setRedeemFundModalOpen(false)
  }
  const [tokenMap, setTokenMap] = useState<Map<string, TokenInfo>>(new Map())

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

  const getMintAccounts = async () => {
    // @ts-ignore
    const provider = new Provider(connection, wallet, opts.preflightCommitment)

    const tokenAccounts = await connection.getTokenAccountsByOwner(provider.wallet.publicKey, {
      programId: TOKEN_PROGRAM_ID,
    })

    const accountsData: any[] = []
    tokenAccounts.value.forEach(async tokenAccount => {
      const accountData = AccountLayout.decode(tokenAccount.account.data)
      const token = tokenMap.get(accountData.mint.toString())
      const extendedAccountData = { ...accountData, name: token?.name, symbol: token?.symbol }
      accountsData.push(extendedAccountData)
    })

    setMintAccounts(accountsData)
  }

  const getVaults = async () => {
    setLoading(true)
    // @ts-ignore
    const provider = new Provider(connection, wallet, opts.preflightCommitment)

    // @ts-ignore
    const program = new Program(idl, programID, provider)

    let index = 1
    let funds = []
    let openFunds = []
    let lockedFunds = []
    let redeemedFunds = []
    while (true) {
      const [fund, _fund_bump] = await web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('fund')),
          Buffer.from(provider.wallet.publicKey.toBytes()),
          Buffer.from(anchor.utils.bytes.utf8.encode(index.toString())),
        ],
        program.programId,
      )

      try {
        const account = await program.account.fund.fetch(fund)
        account.address = fund

        const finalVaultBalance = await provider.connection.getTokenAccountBalance(
          account.tokenVault,
        )
        account.currentAmount = finalVaultBalance.value

        if (account) {
          funds.push(account)

          if (account.currentAmount.uiAmount == 0) {
            redeemedFunds.push(account)
          } else if (new Date(account.redeemTimestamp * 1000) < new Date()) {
            openFunds.push(account)
          } else {
            lockedFunds.push(account)
          }
          index++
        } else {
          break
        }
      } catch (error) {
        console.log(error)
        break
      }
    }

    setFunds(funds)
    setOpenFunds(openFunds)
    setLockedFunds(lockedFunds)
    setRedeemedFunds(redeemedFunds)
    setLoading(false)

    return provider
  }

  useEffect(() => {
    getVaults()
    getMintAccounts()
  }, [tokenMap])

  const createVault = async ({
    amount,
    token,
    redeemer,
    redeemTimestamp,
  }: {
    amount: BN
    token: PublicKey
    redeemer: PublicKey
    redeemTimestamp: number
  }) => {
    if (wallet) {
      const index = funds.length + 1
      const indexString = index.toString()

      // @ts-ignore
      const provider = new Provider(connection, wallet, opts)

      // @ts-ignore
      const program = new Program(idl, programID, provider)

      const payerTokenAccount = await getAssociatedTokenAddress(token, provider.wallet.publicKey)

      const [fund, _fund_bump] = await web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode('fund')),
          Buffer.from(provider.wallet.publicKey.toBytes()),
          Buffer.from(anchor.utils.bytes.utf8.encode(indexString)),
        ],
        program.programId,
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

      const mint = await getMint(connection, token)

      await program.rpc.createFund(
        indexString,
        // Amount to deposit to the fund
        amount.mul(new BN(10).pow(new BN(mint.decimals))),

        // *** Timestamp options: ***
        // One minute ago
        new BN(redeemTimestamp),

        {
          accounts: {
            mint: token, // new PublicKey('HMmntdis4Q9CvzPN2peV6wYkDj1WQNKWzZoXSgt2mryZ'),
            fund: fund,
            tokenVault: token_vault_pda,
            tokenVaultAuthority: token_vault_authority_pda,
            payerTokenAccount: payerTokenAccount,
            redeemer: redeemer,
            payer: provider.wallet.publicKey,

            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
        },
      )

      await getVaults()
    }
  }

  const redeem = async ({ fund }: { fund: PublicKey }) => {
    if (wallet) {
      // @ts-ignore
      const provider = new Provider(connection, wallet, opts)

      // @ts-ignore
      const program = new Program(idl, programID, provider)

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

      await program.rpc.redeem({
        accounts: {
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
        },
      })
    }
  }

  return (
    <>
      <div
        style={{
          backgroundColor: '#000',
          color: '#fff',
          padding: `${isXS ? '40px calc(1.34 * 16px)' : '40px calc(50pt + 1.34 * 16px)'}`, // TODO: Refactor with geist UI
          fontSize: '14px',
        }}
      >
        <h4>Welcome to the beta version (devnet only) of Azalea 💮</h4>
        <div>
          Azalea allows anyone to create funds of any token (including NFT&apos;s) locked during a
          set period of time. To start click the create fund button below to define a fund that can
          only be redeemed after a certain date by a specific wallet. If you were given a{' '}
          <b>fund address</b>, click on redeem to get your funds once the redeem time has passed.
          Here are some suggestions on what to use Azalea for: savings for college fund, birthday
          gift, distribution of tokens, locked NFT, etc.
        </div>
      </div>

      <Page width={isXS ? '100%' : undefined}>
        <div style={{ textAlign: 'right' }}>
          <Button auto onClick={() => setCreateFundModalOpen(true)} marginRight="20px">
            Create fund
          </Button>
          <Modal visible={createFundModalOpen} onClose={closeCreateFundModalHandler}>
            <Modal.Title>New Fund</Modal.Title>

            <Formik
              initialValues={{ amount: '', token: '', redeemer: '', redeemTimestamp: '' }}
              onSubmit={async (values, { setSubmitting }) => {
                const timestamp = new Date(values.redeemTimestamp).getTime()
                const timestampInSeconds = Math.floor(timestamp / 1000)

                await createVault({
                  amount: new BN(values.amount),
                  token: new PublicKey(values.token),
                  redeemer: new PublicKey(values.redeemer),
                  redeemTimestamp: timestampInSeconds,
                })
                closeCreateFundModalHandler()
                setSubmitting(false)
              }}
            >
              {({
                values,
                handleChange,
                handleBlur,
                handleSubmit,
                isSubmitting,
                setFieldValue,
              }) => (
                <>
                  <form onSubmit={handleSubmit} style={{ textAlign: 'center' }}>
                    <Modal.Content>
                      <Select
                        placeholder="Choose token"
                        onChange={e => setFieldValue('token', e)}
                        value={values.token}
                        width="100%"
                      >
                        {mintAccounts.map(mintAccount => {
                          return (
                            <Select.Option
                              value={mintAccount.mint.toString()}
                              key={mintAccount.mint.toString()}
                            >
                              {mintAccount.name || mintAccount.mint.toString()}
                            </Select.Option>
                          )
                        })}
                      </Select>
                      <Spacer h={0.5} />
                      <Input
                        placeholder="Value to lock"
                        htmlType="text"
                        name="amount"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        value={values.amount}
                        width="100%"
                      />
                      <Spacer h={0.5} />
                      <Input
                        placeholder="Redeemer address"
                        htmlType="text"
                        name="redeemer"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        value={values.redeemer}
                        width="100%"
                      />
                      <Spacer h={0.5} />

                      <Input
                        placeholder="Redeem time"
                        htmlType="datetime-local"
                        name="redeemTimestamp"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        value={values.redeemTimestamp}
                        width="100%"
                      />
                    </Modal.Content>
                    <Spacer h={0.5} />
                    <Modal.Action
                      htmlType="submit"
                      disabled={isSubmitting}
                      style={{ width: '100%' }}
                    >
                      Create fund
                    </Modal.Action>
                  </form>
                </>
              )}
            </Formik>
          </Modal>

          <Button auto onClick={() => setRedeemFundModalOpen(true)} marginRight="20px">
            Redeem fund
          </Button>
          <Modal visible={redeemFundModalOpen} onClose={closeRedeemFundModalHandler}>
            <Modal.Title>Redeem fund</Modal.Title>

            <Formik
              initialValues={{ fund: '' }}
              onSubmit={async (values, { setSubmitting }) => {
                await redeem({
                  fund: new PublicKey(values.fund),
                })
                setSubmitting(false)
              }}
            >
              {({
                values,
                handleChange,
                handleBlur,
                handleSubmit,
                isSubmitting,
                setFieldValue,
              }) => (
                <>
                  <form onSubmit={handleSubmit} style={{ textAlign: 'center' }}>
                    <Modal.Content>
                      <Input
                        placeholder="Fund address"
                        htmlType="text"
                        name="fund"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        value={values.fund}
                        width="100%"
                      />
                    </Modal.Content>
                    <Spacer h={0.5} />
                    <Modal.Action
                      htmlType="submit"
                      disabled={isSubmitting}
                      style={{ width: '100%' }}
                    >
                      Redeem
                    </Modal.Action>
                  </form>
                </>
              )}
            </Formik>
          </Modal>
          <Badge style={{ padding: '8px 16px' }} type="success">
            {wallet.publicKey?.toString().substring(0, 6) +
              '...' +
              wallet.publicKey
                ?.toString()
                .substring(
                  wallet.publicKey?.toString().length - 6,
                  wallet.publicKey?.toString().length,
                )}
          </Badge>
        </div>
        <Spacer h={2} />

        <Text h1>Funds</Text>
        {loading && <Loading />}

        {openFunds.length > 0 && (
          <>
            <Text h3>Open</Text>
            <Grid.Container gap={1.5}>
              {openFunds.map(fund => {
                return (
                  <Grid
                    lg={6}
                    md={12}
                    sm={12}
                    xs={24}
                    justify="center"
                    key={fund.address.toString()}
                  >
                    <FundCard fund={fund} />
                  </Grid>
                )
              })}
            </Grid.Container>
          </>
        )}

        {lockedFunds.length > 0 && (
          <>
            <Text h3>Locked</Text>
            <Grid.Container gap={1.5}>
              {lockedFunds.map(fund => {
                return (
                  <Grid
                    lg={6}
                    md={12}
                    sm={12}
                    xs={24}
                    justify="center"
                    key={fund.address.toString()}
                  >
                    <FundCard fund={fund} />
                  </Grid>
                )
              })}
            </Grid.Container>
          </>
        )}

        {redeemedFunds.length > 0 && (
          <>
            <Text h3>Redeemed</Text>
            <Grid.Container gap={1.5}>
              {redeemedFunds.map(fund => {
                return (
                  <Grid
                    lg={6}
                    md={12}
                    sm={12}
                    xs={24}
                    justify="center"
                    key={fund.address.toString()}
                  >
                    <FundCard fund={fund} />
                  </Grid>
                )
              })}
            </Grid.Container>
          </>
        )}
      </Page>
    </>
  )
}

export default Home
