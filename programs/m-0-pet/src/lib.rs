mod instructions;
mod error;
mod constants;

use anchor_lang::prelude::*;
use instructions::*;

declare_id!("3VHT8cZiJwxiE4s48r6fv7xBccgjPEYGqKmX5DpkWDe3");

#[program]
pub mod m_0_pet {
    use super::*;

    pub fn init_registry(ctx: Context<InitRegistry>) -> Result<()> {
        init_registry::handler(ctx)
    }

    pub fn add_validator(ctx: Context<AddValidator>, validator: Pubkey) -> Result<()> {
        add_validator::handler(ctx, validator)
    }

    pub fn init_token(ctx: Context<InitToken>, metadata: InitTokenParams) -> Result<()> {
        init_token::handler(ctx, metadata)
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, proof: Proof, quantity: u64) -> Result<()> {
        mint_tokens::handler(ctx, proof, quantity)
    }
}
