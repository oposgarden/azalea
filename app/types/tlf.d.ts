interface Fund {
  address: anchor.web3.PublicKey
  currentAmount: anchor.web3.TokenAmount
  amount: BN
  redeemTimestamp: BN
  mint: anchor.web3.PublicKey
  tokenVault: anchor.web3.PublicKey
  redeemer: anchor.web3.PublicKey
}
