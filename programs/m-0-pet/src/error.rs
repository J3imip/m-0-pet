use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid Signature")]
    InvalidSignature,
    #[msg("Unauthorized Minter")]
    UnauthorizedMinter,
    #[msg("Insufficient Collateral")]
    InsufficientCollateral,
    #[msg("Key Already Exists")]
    KeyAlreadyExists,
    #[msg("Missing Ed25519 Instruction")]
    MissingEd25519Instruction,
    #[msg("Invalid Ed25519 Instruction")]
    InvalidEd25519Instruction,
    #[msg("Invalid Public Key")]
    InvalidPublicKey,
    #[msg("Invalid Message")]
    InvalidMessage,
    #[msg("Mint Lock Conflict")]
    MintLockConflict,
}
