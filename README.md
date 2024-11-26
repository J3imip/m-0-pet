# m-0-pet

## Build Stages

### Prerequisites
- anchor-cli v0.30.1
- solana-cli v2.0.16

### Build
- Build the program
  - `anchor build`
- Sync the keys
  - `anchor keys sync`

### Testing
- Generate ed25519 keypair, encode the private key to base58 and save it to the `.env` file
- Setup a local validator with metaplex program
  - `solana-test-validator -r --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s metaplex_token_metadata_program.so`
- Run tests (it will deploy the program to the local validator and run the tests)
  - `anchor test --skip-local-validator`