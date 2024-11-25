use anchor_lang::prelude::*;
use crate::instructions::ValidatorRegistry;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct AddValidator<'info> {
    #[account(
        mut,
        seeds = [b"validator_registry"],
        bump,
        has_one = owner,
    )]
    pub registry: Account<'info, ValidatorRegistry>,
    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<AddValidator>, validator: Pubkey) -> Result<()> {
    let registry = &mut ctx.accounts.registry;

    require!(
        !registry.validator_keys.contains(&validator),
        ErrorCode::KeyAlreadyExists,
    );

    registry.validator_keys.push(validator);
    Ok(())
}
