use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer, transfer};
use anchor_spl::associated_token::{AssociatedToken};
use anchor_lang::solana_program::{clock};

declare_id!("EJReuMV3KRJVJBSQPhU1aTr5SZWUQfRXc14hiFY2gBoc");

const FUND_PDA_SEED: &[u8] = b"fund";
const TOKEN_VAULT_AUTHORITY_PDA_SEED: &[u8] = b"token-vault-authority";

#[program]
pub mod time_locked_fund {
    use super::*;

    pub fn create_fund(ctx: Context<CreateFund>, _seed: String, amount: u64, redeem_timestamp: u64) -> Result<()> {
        {   
            transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.payer_token_account.to_account_info(),
                        to: ctx.accounts.token_vault.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                amount
            )?;
        }

        let fund = &mut ctx.accounts.fund;
        fund.mint = ctx.accounts.mint.key();
        fund.token_vault = ctx.accounts.token_vault.key();
        fund.redeemer = ctx.accounts.redeemer.key();
        fund.amount = amount;
        fund.redeem_timestamp = redeem_timestamp;

        Ok(())
    }

    pub fn redeem(ctx: Context<Redeem>) -> Result<()> {
        // Validate time
        let clock = clock::Clock::get().unwrap();
        if (clock.unix_timestamp as u64) < ctx.accounts.fund.redeem_timestamp {
            return Err(ErrorCode::InsufficientRedeemTime.into());
        }
        
        {
            let (_token_vault_authority, token_vault_authority_bump) =
                Pubkey::find_program_address(&[TOKEN_VAULT_AUTHORITY_PDA_SEED], ctx.program_id);
            let authority_seeds = &[&TOKEN_VAULT_AUTHORITY_PDA_SEED[..], &[token_vault_authority_bump]];

            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.token_vault.to_account_info(),
                        to: ctx.accounts.redeemer_token_account.to_account_info(),
                        authority: ctx.accounts.token_vault_authority.to_account_info(),
                    },
                    &[&authority_seeds[..]]
                ), 
                ctx.accounts.fund.amount
            )?;
        }

        Ok(())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Redeem time has not been reached")]
    InsufficientRedeemTime,
}

#[derive(Accounts)]
#[instruction(_seed: String)]
pub struct CreateFund<'info> {
    #[account(
        init,
        space= 8 + Fund::INIT_SPACE,
        payer = payer,
        seeds= [FUND_PDA_SEED, payer.key().as_ref(), _seed.as_ref()],
        bump
    )]
    pub fund: Box<Account<'info, Fund>>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        seeds = [fund.key().as_ref()],
        bump,
        payer = payer,
        token::mint = mint,
        token::authority = token_vault_authority,
    )]
    pub token_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        seeds = [TOKEN_VAULT_AUTHORITY_PDA_SEED.as_ref()],
        bump
    )]
    /// CHECK: This is not dangerous because this is when we set the vault authority which can be any
    pub token_vault_authority: AccountInfo<'info>,

    #[account(
        mut,
        constraint = payer_token_account.mint == mint.key(),
        constraint = payer_token_account.owner == payer.key(),
    )]
    pub payer_token_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is not dangerous because this can be set to anyone on creation
    pub redeemer: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>
}

#[derive(Accounts)]
pub struct Redeem<'info> {
    #[account(
        constraint = fund.redeemer == redeemer.key(),
    )]
    pub fund: Box<Account<'info, Fund>>,

    #[account(
        constraint = mint.key() == fund.mint,
    )]
    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = token_vault.mint == fund.mint,
        constraint = token_vault.key() == fund.token_vault,
    )]
    pub token_vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is not dangerous because the vault authority needs to be the authority of the token vault
    /// Perhaps we could add a check to guarantee that here but it would fail on execution.
    pub token_vault_authority: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = redeemer,
        associated_token::mint = mint,
        associated_token::authority = redeemer,
    )]
    pub redeemer_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub redeemer: Signer<'info>,
    
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>
}

#[account]
#[derive(InitSpace)]
#[derive(Default)]
pub struct Fund {
    pub amount: u64,
    pub redeem_timestamp: u64,
    pub mint: Pubkey,
    pub token_vault: Pubkey,
    pub redeemer: Pubkey
}
