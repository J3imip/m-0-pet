import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  findMetadataPda,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import {
  Ed25519Program,
  Keypair,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import bs58 from "bs58";
import assert from "node:assert";
import { Keccak } from "sha3";
import tweetnacl from "tweetnacl";
import { M0Pet } from "../target/types/m_0_pet";
import dotenv from "dotenv";

dotenv.config();

describe("mint", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.M0Pet as Program<M0Pet>;
  const payer = provider.wallet;

  const umi = createUmi(provider.connection.rpcEndpoint)
    .use(walletAdapterIdentity(payer))
    .use(mplTokenMetadata());

  const [mint] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    program.programId
  );

  it("initialize", async () => {
    const info = await provider.connection.getAccountInfo(mint);
    if (info) {
      return;
    }
    console.log("\tMint not found. Attempting to initialize.");

    let metadataAddress = findMetadataPda(umi, {
      mint: publicKey(mint),
    })[0];

    const tx = await program.methods
      .initToken({
        name: "Just a Test Token",
        symbol: "TEST",
        uri: "https://5vfxc4tr6xoy23qefqbj4qx2adzkzapneebanhcalf7myvn5gzja.arweave.net/7UtxcnH13Y1uBCwCnkL6APKsge0hAgacQFl-zFW9NlI",
        decimals: 9,
      })
      .accounts({
        metadata: metadataAddress,
        //@ts-ignore
        mint,
        payer: payer.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
      })
      .transaction();

    const txHash = await provider.sendAndConfirm(tx);

    console.log(`\thttps://explorer.solana.com/tx/${txHash}?cluster=custom-localhost`);
    const newInfo = await provider.connection.getAccountInfo(mint);
    assert(newInfo, "Mint should be initialized.");
  });

  it("mint tokens", async () => {
    // Here we'll assume the validator's secret key is stored in an environment variable. 
    // In real-world scenarios, client would receive only signatures from the validator.
    const validator = Keypair.fromSeed(bs58.decode(process.env.VALIDATOR_SECRET_KEY!));
    const destination = anchor.utils.token.associatedAddress({
      mint,
      owner: payer.publicKey,
    });

    const [registry] = PublicKey.findProgramAddressSync(
      [Buffer.from("validator_registry")],
      program.programId,
    );

    const registryData = await program.account.validatorRegistry.fetch(registry);
    const validatorIndex = registryData.validatorKeys.findIndex((key) => key.equals(validator.publicKey));

    let proof = {
      minter: payer.publicKey,
      collateralAmount: new BN(10_000_000),
      timestamp: new BN(Date.now() / 1000),
      signatureHash: new Uint8Array(32),
      validatorIndex,
    };

    const signature = generateProof(
      payer.publicKey,
      proof.collateralAmount,
      proof.timestamp,
      validator,
    );

    proof.signatureHash = new Keccak(256)
      .update(Buffer.from(signature))
      .digest();

    let message = Buffer.concat([
      proof.minter.toBuffer(),
      Buffer.from(proof.collateralAmount.toArray("le", 8)),
      Buffer.from(proof.timestamp.toArray("le", 8)),
    ]);

    const ed25519Instruction = Ed25519Program.createInstructionWithPublicKey({
      publicKey: validator.publicKey.toBuffer(),
      message,
      signature: signature,
    });

    const [mintLockPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_lock"), proof.signatureHash],
      program.programId,
    );

    const tx = await program.methods
      //@ts-ignore
      .mintTokens(proof, new BN(9_000_000))
      .accounts({
        //@ts-ignore
        mint,
        destination,
        registry,
        payer: payer.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        mintLock: mintLockPDA,
      })
      .preInstructions([ed25519Instruction])
      .transaction();

    const txHash = await provider.sendAndConfirm(tx);

    console.log(`\thttps://solana.fm/tx/${txHash}?cluster=custom-localhost`);

    const postBalance = (
      await provider.connection.getTokenAccountBalance(destination)
    ).value.uiAmount;
    console.log(`\tBalance: ${postBalance}`);
  });

  /**
   * Generates a cryptographic proof by signing a message composed of the minter's public key,
   * collateral amount, and timestamp using the validator's secret key (ed25519 signature).
   *
   * @param {PublicKey} minter - The public key of the minter.
   * @param {BN} collateralAmount - The amount of collateral in BN format.
   * @param {BN} timestamp - The timestamp in BN format. Used for replay protection.
   * @param {Keypair} validator - The keypair of the validator, containing the secret key used for signing.
   * @returns {Uint8Array} - The generated proof as a detached signature.
   */
  function generateProof(
    minter: PublicKey,
    collateralAmount: BN,
    timestamp: BN,
    validator: Keypair,
  ) {
    const message = Buffer.concat([
      minter.toBuffer(),
      Buffer.from(collateralAmount.toArray("le", 8)),
      Buffer.from(timestamp.toArray("le", 8)),
    ]);

    return tweetnacl.sign.detached(
      message,
      validator.secretKey,
    );
  }
});
