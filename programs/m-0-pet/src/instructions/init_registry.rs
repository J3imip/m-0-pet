use anchor_lang::prelude::*;
use crate::constants::MAX_VALIDATORS;

#[derive(Accounts)]
pub struct InitRegistry<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 4 + 32 * MAX_VALIDATORS as usize,
        seeds = [b"validator_registry"],
        bump
    )]
    pub registry: Account<'info, ValidatorRegistry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct ValidatorRegistry {
    pub owner: Pubkey,
    pub validator_keys: Vec<Pubkey>,
}

pub fn handler(ctx: Context<InitRegistry>) -> Result<()> {
    let registry = &mut ctx.accounts.registry;
    registry.owner = *ctx.accounts.authority.to_account_info().key;
    registry.validator_keys = vec![];
    Ok(())
}
