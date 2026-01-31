#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env, String, Symbol, Vec,
};

// -----------------------------
// Cross-contract: PropertyRegistry
// -----------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Property {
    pub id: BytesN<32>,
    pub owner: Address,
    pub title: String,
    pub description: String,
    pub location: String,
    pub price_per_month: i128,
    pub security_deposit: i128,
    pub min_stay_days: u32,
    pub max_stay_days: u32,
    pub image_url: String,
    pub is_available: bool,
    pub is_active: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contractclient(name = "PropertyRegistryClient")]
pub trait PropertyRegistry {
    fn get_property(property_id: BytesN<32>) -> Property;
}

// -----------------------------
// RentalAgreement contract
// -----------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    ContractPaused = 1,
    Unauthorized = 2,
    AlreadyInitialized = 3,

    PropertyNotFoundOrInactive = 200,
    PropertyNotAvailable = 201,
    InvalidDates = 202,
    DurationBelowMinimum = 203,
    DurationAboveMaximum = 204,
    AgreementNotFound = 205,
    NotAgreementParty = 206,
    AlreadySigned = 207,
    InvalidState = 208,
}

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

#[contracttype]
pub enum DataKey {
    Admin,
    Paused,
    PropertyRegistry,
    Agreement(BytesN<32>),
    AgreementList,
    ByTenant(Address),
    ByLandlord(Address),
    ByProperty(BytesN<32>),
}

#[contract]
pub struct RentalAgreementContract;

#[contractimpl]
impl RentalAgreementContract {
    pub fn initialize(env: Env, admin: Address, property_registry: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }

        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage()
            .instance()
            .set(&DataKey::PropertyRegistry, &property_registry);
        env.storage()
            .persistent()
            .set(&DataKey::AgreementList, &Vec::<BytesN<32>>::new(&env));

