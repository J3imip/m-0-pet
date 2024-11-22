use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions::{load_instruction_at_checked, load_current_index_checked};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};
use sha3::digest::Digest;
use crate::instructions::ValidatorRegistry;
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(proof: Proof)]
pub struct MintTokens<'info> {
    #[account(
        mut,
        seeds = [b"mint"],
        bump,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    #[account(
        seeds = [b"validator_registry"],
        bump,
    )]
    pub registry: Account<'info, ValidatorRegistry>,
    /// CHECK:
    pub instruction_sysvar: AccountInfo<'info>,
    /// CHECK:
    #[account(
        init,
        seeds = [b"mint_lock", proof.signature_hash.as_ref()],
        payer = payer,
        space = 8,
        bump,
    )]
    pub mint_lock: AccountInfo<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct Proof {
    pub minter: Pubkey,
    pub collateral_amount: u64,
    pub timestamp: u64,
    pub signature_hash: [u8; 32],
    pub validator_index: u8,
}

pub fn handler(ctx: Context<MintTokens>, proof: Proof, quantity: u64) -> Result<()> {
    let registry = &mut ctx.accounts.registry;
    let message = [
        proof.minter.as_ref(),
        &proof.collateral_amount.to_le_bytes(),
        &proof.timestamp.to_le_bytes(),
    ]
    .concat();

    verify_ed25519_instruction(
        &ctx.accounts.instruction_sysvar,
        registry.validator_keys[proof.validator_index as usize].as_ref(),
        &message,
        &proof.signature_hash,
    )?;

    require!(proof.minter == *ctx.accounts.payer.key, ErrorCode::UnauthorizedMinter);

    require!(proof.collateral_amount >= quantity, ErrorCode::InsufficientCollateral);

    let seeds = &["mint".as_bytes(), &[ctx.bumps.mint]];
    let signer = [&seeds[..]];

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.mint.to_account_info(),
            },
            &signer,
        ),
        quantity * 1_000_000_000,
    )?;

    Ok(())
}

pub fn verify_ed25519_instruction(
    instruction_sysvar: &AccountInfo,
    expected_public_key: &[u8],
    message: &[u8],
    signature_hash: &[u8]
) -> Result<()> {
    let current_index = load_current_index_checked(instruction_sysvar)?;
    if current_index == 0 {
        return Err(ErrorCode::MissingEd25519Instruction.into());
    }

    let ed25519_instruction = load_instruction_at_checked((current_index - 1) as usize, instruction_sysvar)?;

    // Verify the content of the Ed25519 instruction
    let instruction_data = ed25519_instruction.data;
    if instruction_data.len() < 2 {
        return Err(ErrorCode::InvalidEd25519Instruction.into());
    }

    let num_signatures = instruction_data[0];
    if num_signatures != 1 {
        return Err(ErrorCode::InvalidEd25519Instruction.into());
    }

    // Parse Ed25519SignatureOffsets
    let offsets: Ed25519SignatureOffsets = Ed25519SignatureOffsets::try_from_slice(&instruction_data[2..16])?;

    // Verify public key
    let pubkey_start = offsets.public_key_offset as usize;
    let pubkey_end = pubkey_start + 32;
    if &instruction_data[pubkey_start..pubkey_end] != expected_public_key {
        return Err(ErrorCode::InvalidPublicKey.into());
    }

    // Verify message
    let msg_start = offsets.message_data_offset as usize;
    let msg_end = msg_start + offsets.message_data_size as usize;
    if &instruction_data[msg_start..msg_end] != message {
        return Err(ErrorCode::InvalidMessage.into());
    }

    // Verify signature
    let sig_start = offsets.signature_offset as usize;
    let sig_end = sig_start + 64;
    let instruction_signature_hash = sha3::Keccak256::digest(&instruction_data[sig_start..sig_end]);
    if instruction_signature_hash.as_slice() != signature_hash {
        return Err(ErrorCode::InvalidSignature.into());
    }

    Ok(())
}


#[derive(AnchorSerialize, AnchorDeserialize)]
struct Ed25519SignatureOffsets {
    signature_offset: u16,
    signature_instruction_index: u16,
    public_key_offset: u16,
    public_key_instruction_index: u16,
    message_data_offset: u16,
    message_data_size: u16,
    message_instruction_index: u16,
}
