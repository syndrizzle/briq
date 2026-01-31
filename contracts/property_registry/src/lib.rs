#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, panic_with_error, Address, BytesN, Env, String, Symbol,
    Vec,
};

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    ContractPaused = 1,
    Unauthorized = 2,
    AlreadyInitialized = 3,

    InvalidTitle = 100,
    InvalidDescription = 101,
    InvalidLocation = 102,
    InvalidPrice = 103,
    InvalidMinStay = 104,
    InvalidMaxStay = 105,
    PropertyNotFound = 106,
}

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

#[contracttype]
pub enum DataKey {
    Admin,
    Paused,
    Property(BytesN<32>),
    PropertyList,
    OwnerIndex(Address),
}

#[contract]
pub struct PropertyRegistry;

#[contractimpl]
impl PropertyRegistry {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }

        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().persistent().set(&DataKey::PropertyList, &Vec::<BytesN<32>>::new(&env));

        env.events().publish(
            (Symbol::new(&env, "Initialized"),),
            (admin, env.ledger().timestamp()),
        );
    }

    pub fn pause(env: Env) {
        let admin = Self::require_admin(&env);
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish((Symbol::new(&env, "Paused"),), env.ledger().timestamp());
    }

    pub fn unpause(env: Env) {
        let admin = Self::require_admin(&env);
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &false);
        env.events()
            .publish((Symbol::new(&env, "Unpaused"),), env.ledger().timestamp());
    }

    pub fn create_property(
        env: Env,
        title: String,
        description: String,
        location: String,
        price_per_month: i128,
        security_deposit: i128,
        min_stay_days: u32,
        max_stay_days: u32,
        image_url: String,
    ) -> BytesN<32> {
        Self::check_not_paused(&env);

        let owner = env.invoker();
        owner.require_auth();

        Self::validate_property_fields(
            &env,
            &title,
            &description,
            &location,
            price_per_month,
            security_deposit,
            min_stay_days,
            max_stay_days,
        );

        let id = Self::new_id(&env);
        let now = env.ledger().timestamp();

        let property = Property {
            id: id.clone(),
            owner: owner.clone(),
            title,
            description,
            location,
            price_per_month,
            security_deposit,
            min_stay_days,
            max_stay_days,
            image_url,
            is_available: true,
            is_active: true,
            created_at: now,
            updated_at: now,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Property(id.clone()), &property);

        let mut list = Self::property_list(&env);
        list.push_back(id.clone());
        env.storage().persistent().set(&DataKey::PropertyList, &list);

        let mut owner_list = Self::owner_index(&env, &owner);
        owner_list.push_back(id.clone());
        env.storage()
            .persistent()
            .set(&DataKey::OwnerIndex(owner.clone()), &owner_list);

        env.events().publish(
            (Symbol::new(&env, "PropertyCreated"),),
            (id.clone(), owner, price_per_month, security_deposit),
        );

        id
    }

    pub fn update_property(
        env: Env,
        property_id: BytesN<32>,
        title: String,
        description: String,
        location: String,
        price_per_month: i128,
        security_deposit: i128,
        min_stay_days: u32,
        max_stay_days: u32,
        image_url: String,
    ) {
        Self::check_not_paused(&env);

        let mut property = Self::get_property(env.clone(), property_id.clone());
        property.owner.require_auth();

        Self::validate_property_fields(
            &env,
            &title,
            &description,
            &location,
            price_per_month,
            security_deposit,
            min_stay_days,
            max_stay_days,
        );

        property.title = title;
        property.description = description;
        property.location = location;
        property.price_per_month = price_per_month;
        property.security_deposit = security_deposit;
        property.min_stay_days = min_stay_days;
        property.max_stay_days = max_stay_days;
        property.image_url = image_url;
        property.updated_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Property(property_id.clone()), &property);

        env.events().publish(
            (Symbol::new(&env, "PropertyUpdated"),),
            (property_id, property.updated_at),
        );
    }

    pub fn set_availability(env: Env, property_id: BytesN<32>, is_available: bool) {
        Self::check_not_paused(&env);

        let mut property = Self::get_property(env.clone(), property_id.clone());
        property.owner.require_auth();

        property.is_available = is_available;
        property.updated_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Property(property_id.clone()), &property);

        env.events().publish(
            (Symbol::new(&env, "PropertyAvailabilityChanged"),),
            (property_id, is_available),
        );
    }

    pub fn deactivate_property(env: Env, property_id: BytesN<32>) {
        Self::check_not_paused(&env);

        let mut property = Self::get_property(env.clone(), property_id.clone());
        property.owner.require_auth();

        property.is_active = false;
        property.is_available = false;
        property.updated_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Property(property_id.clone()), &property);

        env.events().publish(
            (Symbol::new(&env, "PropertyDeactivated"),),
            (property_id, property.updated_at),
        );
    }

    pub fn get_property(env: Env, property_id: BytesN<32>) -> Property {
        env.storage()
            .persistent()
            .get(&DataKey::Property(property_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::PropertyNotFound))
    }

    pub fn get_properties_by_owner(env: Env, owner: Address) -> Vec<Property> {
        let ids = Self::owner_index(&env, &owner);
        let mut out = Vec::<Property>::new(&env);

        for id in ids.iter() {
            if let Some(p) = env.storage().persistent().get::<_, Property>(&DataKey::Property(id)) {
                out.push_back(p);
            }
        }

        out
    }

    pub fn get_available_properties(env: Env) -> Vec<Property> {
        let ids = Self::property_list(&env);
        let mut out = Vec::<Property>::new(&env);

        for id in ids.iter() {
            if let Some(p) = env.storage().persistent().get::<_, Property>(&DataKey::Property(id)) {
                if p.is_active && p.is_available {
                    out.push_back(p);
                }
            }
        }

        out
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

    fn property_list(env: &Env) -> Vec<BytesN<32>> {
        env.storage()
            .persistent()
            .get(&DataKey::PropertyList)
            .unwrap_or(Vec::<BytesN<32>>::new(env))
    }

    fn owner_index(env: &Env, owner: &Address) -> Vec<BytesN<32>> {
        env.storage()
            .persistent()
            .get(&DataKey::OwnerIndex(owner.clone()))
            .unwrap_or(Vec::<BytesN<32>>::new(env))
    }

    fn validate_property_fields(
        env: &Env,
        title: &String,
        description: &String,
        location: &String,
        price_per_month: i128,
        security_deposit: i128,
        min_stay_days: u32,
        max_stay_days: u32,
    ) {
        let title_len = title.len();
        if title_len == 0 || title_len > 100 {
            panic_with_error!(env, Error::InvalidTitle);
        }

        if description.len() > 1000 {
            panic_with_error!(env, Error::InvalidDescription);
        }

        let loc_len = location.len();
        if loc_len == 0 || loc_len > 200 {
            panic_with_error!(env, Error::InvalidLocation);
        }

        if price_per_month <= 0 {
            panic_with_error!(env, Error::InvalidPrice);
        }

        if security_deposit < 0 {
            panic_with_error!(env, Error::InvalidPrice);
        }

        if min_stay_days < 30 {
            panic_with_error!(env, Error::InvalidMinStay);
        }

        if max_stay_days < min_stay_days {
            panic_with_error!(env, Error::InvalidMaxStay);
        }
    }

    fn new_id(env: &Env) -> BytesN<32> {
        // Random, collision-resistant ID generation; suitable for testnet MVP.
        // On-chain IDs are returned as BytesN<32>.
        env.prng().gen::<BytesN<32>>()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn initialize_and_create_property() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PropertyRegistry);
        let client = PropertyRegistryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        let owner = Address::generate(&env);
        let title = String::from_str(&env, "Cozy Apartment");
        let desc = String::from_str(&env, "A nice place to stay");
        let loc = String::from_str(&env, "NYC");
        let img = String::from_str(&env, "");

        env.mock_all_auths();
        let id = client.create_property(
            &title,
            &desc,
            &loc,
            &1_000_0000,
            &500_0000,
            &30,
            &365,
            &img,
        );

        let p = client.get_property(&id);
        assert_eq!(p.title, title);
        assert_eq!(p.location, loc);
        assert!(p.is_available);
        assert!(p.is_active);
    }
}
