import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { M0Pet } from "../target/types/m_0_pet";
import { Keypair, PublicKey } from "@solana/web3.js";
import assert from "node:assert";
import dotenv from "dotenv";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

dotenv.config();

describe("registry", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.M0Pet as Program<M0Pet>;

    const payer = provider.wallet;

    const validator = Keypair.fromSeed(bs58.decode(process.env.VALIDATOR_SECRET_KEY!)).publicKey;

    const [registry] = PublicKey.findProgramAddressSync(
        [Buffer.from("validator_registry")],
        program.programId
    );

    it("initialize", async () => {
        const info = await provider.connection.getAccountInfo(registry);
        if (info) {
            return;
        }
        console.log("\tRegistry not found. Attempting to initialize.");

        const tx = await program.methods
            .initRegistry()
            .accounts({
                //@ts-ignore
                registry,
                authority: payer.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .transaction();

        const txHash = await provider.sendAndConfirm(tx);

        console.log(`\tInitialize a registry tx: https://explorer.solana.com/tx/${txHash}?cluster=localnet`);
        const newInfo = await provider.connection.getAccountInfo(registry);
        assert(newInfo, "Registry should be initialized.");
    });

    it("add validator", async () => {
        let registryData = await program.account.validatorRegistry.fetch(registry);
        if (registryData.validatorKeys.map((key) => key.toString()).includes(validator.toBase58())) {
            return;
        }

        const tx = await program.methods
            .addValidator(validator)
            .accounts({
                registry,
                owner: payer.publicKey,
            })
            .transaction();

        const txHash = await provider.sendAndConfirm(tx);

        console.log(`\tAdd a validator tx: https://explorer.solana.com/tx/${txHash}?cluster=custom-localhost`);
        registryData = await program.account.validatorRegistry.fetch(registry);
        assert(registryData.validatorKeys.map((key) => key.toString()).includes(validator.toBase58()), "Validator should be added.");
    });
});
