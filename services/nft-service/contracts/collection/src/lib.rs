#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, Env, String,
};
use stellar_tokens::non_fungible::{Base, NFTStorageKey};

const MAX_ROYALTY_BPS: u32 = 1_000;
/// Keep instance storage live: threshold ~120 ledgers/day * 120 days, extend to ~180 days.
/// (Stellar storage is rented; without bumps, collection config can archive.)
const INSTANCE_TTL_THRESHOLD: u32 = 120 * 17_280;
const INSTANCE_TTL_EXTEND_TO: u32 = 180 * 17_280;

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Owner,
    Minter(Address),
    SaleConfig,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SaleConfig {
    pub payment_token: Address,
    pub price: i128,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CollectionError {
    OwnerOnly = 1,
    UnauthorizedMinter = 2,
    DuplicateToken = 3,
    InvalidRoyalty = 4,
    InvalidPrice = 5,
    SaleDisabled = 6,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MinterUpdated {
    #[topic]
    pub minter: Address,
    pub enabled: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PrimaryPurchase {
    #[topic]
    pub buyer: Address,
    #[topic]
    pub token_id: u32,
    pub price: i128,
}

#[contract]
pub struct NftCollectionContract;

#[contractimpl]
impl NftCollectionContract {
    pub fn __constructor(
        e: Env,
        owner: Address,
        name: String,
        symbol: String,
        base_uri: String,
        royalty_receiver: Address,
        royalty_bps: u32,
    ) {
        validate_royalty(&e, royalty_bps);
        Base::set_metadata(&e, base_uri, name, symbol);
        Base::set_default_royalty(&e, &royalty_receiver, royalty_bps);
        e.storage().instance().set(&DataKey::Owner, &owner);
        e.storage()
            .instance()
            .set(&DataKey::Minter(owner.clone()), &true);
    }

    pub fn owner(e: Env) -> Address {
        read_owner(&e)
    }

    pub fn transfer_ownership(e: Env, operator: Address, new_owner: Address) {
        require_owner(&e, &operator);
        e.storage()
            .instance()
            .remove(&DataKey::Minter(operator.clone()));
        e.storage().instance().set(&DataKey::Owner, &new_owner);
        e.storage()
            .instance()
            .set(&DataKey::Minter(new_owner), &true);
    }

    pub fn set_minter(e: Env, operator: Address, minter: Address, enabled: bool) {
        require_owner(&e, &operator);
        e.storage()
            .instance()
            .set(&DataKey::Minter(minter.clone()), &enabled);
        MinterUpdated { minter, enabled }.publish(&e);
    }

    pub fn is_minter(e: Env, account: Address) -> bool {
        e.storage()
            .instance()
            .get(&DataKey::Minter(account))
            .unwrap_or(false)
    }

    pub fn mint(e: Env, operator: Address, to: Address, token_id: u32) {
        require_minter(&e, &operator);
        ensure_token_available(&e, token_id);
        Base::mint(&e, &to, token_id);
        bump_instance(&e);
    }

    pub fn balance(e: Env, account: Address) -> u32 {
        Base::balance(&e, &account)
    }

    pub fn owner_of(e: Env, token_id: u32) -> Address {
        Base::owner_of(&e, token_id)
    }

    pub fn transfer(e: Env, from: Address, to: Address, token_id: u32) {
        Base::transfer(&e, &from, &to, token_id);
    }

    pub fn transfer_from(e: Env, spender: Address, from: Address, to: Address, token_id: u32) {
        Base::transfer_from(&e, &spender, &from, &to, token_id);
    }

    pub fn approve(
        e: Env,
        approver: Address,
        approved: Address,
        token_id: u32,
        live_until_ledger: u32,
    ) {
        Base::approve(&e, &approver, &approved, token_id, live_until_ledger);
    }

    pub fn approve_for_all(e: Env, owner: Address, operator: Address, live_until_ledger: u32) {
        Base::approve_for_all(&e, &owner, &operator, live_until_ledger);
    }

    pub fn get_approved(e: Env, token_id: u32) -> Option<Address> {
        Base::get_approved(&e, token_id)
    }

    pub fn is_approved_for_all(e: Env, owner: Address, operator: Address) -> bool {
        Base::is_approved_for_all(&e, &owner, &operator)
    }

    pub fn name(e: Env) -> String {
        Base::name(&e)
    }

    pub fn symbol(e: Env) -> String {
        Base::symbol(&e)
    }

    pub fn token_uri(e: Env, token_id: u32) -> String {
        Base::token_uri(&e, token_id)
    }

    pub fn burn(e: Env, from: Address, token_id: u32) {
        Base::burn(&e, &from, token_id);
    }

    pub fn burn_from(e: Env, spender: Address, from: Address, token_id: u32) {
        Base::burn_from(&e, &spender, &from, token_id);
    }

    pub fn set_default_royalty(e: Env, receiver: Address, basis_points: u32, operator: Address) {
        require_owner(&e, &operator);
        validate_royalty(&e, basis_points);
        Base::set_default_royalty(&e, &receiver, basis_points);
    }

    pub fn set_token_royalty(
        e: Env,
        token_id: u32,
        receiver: Address,
        basis_points: u32,
        operator: Address,
    ) {
        require_owner(&e, &operator);
        validate_royalty(&e, basis_points);
        Base::set_token_royalty(&e, token_id, &receiver, basis_points);
    }

    pub fn remove_token_royalty(e: Env, token_id: u32, operator: Address) {
        require_owner(&e, &operator);
        Base::remove_token_royalty(&e, token_id);
    }

    pub fn royalty_info(e: Env, token_id: u32, sale_price: i128) -> (Address, i128) {
        Base::royalty_info(&e, token_id, sale_price)
    }

    pub fn set_sale_config(e: Env, operator: Address, payment_token: Address, price: i128) {
        require_owner(&e, &operator);
        if price <= 0 {
            panic_with_error!(&e, CollectionError::InvalidPrice);
        }
        e.storage().instance().set(
            &DataKey::SaleConfig,
            &SaleConfig {
                payment_token,
                price,
            },
        );
        bump_instance(&e);
    }

    pub fn disable_sale(e: Env, operator: Address) {
        require_owner(&e, &operator);
        e.storage().instance().remove(&DataKey::SaleConfig);
        bump_instance(&e);
    }

    pub fn sale_config(e: Env) -> Option<SaleConfig> {
        e.storage().instance().get(&DataKey::SaleConfig)
    }

    pub fn purchase(e: Env, buyer: Address, token_id: u32) {
        buyer.require_auth();
        ensure_token_available(&e, token_id);
        let config: SaleConfig = e
            .storage()
            .instance()
            .get(&DataKey::SaleConfig)
            .unwrap_or_else(|| panic_with_error!(&e, CollectionError::SaleDisabled));
        let treasury = read_owner(&e);

        token::Client::new(&e, &config.payment_token).transfer(&buyer, &treasury, &config.price);
        Base::mint(&e, &buyer, token_id);
        PrimaryPurchase {
            buyer,
            token_id,
            price: config.price,
        }
        .publish(&e);
        bump_instance(&e);
    }
}

fn read_owner(e: &Env) -> Address {
    e.storage()
        .instance()
        .get(&DataKey::Owner)
        .expect("owner is initialized")
}

fn require_owner(e: &Env, operator: &Address) {
    if *operator != read_owner(e) {
        panic_with_error!(e, CollectionError::OwnerOnly);
    }
    operator.require_auth();
}

fn require_minter(e: &Env, operator: &Address) {
    operator.require_auth();
    let enabled = e
        .storage()
        .instance()
        .get(&DataKey::Minter(operator.clone()))
        .unwrap_or(false);
    if !enabled {
        panic_with_error!(e, CollectionError::UnauthorizedMinter);
    }
}

fn ensure_token_available(e: &Env, token_id: u32) {
    if e.storage()
        .persistent()
        .has(&NFTStorageKey::Owner(token_id))
    {
        panic_with_error!(e, CollectionError::DuplicateToken);
    }
}

fn validate_royalty(e: &Env, basis_points: u32) {
    if basis_points > MAX_ROYALTY_BPS {
        panic_with_error!(e, CollectionError::InvalidRoyalty);
    }
}

fn bump_instance(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

#[cfg(test)]
mod test;