        env.events().publish(
            (Symbol::new(&env, "Initialized"),),
            (admin, property_registry, env.ledger().timestamp()),
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

    pub fn create_agreement(
        env: Env,
        landlord: Address,
        property_id: BytesN<32>,
        tenant: Address,
        start_date: u64,
        end_date: u64,
    ) -> BytesN<32> {
        Self::check_not_paused(&env);

        landlord.require_auth();

        let property = Self::fetch_property(&env, property_id.clone());
        if !property.is_active {
            panic_with_error!(&env, Error::PropertyNotFoundOrInactive);
        }
        if !property.is_available {
            panic_with_error!(&env, Error::PropertyNotAvailable);
        }
        if property.owner != landlord {
            panic_with_error!(&env, Error::Unauthorized);
        }

        Self::validate_dates_and_duration(
            &env,
            start_date,
            end_date,
            property.min_stay_days,
            property.max_stay_days,
        );

        let now = env.ledger().timestamp();
        let id = Self::new_id(&env);
        let agreement = RentalAgreement {
            id: id.clone(),
            property_id: property_id.clone(),
            landlord: landlord.clone(),
            tenant: tenant.clone(),
            monthly_rent: property.price_per_month,
            security_deposit: property.security_deposit,
            start_date,
            end_date,
            status: AgreementStatus::Draft,
            landlord_signed: false,
            landlord_signed_at: 0,
            tenant_signed: false,
            tenant_signed_at: 0,
            deposit_paid: false,
            deposit_paid_at: 0,
            total_rent_paid: 0,
            months_paid: 0,
            created_at: now,
            completed_at: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Agreement(id.clone()), &agreement);

        Self::index_agreement(&env, &agreement);

        env.events().publish(
            (Symbol::new(&env, "AgreementCreated"),),
            (
                id.clone(),
                property_id,
                landlord,
                tenant,
                agreement.monthly_rent,
                agreement.security_deposit,
            ),
        );

        id
    }

    pub fn tenant_sign(env: Env, tenant: Address, agreement_id: BytesN<32>) {
        Self::check_not_paused(&env);

        tenant.require_auth();

        let mut agreement = Self::get_agreement(env.clone(), agreement_id.clone());
        if tenant != agreement.tenant {
            panic_with_error!(&env, Error::NotAgreementParty);
        }
        if agreement.tenant_signed {
            panic_with_error!(&env, Error::AlreadySigned);
        }

        agreement.tenant_signed = true;
        agreement.tenant_signed_at = env.ledger().timestamp();
        agreement.status = Self::next_status_after_signature(&agreement);

        env.storage()
            .persistent()
            .set(&DataKey::Agreement(agreement_id.clone()), &agreement);

        env.events().publish(
            (Symbol::new(&env, "AgreementSigned"),),
            (agreement_id, tenant, Symbol::new(&env, "Tenant")),
        );
    }

    pub fn landlord_sign(env: Env, landlord: Address, agreement_id: BytesN<32>) {
        Self::check_not_paused(&env);

        landlord.require_auth();

        let mut agreement = Self::get_agreement(env.clone(), agreement_id.clone());
        if landlord != agreement.landlord {
            panic_with_error!(&env, Error::NotAgreementParty);
        }
        if agreement.landlord_signed {
            panic_with_error!(&env, Error::AlreadySigned);
        }

        agreement.landlord_signed = true;
        agreement.landlord_signed_at = env.ledger().timestamp();
        agreement.status = Self::next_status_after_signature(&agreement);

        env.storage()
            .persistent()
            .set(&DataKey::Agreement(agreement_id.clone()), &agreement);

        env.events().publish(
            (Symbol::new(&env, "AgreementSigned"),),
            (agreement_id, landlord, Symbol::new(&env, "Landlord")),
        );
    }

    // Called by escrow contract when deposit + first month rent are received.
    pub fn mark_deposit_paid(env: Env, agreement_id: BytesN<32>) {
        Self::check_not_paused(&env);

        let mut agreement = Self::get_agreement(env.clone(), agreement_id.clone());
        if agreement.status != AgreementStatus::PendingPayment {
            panic_with_error!(&env, Error::InvalidState);
        }
        if agreement.deposit_paid {
            return;
        }

        agreement.deposit_paid = true;
        agreement.deposit_paid_at = env.ledger().timestamp();
        agreement.status = AgreementStatus::Active;

        env.storage()
            .persistent()
            .set(&DataKey::Agreement(agreement_id.clone()), &agreement);

        env.events().publish(
            (Symbol::new(&env, "AgreementActivated"),),
            (agreement_id, agreement.deposit_paid_at),
        );
    }

    // Called by escrow contract for each rent payment.
    pub fn record_rent_payment(env: Env, agreement_id: BytesN<32>, amount: i128) {
        Self::check_not_paused(&env);

        let mut agreement = Self::get_agreement(env.clone(), agreement_id.clone());
        if agreement.status != AgreementStatus::Active {
            panic_with_error!(&env, Error::InvalidState);
        }

        agreement.total_rent_paid = agreement.total_rent_paid.saturating_add(amount);
        agreement.months_paid = agreement.months_paid.saturating_add(1);

        env.storage()
            .persistent()
            .set(&DataKey::Agreement(agreement_id.clone()), &agreement);

        env.events().publish(
            (Symbol::new(&env, "RentPaymentRecorded"),),
            (agreement_id, amount, agreement.months_paid),
        );
    }

    pub fn complete_agreement(env: Env, caller: Address, agreement_id: BytesN<32>) {
        Self::check_not_paused(&env);

        caller.require_auth();

        let mut agreement = Self::get_agreement(env.clone(), agreement_id.clone());
        if caller != agreement.tenant && caller != agreement.landlord {
            panic_with_error!(&env, Error::NotAgreementParty);
        }
        if agreement.status != AgreementStatus::Active {
            panic_with_error!(&env, Error::InvalidState);
        }

        let now = env.ledger().timestamp();
        if now < agreement.end_date {
            panic_with_error!(&env, Error::InvalidDates);
        }

        agreement.status = AgreementStatus::Completed;
        agreement.completed_at = now;

        env.storage()
            .persistent()
            .set(&DataKey::Agreement(agreement_id.clone()), &agreement);

        env.events().publish(
            (Symbol::new(&env, "AgreementCompleted"),),
            (agreement_id, agreement.completed_at),
        );
    }

    pub fn cancel_agreement(env: Env, caller: Address, agreement_id: BytesN<32>) {
        Self::check_not_paused(&env);

        // MVP: allow either party to cancel only before payment is made.
        caller.require_auth();

        let mut agreement = Self::get_agreement(env.clone(), agreement_id.clone());
        if caller != agreement.tenant && caller != agreement.landlord {
            panic_with_error!(&env, Error::NotAgreementParty);
        }
        if agreement.status == AgreementStatus::Active
            || agreement.status == AgreementStatus::Completed
            || agreement.deposit_paid
        {
            panic_with_error!(&env, Error::InvalidState);
        }

        agreement.status = AgreementStatus::Cancelled;

        env.storage()
            .persistent()
            .set(&DataKey::Agreement(agreement_id.clone()), &agreement);

        env.events().publish(
            (Symbol::new(&env, "AgreementCancelled"),),
            (agreement_id, env.ledger().timestamp()),
        );
    }

    pub fn get_agreement(env: Env, agreement_id: BytesN<32>) -> RentalAgreement {
        env.storage()
            .persistent()
            .get(&DataKey::Agreement(agreement_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::AgreementNotFound))
    }

    pub fn get_agreements_by_tenant(env: Env, tenant: Address) -> Vec<RentalAgreement> {
        let ids: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::ByTenant(tenant.clone()))
            .unwrap_or(Vec::new(&env));

        Self::hydrate_agreements(&env, ids)
    }

