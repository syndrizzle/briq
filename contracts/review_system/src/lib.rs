#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env, String, Symbol, Vec,
};

// -----------------------------
// Cross-contract: RentalAgreement
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
// Cross-contract: RewardToken (optional)
// -----------------------------

#[contractclient(name = "RewardTokenClient")]
pub trait RewardToken {
    fn reward_review(agreement_id: BytesN<32>, reviewer: Address);
    fn reward_mutual_review(agreement_id: BytesN<32>);
}

// -----------------------------
// ReviewSystem contract
// -----------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    ContractPaused = 1,
    Unauthorized = 2,
    AlreadyInitialized = 3,

    AgreementNotFound = 400,
    NotAgreementParty = 401,
    NotEligibleYet = 402,
    AlreadyReviewed = 403,
    InvalidRating = 404,
    ReviewTooLong = 405,
    InvalidAgreementState = 406,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ReviewerType {
    Tenant,
    Landlord,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Review {
    pub id: BytesN<32>,
    pub agreement_id: BytesN<32>,
    pub reviewer: Address,
    pub reviewee: Address,
    pub reviewer_type: ReviewerType,
    pub rating: u32,
    pub review_text: String,
    pub created_at: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Paused,
    AgreementContract,
    RewardToken,
    Review(BytesN<32>),
    ReviewsByAgreement(BytesN<32>),
    ReviewsByUser(Address),
}

#[contract]
pub struct ReviewSystem;

#[contractimpl]
impl ReviewSystem {
    pub fn initialize(env: Env, admin: Address, agreement_contract: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }

        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage()
            .instance()
            .set(&DataKey::AgreementContract, &agreement_contract);

        env.events().publish(
            (Symbol::new(&env, "Initialized"),),
            (admin, agreement_contract, env.ledger().timestamp()),
        );
    }

    // Optional: configure reward token contract address.
    // If not set, the review system will not mint rewards.
    pub fn set_reward_token(env: Env, reward_token: Address) {
        Self::check_not_paused(&env);

        let admin = Self::require_admin(&env);
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::RewardToken, &reward_token);

        env.events().publish(
            (Symbol::new(&env, "RewardTokenSet"),),
            (reward_token, env.ledger().timestamp()),
        );
    }

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

    pub fn can_submit_review(env: Env, agreement_id: BytesN<32>, reviewer: Address) -> bool {
        let agreement = Self::fetch_agreement(&env, agreement_id.clone());

        // Must be tenant or landlord.
        if reviewer != agreement.tenant && reviewer != agreement.landlord {
            return false;
        }

        // Agreement must be active or completed.
        match agreement.status {
            AgreementStatus::Active | AgreementStatus::Completed => {}
            _ => return false,
        }

        // 30 day rule since agreement start.
        let now = env.ledger().timestamp();
        let thirty_days: u64 = 30 * 24 * 60 * 60;
        if now < agreement.start_date.saturating_add(thirty_days) {
            return false;
        }

        // Only one review per reviewer per agreement.
        let ids = Self::review_ids_by_agreement(&env, &agreement_id);
        for rid in ids.iter() {
            if let Some(r) = env
                .storage()
                .persistent()
                .get::<_, Review>(&DataKey::Review(rid))
            {
                if r.reviewer == reviewer {
                    return false;
                }
            }
        }

        true
    }

    pub fn submit_review(
        env: Env,
        reviewer: Address,
        agreement_id: BytesN<32>,
        rating: u32,
        review_text: String,
    ) -> BytesN<32> {
        Self::check_not_paused(&env);

        reviewer.require_auth();

        if rating < 1 || rating > 5 {
            panic_with_error!(&env, Error::InvalidRating);
        }
        if review_text.len() > 2000 {
            panic_with_error!(&env, Error::ReviewTooLong);
        }

        let agreement = Self::fetch_agreement(&env, agreement_id.clone());
        if reviewer != agreement.tenant && reviewer != agreement.landlord {
            panic_with_error!(&env, Error::NotAgreementParty);
        }

        match agreement.status {
            AgreementStatus::Active | AgreementStatus::Completed => {}
            _ => panic_with_error!(&env, Error::InvalidAgreementState),
        }

        let now = env.ledger().timestamp();
        let thirty_days: u64 = 30 * 24 * 60 * 60;
        if now < agreement.start_date.saturating_add(thirty_days) {
            panic_with_error!(&env, Error::NotEligibleYet);
        }

        // Enforce one-review-per-agreement-per-reviewer.
        let ids = Self::review_ids_by_agreement(&env, &agreement_id);
        for rid in ids.iter() {
            if let Some(r) = env
                .storage()
                .persistent()
                .get::<_, Review>(&DataKey::Review(rid))
            {
                if r.reviewer == reviewer {
                    panic_with_error!(&env, Error::AlreadyReviewed);
                }
            }
        }

        let (reviewee, reviewer_type) = if reviewer == agreement.tenant {
            (agreement.landlord.clone(), ReviewerType::Tenant)
        } else {
            (agreement.tenant.clone(), ReviewerType::Landlord)
        };

        let review_id = Self::new_id(&env);
        let review = Review {
            id: review_id.clone(),
            agreement_id: agreement_id.clone(),
            reviewer: reviewer.clone(),
            reviewee: reviewee.clone(),
            reviewer_type,
            rating,
            review_text,
            created_at: now,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Review(review_id.clone()), &review);

        // Index by agreement
        let mut by_agreement = ids;
        by_agreement.push_back(review_id.clone());
        env.storage().persistent().set(
            &DataKey::ReviewsByAgreement(agreement_id.clone()),
            &by_agreement,
        );

        // Index by user (reviewer)
        let mut by_user: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::ReviewsByUser(reviewer.clone()))
            .unwrap_or(Vec::new(&env));
        by_user.push_back(review_id.clone());
        env.storage()
            .persistent()
            .set(&DataKey::ReviewsByUser(reviewer.clone()), &by_user);

        env.events().publish(
            (Symbol::new(&env, "ReviewSubmitted"),),
            (
                review_id.clone(),
                agreement_id.clone(),
                reviewer,
                reviewee,
                rating,
            ),
        );

        // Rewards (optional)
        Self::maybe_reward_review(&env, agreement_id.clone(), &review.reviewer);

        // If both sides reviewed, emit event and reward mutual bonus (optional)
        if Self::has_mutual_reviews(&env, &agreement_id) {
            env.events().publish(
                (Symbol::new(&env, "MutualReviewCompleted"),),
                (agreement_id.clone(), now),
            );
            Self::maybe_reward_mutual(&env, agreement_id.clone());
        }

        review_id
    }

    pub fn get_review(env: Env, review_id: BytesN<32>) -> Review {
        env.storage()
            .persistent()
            .get(&DataKey::Review(review_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::AgreementNotFound))
    }

    pub fn get_reviews_for_agreement(env: Env, agreement_id: BytesN<32>) -> Vec<Review> {
        let ids = Self::review_ids_by_agreement(&env, &agreement_id);
        let mut out = Vec::<Review>::new(&env);
        for rid in ids.iter() {
            if let Some(r) = env
                .storage()
                .persistent()
                .get::<_, Review>(&DataKey::Review(rid))
            {
                out.push_back(r);
            }
        }
        out
    }

    pub fn get_reviews_by_user(env: Env, user: Address) -> Vec<Review> {
        let ids: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::ReviewsByUser(user))
            .unwrap_or(Vec::new(&env));
        let mut out = Vec::<Review>::new(&env);
        for rid in ids.iter() {
            if let Some(r) = env
                .storage()
                .persistent()
                .get::<_, Review>(&DataKey::Review(rid))
            {
                out.push_back(r);
            }
        }
        out
    }

    fn review_ids_by_agreement(env: &Env, agreement_id: &BytesN<32>) -> Vec<BytesN<32>> {
        env.storage()
            .persistent()
            .get(&DataKey::ReviewsByAgreement(agreement_id.clone()))
            .unwrap_or(Vec::new(env))
    }

    fn has_mutual_reviews(env: &Env, agreement_id: &BytesN<32>) -> bool {
        let ids = Self::review_ids_by_agreement(env, agreement_id);
        let mut has_tenant = false;
        let mut has_landlord = false;

        for rid in ids.iter() {
            if let Some(r) = env
                .storage()
                .persistent()
                .get::<_, Review>(&DataKey::Review(rid))
            {
                match r.reviewer_type {
                    ReviewerType::Tenant => has_tenant = true,
                    ReviewerType::Landlord => has_landlord = true,
                }
            }
        }

        has_tenant && has_landlord
    }

    fn maybe_reward_review(env: &Env, agreement_id: BytesN<32>, reviewer: &Address) {
        if let Some(token_addr) = env
            .storage()
            .instance()
            .get::<_, Address>(&DataKey::RewardToken)
        {
            let client = RewardTokenClient::new(env, &token_addr);
            client.reward_review(&agreement_id, reviewer);
        }
    }

    fn maybe_reward_mutual(env: &Env, agreement_id: BytesN<32>) {
        if let Some(token_addr) = env
            .storage()
            .instance()
            .get::<_, Address>(&DataKey::RewardToken)
        {
            let client = RewardTokenClient::new(env, &token_addr);
            client.reward_mutual_review(&agreement_id);
        }
    }

    fn fetch_agreement(env: &Env, agreement_id: BytesN<32>) -> RentalAgreement {
        let addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::AgreementContract)
            .unwrap_or_else(|| panic_with_error!(env, Error::Unauthorized));
        let client = RentalAgreementClient::new(env, &addr);
        client.get_agreement(&agreement_id)
    }

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

    fn new_id(env: &Env) -> BytesN<32> {
        env.prng().gen::<BytesN<32>>()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn initialize_smoke() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ReviewSystem);
        let client = ReviewSystemClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let agreement_contract = Address::generate(&env);
        client.initialize(&admin, &agreement_contract);

        client.pause();
        client.unpause();
    }
}
