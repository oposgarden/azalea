import assert from 'assert'
import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { TimeLockedFund } from '../target/types/time_locked_fund'
import BN from 'bn.js'
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
} from '@solana/spl-token'

// Configure the client to use the local cluster.
const provider = anchor.AnchorProvider.env()
anchor.setProvider(provider)
// Instantiate the program
const program = anchor.workspace.TimeLockedFund as Program<TimeLockedFund>

const airdrop = async (mintPayerAndAuthority, value) => {
  const latestBlockHash = await provider.connection.getLatestBlockhash()

  const authorityAirdrop = await provider.connection.requestAirdrop(
    mintPayerAndAuthority.publicKey,
    value,
  )
  await provider.connection.confirmTransaction(
    {
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: authorityAirdrop,
    },
    'confirmed',
  )
}

const createDummyToken = async mintPayerAndAuthority => {
  return await createMint(
    provider.connection,
    mintPayerAndAuthority,
    mintPayerAndAuthority.publicKey,
    mintPayerAndAuthority.publicKey,
    6,
  )
}

describe('Time locked fund', () => {
  it('creates and redeems fund successfully', async () => {
    // Authority
    const mintPayerAndAuthority = anchor.web3.Keypair.generate()

    // Airdrop SOL
    await airdrop(mintPayerAndAuthority, 10000000000)

    // Create dummy token
    const dummyTokenMint = await createDummyToken(mintPayerAndAuthority)

    // *** Account preparation ***
    const [fund, _fund_bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode('fund')),
        Buffer.from(provider.wallet.publicKey.toBytes()),
        Buffer.from(anchor.utils.bytes.utf8.encode('1')),
      ],
      program.programId,
    )

    const redeemer = anchor.web3.Keypair.generate()
    await airdrop(redeemer, 10000000000)

    const redeemerTokenAccount = await getAssociatedTokenAddress(dummyTokenMint, redeemer.publicKey)

    const [token_vault_pda, _token_vault_bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(fund.toBytes())],
      program.programId,
    )

    const [token_vault_authority_pda, _token_vault_authority_bump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(anchor.utils.bytes.utf8.encode('token-vault-authority'))],
        program.programId,
      )

    // Create associated token account for fund creator
    // It assumes that the fund creator is the wallet connected
    let payerTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      mintPayerAndAuthority,
      dummyTokenMint,
      provider.wallet.publicKey,
    )

    // Provide fund creator with tokens
    await mintTo(
      provider.connection,
      mintPayerAndAuthority,
      dummyTokenMint,
      payerTokenAccount,
      mintPayerAndAuthority.publicKey,
      new BN(4000).mul(new BN(1000000)).toNumber(),
      [mintPayerAndAuthority],
    )
    // ***************************

    // Create the fund vault
    await program.methods
      .createFund(
        '1',
        'Test vault',
        // Amount to deposit to the fund
        new BN(100).mul(new BN(1000000)),

        // *** Timestamp options: ***
        // One minute ago
        new BN(new Date().getTime() / 1000 - 60),
      )
      .accounts({
        fund: fund,
        mint: dummyTokenMint,
        tokenVault: token_vault_pda,
        tokenVaultAuthority: token_vault_authority_pda,
        payerTokenAccount: payerTokenAccount,
        redeemer: redeemer.publicKey,
        payer: provider.wallet.publicKey,

        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc()

    const payerTokenBalance = await provider.connection.getTokenAccountBalance(payerTokenAccount)
    assert.equal(payerTokenBalance.value.uiAmount, new BN(3900))

    const tokenVaultBalance = await provider.connection.getTokenAccountBalance(token_vault_pda)
    assert.equal(tokenVaultBalance.value.uiAmount, new BN(100))

    await program.methods
      .redeem()
      .accounts({
        mint: dummyTokenMint,
        fund: fund,
        tokenVault: token_vault_pda,
        tokenVaultAuthority: token_vault_authority_pda,
        redeemer: redeemer.publicKey,
        redeemerTokenAccount: redeemerTokenAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([redeemer])
      .rpc()

    const redeemerAccountBalance = await provider.connection.getTokenAccountBalance(
      redeemerTokenAccount,
    )
    assert.equal(redeemerAccountBalance.value.uiAmount, new BN(100))

    const finalVaultBalance = await provider.connection.getTokenAccountBalance(token_vault_pda)
    assert.equal(finalVaultBalance.value.uiAmount, new BN(0))
  })

  it('fails to redeem if fund redeem date is in the future', async () => {
    // Authority
    const mintPayerAndAuthority = anchor.web3.Keypair.generate()

    // Airdrop SOL to authority
    await airdrop(mintPayerAndAuthority, 10000000000)

    // Create dummy token
    const dummyTokenMint = await createDummyToken(mintPayerAndAuthority)

    // *** Account preparation ***
    const [fund, _fund_bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode('fund')),
        Buffer.from(provider.wallet.publicKey.toBytes()),
        Buffer.from(anchor.utils.bytes.utf8.encode('2')),
      ],
      program.programId,
    )

    const redeemer = anchor.web3.Keypair.generate()
    // Airdrop SOL to redeemer
    await airdrop(redeemer, 10000000000)

    const redeemerTokenAccount = await getAssociatedTokenAddress(dummyTokenMint, redeemer.publicKey)

    const [token_vault_pda, _token_vault_bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(fund.toBytes())],
      program.programId,
    )

    const [token_vault_authority_pda, _token_vault_authority_bump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(anchor.utils.bytes.utf8.encode('token-vault-authority'))],
        program.programId,
      )

    // Create associated token account for fund creator
    // It assumes that the fund creator is the wallet connected
    let payerTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      mintPayerAndAuthority,
      dummyTokenMint,
      provider.wallet.publicKey,
    )

    // Provide fund creator with tokens
    await mintTo(
      provider.connection,
      mintPayerAndAuthority,
      dummyTokenMint,
      payerTokenAccount,
      mintPayerAndAuthority.publicKey,
      new BN(4000).mul(new BN(1000000)).toNumber(),
      [mintPayerAndAuthority],
    )
    // ***************************

    // Create the fund vault
    await program.methods
      .createFund(
        '2',
        'Test vault',
        // Amount to deposit to the fund
        new BN(100).mul(new BN(1000000)),

        // *** Timestamp options: ***
        // In one day
        new BN(new Date().getTime() / 1000 + 60 * 60 * 24),
      )
      .accounts({
        fund: fund,
        mint: dummyTokenMint,
        tokenVault: token_vault_pda,
        tokenVaultAuthority: token_vault_authority_pda,
        payerTokenAccount: payerTokenAccount,
        redeemer: redeemer.publicKey,
        payer: provider.wallet.publicKey,

        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc()

    // Assert balance values after creating the fund
    const payerTokenBalance = await provider.connection.getTokenAccountBalance(payerTokenAccount)
    assert.equal(payerTokenBalance.value.uiAmount, new BN(3900))

    const vaultBalance = await provider.connection.getTokenAccountBalance(token_vault_pda)
    assert.equal(vaultBalance.value.uiAmount, new BN(100))

    // Assert that the redemption fails
    try {
      await program.methods
        .redeem()
        .accounts({
          mint: dummyTokenMint,
          fund: fund,
          tokenVault: token_vault_pda,
          tokenVaultAuthority: token_vault_authority_pda,
          redeemer: redeemer.publicKey,
          redeemerTokenAccount: redeemerTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([redeemer])
        .rpc()
    } catch (error) {
      assert.match(error.message, /Redeem time has not been reached/)
    }
  })
})