    pub fn get_agreements_by_landlord(env: Env, landlord: Address) -> Vec<RentalAgreement> {
        let ids: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::ByLandlord(landlord.clone()))
            .unwrap_or(Vec::new(&env));

        Self::hydrate_agreements(&env, ids)
    }

    pub fn get_agreements_by_property(env: Env, property_id: BytesN<32>) -> Vec<RentalAgreement> {
        let ids: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::ByProperty(property_id))
            .unwrap_or(Vec::new(&env));

        Self::hydrate_agreements(&env, ids)
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

    fn fetch_property(env: &Env, property_id: BytesN<32>) -> Property {
        let registry: Address = env
            .storage()
            .instance()
            .get(&DataKey::PropertyRegistry)
            .unwrap_or_else(|| panic_with_error!(env, Error::Unauthorized));

        let client = PropertyRegistryClient::new(env, &registry);
        // If the registry panics for not found, we treat it as inactive/not found.
        client.get_property(&property_id)
    }

    fn validate_dates_and_duration(
        env: &Env,
        start_date: u64,
        end_date: u64,
        min_days: u32,
        max_days: u32,
    ) {
        if end_date <= start_date {
            panic_with_error!(env, Error::InvalidDates);
        }

        let seconds_per_day: u64 = 24 * 60 * 60;
        let duration_seconds = end_date - start_date;
        let duration_days = (duration_seconds / seconds_per_day) as u32;

        if duration_days < min_days {
            panic_with_error!(env, Error::DurationBelowMinimum);
        }
        if duration_days > max_days {
            panic_with_error!(env, Error::DurationAboveMaximum);
        }
    }

    fn next_status_after_signature(a: &RentalAgreement) -> AgreementStatus {
        match (a.tenant_signed, a.landlord_signed) {
            (true, true) => AgreementStatus::PendingPayment,
            (true, false) => AgreementStatus::PendingLandlordSign,
            (false, true) => AgreementStatus::PendingTenantSign,
            (false, false) => AgreementStatus::Draft,
        }
    }

    fn index_agreement(env: &Env, a: &RentalAgreement) {
        let mut list: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::AgreementList)
            .unwrap_or(Vec::new(env));
        list.push_back(a.id.clone());
        env.storage()
            .persistent()
            .set(&DataKey::AgreementList, &list);

        let mut by_tenant: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::ByTenant(a.tenant.clone()))
            .unwrap_or(Vec::new(env));
        by_tenant.push_back(a.id.clone());
        env.storage()
            .persistent()
            .set(&DataKey::ByTenant(a.tenant.clone()), &by_tenant);

        let mut by_landlord: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::ByLandlord(a.landlord.clone()))
            .unwrap_or(Vec::new(env));
        by_landlord.push_back(a.id.clone());
        env.storage()
            .persistent()
            .set(&DataKey::ByLandlord(a.landlord.clone()), &by_landlord);

        let mut by_property: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::ByProperty(a.property_id.clone()))
            .unwrap_or(Vec::new(env));
        by_property.push_back(a.id.clone());
        env.storage()
            .persistent()
            .set(&DataKey::ByProperty(a.property_id.clone()), &by_property);
    }

    fn hydrate_agreements(env: &Env, ids: Vec<BytesN<32>>) -> Vec<RentalAgreement> {
        let mut out = Vec::<RentalAgreement>::new(env);
        for id in ids.iter() {
            if let Some(a) = env
                .storage()
                .persistent()
                .get::<_, RentalAgreement>(&DataKey::Agreement(id))
            {
                out.push_back(a);
            }
        }
        out
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
    fn create_and_sign_agreement() {
        let env = Env::default();
        env.mock_all_auths();

        // Register a dummy property registry contract in the test environment.
        // We don't implement it here; this test focuses on local state transitions.
        // In real tests, you would register the PropertyRegistry contract and call create_property.
        // For now, just ensure initialize doesn't panic.
        let contract_id = env.register_contract(None, RentalAgreementContract);
        let client = RentalAgreementContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        client.initialize(&admin, &registry);

        // Can't create agreement without a real registry; this is a placeholder test.
        // Ensures basic wiring compiles.
        client.pause();
        client.unpause();
    }
}
