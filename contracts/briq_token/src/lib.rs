#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env, String, Symbol,
};

// -----------------------------
// Cross-contract: RentalAgreement (for mutual review rewards)
// -----------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AgreementStatus {
    Draft,
    PendingTenantSign,
    PendingLandlordSign,
    PendingPayment,
    Active,
    Completed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RentalAgreement {
    pub id: BytesN<32>,
    pub property_id: BytesN<32>,
    pub landlord: Address,
    pub tenant: Address,
    pub monthly_rent: i128,
    pub security_deposit: i128,
    pub start_date: u64,
    pub end_date: u64,
    pub status: AgreementStatus,
    pub landlord_signed: bool,
    pub landlord_signed_at: u64,
    pub tenant_signed: bool,
    pub tenant_signed_at: u64,
    pub deposit_paid: bool,
    pub deposit_paid_at: u64,
    pub total_rent_paid: i128,
    pub months_paid: u32,
    pub created_at: u64,
    pub completed_at: u64,
}

#[contractclient(name = "RentalAgreementClient")]
pub trait RentalAgreementContract {
    fn get_agreement(agreement_id: BytesN<32>) -> RentalAgreement;
}

// -----------------------------
// BriqToken contract (simple reward token)
// -----------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    ContractPaused = 1,
    Unauthorized = 2,
    AlreadyInitialized = 3,

    InvalidAmount = 500,
    InsufficientBalance = 501,
    AgreementContractNotSet = 503,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardConfig {
    pub first_payment_reward: i128,
    pub review_reward: i128,
    pub mutual_review_bonus: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Metadata {
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Paused,
    Metadata,
    TotalSupply,
    Balance(Address),
    RewardConfig,
    AgreementContract,
    ClaimFirstPayment(BytesN<32>, Address),
    ClaimReview(BytesN<32>, Address),
    ClaimMutual(BytesN<32>),
}

#[contract]
pub struct BriqToken;

#[contractimpl]
impl BriqToken {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(
            &DataKey::Metadata,
            &Metadata {
                name: String::from_str(&env, "Briq Reward"),
                symbol: String::from_str(&env, "BRIQ-R"),
                decimals: 7,
            },
        );
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);

        // Defaults (using 7 decimals)
        env.storage().instance().set(
            &DataKey::RewardConfig,
            &RewardConfig {
                first_payment_reward: 10_000_0000,
                review_reward: 25_000_0000,
                mutual_review_bonus: 15_000_0000,
            },
        );

        env.events().publish(
            (Symbol::new(&env, "Initialized"),),
            (admin, env.ledger().timestamp()),
        );
    }

    // --- Admin controls ---

    pub fn pause(env: Env) {
        let admin = Self::require_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events()
            .publish((Symbol::new(&env, "Paused"),), env.ledger().timestamp());
    }

    pub fn unpause(env: Env) {
        let admin = Self::require_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events()
            .publish((Symbol::new(&env, "Unpaused"),), env.ledger().timestamp());
    }

    pub fn set_reward_config(
        env: Env,
        first_payment_reward: i128,
        review_reward: i128,
        mutual_review_bonus: i128,
    ) {
        Self::check_not_paused(&env);

        let admin = Self::require_admin(&env);
        admin.require_auth();

        if first_payment_reward < 0 || review_reward < 0 || mutual_review_bonus < 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        env.storage().instance().set(
            &DataKey::RewardConfig,
            &RewardConfig {
                first_payment_reward,
                review_reward,
                mutual_review_bonus,
            },
        );

        env.events().publish(
            (Symbol::new(&env, "RewardConfigSet"),),
            (first_payment_reward, review_reward, mutual_review_bonus),
        );
    }

    pub fn get_reward_config(env: Env) -> RewardConfig {
        env.storage()
            .instance()
            .get(&DataKey::RewardConfig)
            .unwrap()
    }

    pub fn set_agreement_contract(env: Env, agreement_contract: Address) {
        Self::check_not_paused(&env);

        let admin = Self::require_admin(&env);
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::AgreementContract, &agreement_contract);

        env.events().publish(
            (Symbol::new(&env, "AgreementContractSet"),),
            (agreement_contract, env.ledger().timestamp()),
        );
    }

    // --- Token metadata ---

    pub fn name(env: Env) -> String {
        Self::metadata(&env).name
    }

    pub fn symbol(env: Env) -> String {
        Self::metadata(&env).symbol
    }

    pub fn decimals(env: Env) -> u32 {
        Self::metadata(&env).decimals
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn balance_of(env: Env, owner: Address) -> i128 {
        Self::get_balance(&env, &owner)
    }

    // --- Token actions ---

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        Self::check_not_paused(&env);
        from.require_auth();

        Self::do_transfer(&env, &from, &to, amount);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        Self::check_not_paused(&env);

        let admin = Self::require_admin(&env);
        admin.require_auth();

        Self::do_mint(&env, &to, amount);
        env.events()
            .publish((Symbol::new(&env, "Mint"),), (to, amount));
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        Self::check_not_paused(&env);

        let admin = Self::require_admin(&env);
        admin.require_auth();

        Self::do_burn(&env, &from, amount);
        env.events()
            .publish((Symbol::new(&env, "Burn"),), (from, amount));
    }

    // --- Rewards (called by other contracts) ---

    pub fn reward_first_payment(env: Env, agreement_id: BytesN<32>, tenant: Address) {
        Self::check_not_paused(&env);

        // One-claim-per-(agreement, tenant)
        if env.storage().persistent().has(&DataKey::ClaimFirstPayment(
            agreement_id.clone(),
            tenant.clone(),
        )) {
            return;
        }

        let cfg = Self::reward_config(&env);
        if cfg.first_payment_reward <= 0 {
            return;
        }

        Self::do_mint(&env, &tenant, cfg.first_payment_reward);
        env.storage().persistent().set(
            &DataKey::ClaimFirstPayment(agreement_id.clone(), tenant.clone()),
            &true,
        );
        env.events().publish(
            (Symbol::new(&env, "RewardIssued"),),
            (
                Symbol::new(&env, "FirstPayment"),
                agreement_id,
                tenant,
                cfg.first_payment_reward,
            ),
        );
    }

    pub fn reward_review(env: Env, agreement_id: BytesN<32>, reviewer: Address) {
        Self::check_not_paused(&env);

        // One-claim-per-(agreement, reviewer)
        if env.storage().persistent().has(&DataKey::ClaimReview(
            agreement_id.clone(),
            reviewer.clone(),
        )) {
            return;
        }

        let cfg = Self::reward_config(&env);
        if cfg.review_reward <= 0 {
            return;
        }

        Self::do_mint(&env, &reviewer, cfg.review_reward);
        env.storage().persistent().set(
            &DataKey::ClaimReview(agreement_id.clone(), reviewer.clone()),
            &true,
        );
        env.events().publish(
            (Symbol::new(&env, "RewardIssued"),),
            (
                Symbol::new(&env, "Review"),
                agreement_id,
                reviewer,
                cfg.review_reward,
            ),
        );
    }

    // Called once mutual reviews are complete.
    // Token contract fetches the agreement and mints bonus to both tenant and landlord.
    pub fn reward_mutual_review(env: Env, agreement_id: BytesN<32>) {
        Self::check_not_paused(&env);

        // One-claim-per-agreement
        if env
            .storage()
            .persistent()
            .has(&DataKey::ClaimMutual(agreement_id.clone()))
        {
            return;
        }

        let cfg = Self::reward_config(&env);
        if cfg.mutual_review_bonus <= 0 {
            return;
        }

        let agreement_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::AgreementContract)
            .unwrap_or_else(|| panic_with_error!(&env, Error::AgreementContractNotSet));
        let agreement_client = RentalAgreementClient::new(&env, &agreement_contract);
        let a = agreement_client.get_agreement(&agreement_id);

        Self::do_mint(&env, &a.tenant, cfg.mutual_review_bonus);
        Self::do_mint(&env, &a.landlord, cfg.mutual_review_bonus);

        env.storage()
            .persistent()
            .set(&DataKey::ClaimMutual(agreement_id.clone()), &true);

        env.events().publish(
            (Symbol::new(&env, "RewardIssued"),),
            (
                Symbol::new(&env, "MutualReview"),
                agreement_id.clone(),
                a.tenant,
                cfg.mutual_review_bonus,
            ),
        );
        env.events().publish(
            (Symbol::new(&env, "RewardIssued"),),
            (
                Symbol::new(&env, "MutualReview"),
                agreement_id,
                a.landlord,
                cfg.mutual_review_bonus,
            ),
        );
    }

    // -----------------------------
    // Internals
    // -----------------------------

    fn check_not_paused(env: &Env) {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            panic_with_error!(env, Error::ContractPaused);
        }
    }

    fn require_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::Unauthorized))
    }

    fn metadata(env: &Env) -> Metadata {
        env.storage().instance().get(&DataKey::Metadata).unwrap()
    }

    fn reward_config(env: &Env) -> RewardConfig {
        env.storage()
            .instance()
            .get(&DataKey::RewardConfig)
            .unwrap()
    }

    fn do_transfer(env: &Env, from: &Address, to: &Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(env, Error::InvalidAmount);
        }

        let from_balance = Self::get_balance(env, from);
        if from_balance < amount {
            panic_with_error!(env, Error::InsufficientBalance);
        }

        Self::set_balance(env, from, from_balance - amount);
        let to_balance = Self::get_balance(env, to);
        Self::set_balance(env, to, to_balance + amount);

        env.events().publish(
            (Symbol::new(env, "Transfer"),),
            (from.clone(), to.clone(), amount),
        );
    }

    fn do_mint(env: &Env, to: &Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(env, Error::InvalidAmount);
        }

        let to_balance = Self::get_balance(env, to);
        Self::set_balance(env, to, to_balance + amount);

        let supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply + amount));
    }

    fn do_burn(env: &Env, from: &Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(env, Error::InvalidAmount);
        }

        let from_balance = Self::get_balance(env, from);
        if from_balance < amount {
            panic_with_error!(env, Error::InsufficientBalance);
        }

        Self::set_balance(env, from, from_balance - amount);
        let supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply - amount));
    }

    fn set_balance(env: &Env, owner: &Address, amount: i128) {
        env.storage()
            .persistent()
            .set(&DataKey::Balance(owner.clone()), &amount);
    }

    fn get_balance(env: &Env, owner: &Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(owner.clone()))
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn mint_and_transfer() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, BriqToken);
        let client = BriqTokenClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.mint(&alice, &100);
        assert_eq!(client.balance_of(&alice), 100);
        // transfer requires "from" now
        client.transfer(&alice, &bob, &25);
        assert_eq!(client.balance_of(&alice), 75);
        assert_eq!(client.balance_of(&bob), 25);
    }
}
