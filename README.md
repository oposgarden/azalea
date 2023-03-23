# Azalea 🔏

Create time locked accounts to be redeemed at a specific point in time.

Usage examples:

- Gift to be unlock at a specific account
- Savings for college fund
- Anything else you can think of to lock tokens that can be retrieved by another account after X time

### Future improvements

- Allow adding more funds to the same account by any payer (ie. allow anyone to contribute to the fund)
- Multi vault funds
- Pay for redeem with funds from the vault

## Development

### Tests

To run the program tests simply run `anchor test`.

### To run development

1. `solana-test-validator --reset`
2. `anchor test --skip-local-validator` which will deploy the contract and run the tests
3. Run frontend (`yarn dev` on app folder) pointing to `localhost:8899` (.env definition)
