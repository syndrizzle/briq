#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env, Symbol, Vec,
};

use soroban_sdk::token;

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
    fn mark_deposit_paid(agreement_id: BytesN<32>);
    fn record_rent_payment(agreement_id: BytesN<32>, amount: i128);
}

// -----------------------------
// EscrowManager contract
// -----------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    ContractPaused = 1,
    Unauthorized = 2,
    AlreadyInitialized = 3,

    AgreementNotFound = 300,
    InvalidAgreementState = 301,
    InvalidPaymentAmount = 302,
    DepositAlreadyPaid = 303,
    DepositNotPaid = 304,
    DepositAlreadyReleased = 305,
    AgreementNotCompleted = 306,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PaymentType {
    SecurityDeposit,
    FirstMonthRent,
    MonthlyRent,
    DepositRelease,
    EmergencyWithdrawal,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentRecord {
    pub id: BytesN<32>,
    pub agreement_id: BytesN<32>,
    pub payer: Address,
    pub payee: Address,
    pub amount: i128,
    pub payment_type: PaymentType,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowAccount {
    pub agreement_id: BytesN<32>,
    pub landlord: Address,
    pub tenant: Address,
    pub security_deposit_amount: i128,
    pub security_deposit_held: i128,
    pub monthly_rent_amount: i128,
    pub total_rent_received: i128,
    pub total_rent_released: i128,
    pub is_deposit_released: bool,
    pub deposit_released_at: u64,
    pub created_at: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Paused,
    AgreementContract,
    XlmToken,
    Escrow(BytesN<32>),
    Payments(BytesN<32>),
}

#[contract]
pub struct EscrowManager;

#[contractimpl]
impl EscrowManager {
    pub fn initialize(env: Env, admin: Address, agreement_contract: Address, xlm_token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage()
            .instance()
            .set(&DataKey::AgreementContract, &agreement_contract);
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);

        env.events().publish(
            (Symbol::new(&env, "Initialized"),),
            (
                admin,
                agreement_contract,
                xlm_token,
                env.ledger().timestamp(),
            ),
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

    // Initial payment: security deposit + first month rent.
    // - Transfers total from tenant to escrow contract
    // - Immediately releases first month rent to landlord
    // - Holds security deposit
    // - Notifies rental agreement contract: mark_deposit_paid + record_rent_payment
    pub fn deposit_security_and_rent(env: Env, tenant: Address, agreement_id: BytesN<32>) {
        Self::check_not_paused(&env);

        tenant.require_auth();

        let agreement = Self::fetch_agreement(&env, agreement_id.clone());

        if tenant != agreement.tenant {
            panic_with_error!(&env, Error::Unauthorized);
        }
        if agreement.status != AgreementStatus::PendingPayment {
            panic_with_error!(&env, Error::InvalidAgreementState);
        }
        if agreement.deposit_paid {
            panic_with_error!(&env, Error::DepositAlreadyPaid);
        }

        let total = agreement
            .security_deposit
            .saturating_add(agreement.monthly_rent);
        if total <= 0 {
            panic_with_error!(&env, Error::InvalidPaymentAmount);
        }

        let token_client = Self::xlm_client(&env);
        let contract_addr = env.current_contract_address();

        // Tenant -> Escrow (deposit + rent)
        token_client.transfer(&agreement.tenant, &contract_addr, &total);

        // Escrow -> Landlord (first month rent)
        token_client.transfer(&contract_addr, &agreement.landlord, &agreement.monthly_rent);

        // Store/update escrow state
        let now = env.ledger().timestamp();
        let mut escrow = env
            .storage()
            .persistent()
            .get::<_, EscrowAccount>(&DataKey::Escrow(agreement_id.clone()))
            .unwrap_or(EscrowAccount {
                agreement_id: agreement_id.clone(),
                landlord: agreement.landlord.clone(),
                tenant: agreement.tenant.clone(),
                security_deposit_amount: agreement.security_deposit,
                security_deposit_held: 0,
                monthly_rent_amount: agreement.monthly_rent,
                total_rent_received: 0,
                total_rent_released: 0,
                is_deposit_released: false,
                deposit_released_at: 0,
                created_at: now,
            });

        escrow.security_deposit_amount = agreement.security_deposit;
        escrow.monthly_rent_amount = agreement.monthly_rent;
        escrow.security_deposit_held = escrow
            .security_deposit_held
            .saturating_add(agreement.security_deposit);
        escrow.total_rent_received = escrow
            .total_rent_received
            .saturating_add(agreement.monthly_rent);
        escrow.total_rent_released = escrow
            .total_rent_released
            .saturating_add(agreement.monthly_rent);

        env.storage()
            .persistent()
            .set(&DataKey::Escrow(agreement_id.clone()), &escrow);

        // Record payments
        Self::append_payment(
            &env,
            PaymentRecord {
                id: Self::new_id(&env),
                agreement_id: agreement_id.clone(),
                payer: agreement.tenant.clone(),
                payee: contract_addr.clone(),
                amount: agreement.security_deposit,
                payment_type: PaymentType::SecurityDeposit,
                timestamp: now,
            },
        );
        Self::append_payment(
            &env,
            PaymentRecord {
                id: Self::new_id(&env),
                agreement_id: agreement_id.clone(),
                payer: agreement.tenant.clone(),
                payee: agreement.landlord.clone(),
                amount: agreement.monthly_rent,
                payment_type: PaymentType::FirstMonthRent,
                timestamp: now,
            },
        );

        env.events().publish(
            (Symbol::new(&env, "SecurityDepositReceived"),),
            (
                agreement_id.clone(),
                agreement.tenant.clone(),
                agreement.security_deposit,
            ),
        );
        env.events().publish(
            (Symbol::new(&env, "RentReleasedToLandlord"),),
            (
                agreement_id.clone(),
                agreement.landlord.clone(),
                agreement.monthly_rent,
            ),
        );

        // Notify agreement contract
        let agreement_client = Self::agreement_client(&env);
        agreement_client.mark_deposit_paid(&agreement_id);
        agreement_client.record_rent_payment(&agreement_id, &agreement.monthly_rent);
    }

    // Monthly rent payments (manual, no recurring). Tenant pays contract, contract releases to landlord.
    pub fn pay_rent(env: Env, tenant: Address, agreement_id: BytesN<32>) {
        Self::check_not_paused(&env);

        tenant.require_auth();

        let agreement = Self::fetch_agreement(&env, agreement_id.clone());
        if tenant != agreement.tenant {
            panic_with_error!(&env, Error::Unauthorized);
        }
        if agreement.status != AgreementStatus::Active {
            panic_with_error!(&env, Error::InvalidAgreementState);
        }

        let amount = agreement.monthly_rent;
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidPaymentAmount);
        }

        let token_client = Self::xlm_client(&env);
        let contract_addr = env.current_contract_address();

        // Tenant -> Escrow (rent)
        token_client.transfer(&agreement.tenant, &contract_addr, &amount);
        // Escrow -> Landlord (rent)
        token_client.transfer(&contract_addr, &agreement.landlord, &amount);

        // Update escrow
        let now = env.ledger().timestamp();
        let mut escrow = Self::get_escrow(env.clone(), agreement_id.clone());
        escrow.total_rent_received = escrow.total_rent_received.saturating_add(amount);
        escrow.total_rent_released = escrow.total_rent_released.saturating_add(amount);
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(agreement_id.clone()), &escrow);

        // Record
        Self::append_payment(
            &env,
            PaymentRecord {
                id: Self::new_id(&env),
                agreement_id: agreement_id.clone(),
                payer: agreement.tenant.clone(),
                payee: agreement.landlord.clone(),
                amount,
                payment_type: PaymentType::MonthlyRent,
                timestamp: now,
            },
        );

        env.events().publish(
            (Symbol::new(&env, "RentPaymentReceived"),),
            (agreement_id.clone(), agreement.tenant.clone(), amount),
        );
        env.events().publish(
            (Symbol::new(&env, "RentReleasedToLandlord"),),
            (agreement_id.clone(), agreement.landlord.clone(), amount),
        );

        // Notify agreement contract
        let agreement_client = Self::agreement_client(&env);
        agreement_client.record_rent_payment(&agreement_id, &amount);
    }

    // Release security deposit back to tenant.
    // MVP: only allowed after agreement is completed.
    pub fn release_deposit_to_tenant(env: Env, caller: Address, agreement_id: BytesN<32>) {
        Self::check_not_paused(&env);

        caller.require_auth();

        let agreement = Self::fetch_agreement(&env, agreement_id.clone());
        if caller != agreement.tenant && caller != agreement.landlord {
            panic_with_error!(&env, Error::Unauthorized);
        }
        if agreement.status != AgreementStatus::Completed {
            panic_with_error!(&env, Error::AgreementNotCompleted);
        }

        let mut escrow = Self::get_escrow(env.clone(), agreement_id.clone());
        if escrow.security_deposit_held <= 0 {
            panic_with_error!(&env, Error::DepositNotPaid);
        }
        if escrow.is_deposit_released {
            panic_with_error!(&env, Error::DepositAlreadyReleased);
        }

        let amount = escrow.security_deposit_held;
        let token_client = Self::xlm_client(&env);
        let contract_addr = env.current_contract_address();
        token_client.transfer(&contract_addr, &escrow.tenant, &amount);

        escrow.security_deposit_held = 0;
        escrow.is_deposit_released = true;
        escrow.deposit_released_at = env.ledger().timestamp();
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(agreement_id.clone()), &escrow);

        let now = env.ledger().timestamp();
        Self::append_payment(
            &env,
            PaymentRecord {
                id: Self::new_id(&env),
                agreement_id: agreement_id.clone(),
                payer: contract_addr,
                payee: escrow.tenant.clone(),
                amount,
                payment_type: PaymentType::DepositRelease,
                timestamp: now,
            },
        );

        env.events().publish(
            (Symbol::new(&env, "DepositReleasedToTenant"),),
            (agreement_id, escrow.tenant, amount),
        );
    }

    // Placeholder for future disputes: release part/all deposit to landlord.
    // MVP: not implemented.
    pub fn release_deposit_to_landlord(_env: Env, _agreement_id: BytesN<32>, _amount: i128) {
        // Intentionally left blank for MVP.
        // Future: require both party signatures or dispute resolution.
    }

    pub fn get_escrow(env: Env, agreement_id: BytesN<32>) -> EscrowAccount {
        env.storage()
            .persistent()
            .get(&DataKey::Escrow(agreement_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::AgreementNotFound))
    }

    pub fn get_payment_history(env: Env, agreement_id: BytesN<32>) -> Vec<PaymentRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::Payments(agreement_id))
            .unwrap_or(Vec::<PaymentRecord>::new(&env))
    }

    // Emergency: admin can withdraw any held balance tracked for agreement.
    // This is meant for testnet MVP and should be removed or heavily restricted post-MVP.
    pub fn emergency_withdraw(env: Env, agreement_id: BytesN<32>, to: Address) {
        Self::check_not_paused(&env);

        let admin = Self::require_admin(&env);
        admin.require_auth();

        let mut escrow = Self::get_escrow(env.clone(), agreement_id.clone());
        let amount = escrow.security_deposit_held;
        if amount <= 0 {
            return;
        }

        let token_client = Self::xlm_client(&env);
        let contract_addr = env.current_contract_address();
        token_client.transfer(&contract_addr, &to, &amount);

        escrow.security_deposit_held = 0;
        escrow.is_deposit_released = true;
        escrow.deposit_released_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Escrow(agreement_id.clone()), &escrow);

        let now = env.ledger().timestamp();
        Self::append_payment(
            &env,
            PaymentRecord {
                id: Self::new_id(&env),
                agreement_id: agreement_id.clone(),
                payer: contract_addr,
                payee: to.clone(),
                amount,
                payment_type: PaymentType::EmergencyWithdrawal,
                timestamp: now,
            },
        );

        env.events().publish(
            (Symbol::new(&env, "EmergencyWithdrawal"),),
            (agreement_id, to, amount, admin),
        );
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

    fn agreement_client(env: &Env) -> RentalAgreementClient {
        let addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::AgreementContract)
            .unwrap_or_else(|| panic_with_error!(env, Error::Unauthorized));
        RentalAgreementClient::new(env, &addr)
    }

    fn fetch_agreement(env: &Env, agreement_id: BytesN<32>) -> RentalAgreement {
        Self::agreement_client(env).get_agreement(&agreement_id)
    }

    fn xlm_client(env: &Env) -> token::Client {
        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::XlmToken)
            .unwrap_or_else(|| panic_with_error!(env, Error::Unauthorized));
        token::Client::new(env, &token_addr)
    }

    fn append_payment(env: &Env, rec: PaymentRecord) {
        let key = rec.agreement_id.clone();
        let mut v: Vec<PaymentRecord> = env
            .storage()
            .persistent()
            .get(&DataKey::Payments(key.clone()))
            .unwrap_or(Vec::<PaymentRecord>::new(env));
        v.push_back(rec);
        env.storage().persistent().set(&DataKey::Payments(key), &v);
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

        let contract_id = env.register_contract(None, EscrowManager);
        let client = EscrowManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let agreement_contract = Address::generate(&env);
        let xlm_token = Address::generate(&env);

        client.initialize(&admin, &agreement_contract, &xlm_token);
        client.pause();
        client.unpause();
    }
}
