extern crate std;

use super::{CollectionError, NftCollectionContract, NftCollectionContractClient};
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    token, Address, Env, Error, IntoVal, String,
};

fn register_collection<'a>(
    e: &'a Env,
    owner: &Address,
    royalty_receiver: &Address,
    royalty_bps: u32,
) -> NftCollectionContractClient<'a> {
    let contract = e.register(
        NftCollectionContract,
        (
            owner,
            String::from_str(e, "Astral Gear"),
            String::from_str(e, "GEAR"),
            String::from_str(e, "ipfs://bafy-collection/"),
            royalty_receiver,
            royalty_bps,
        ),
    );
    NftCollectionContractClient::new(e, &contract)
}

#[test]
fn constructor_and_creator_mint_work() {
    let e = Env::default();
    e.mock_all_auths();
    let owner = Address::generate(&e);
    let player = Address::generate(&e);
    let client = register_collection(&e, &owner, &owner, 500);

    client.mint(&owner, &player, &7);

    assert_eq!(client.owner(), owner);
    assert_eq!(client.owner_of(&7), player);
    assert_eq!(client.name(), String::from_str(&e, "Astral Gear"));
    assert_eq!(client.symbol(), String::from_str(&e, "GEAR"));
    assert_eq!(
        client.token_uri(&7),
        String::from_str(&e, "ipfs://bafy-collection/7")
    );
    let (receiver, amount) = client.royalty_info(&7, &10_000);
    assert_eq!(receiver, owner);
    assert_eq!(amount, 500);
}

#[test]
fn owner_can_delegate_minting() {
    let e = Env::default();
    e.mock_all_auths();
    let owner = Address::generate(&e);
    let minter = Address::generate(&e);
    let player = Address::generate(&e);
    let client = register_collection(&e, &owner, &owner, 0);

    client.set_minter(&owner, &minter, &true);
    client.mint(&minter, &player, &1);

    assert!(client.is_minter(&minter));
    assert_eq!(client.owner_of(&1), player);
}

#[test]
fn ownership_transfer_revokes_the_previous_owners_implicit_minter_role() {
    let e = Env::default();
    e.mock_all_auths();
    let owner = Address::generate(&e);
    let new_owner = Address::generate(&e);
    let player = Address::generate(&e);
    let client = register_collection(&e, &owner, &owner, 0);

    client.transfer_ownership(&owner, &new_owner);

    assert!(!client.is_minter(&owner));
    assert!(client.is_minter(&new_owner));
    assert_eq!(
        client.try_mint(&owner, &player, &1),
        Err(Ok(Error::from_contract_error(
            CollectionError::UnauthorizedMinter as u32
        )))
    );
    client.mint(&new_owner, &player, &1);
    assert_eq!(client.owner_of(&1), player);
}

#[test]
fn unauthorized_minter_is_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let owner = Address::generate(&e);
    let stranger = Address::generate(&e);
    let player = Address::generate(&e);
    let client = register_collection(&e, &owner, &owner, 0);

    assert_eq!(
        client.try_mint(&stranger, &player, &1),
        Err(Ok(Error::from_contract_error(
            CollectionError::UnauthorizedMinter as u32
        )))
    );
}

#[test]
fn duplicate_token_is_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let owner = Address::generate(&e);
    let player = Address::generate(&e);
    let client = register_collection(&e, &owner, &owner, 0);

    client.mint(&owner, &player, &42);
    assert_eq!(
        client.try_mint(&owner, &player, &42),
        Err(Ok(Error::from_contract_error(
            CollectionError::DuplicateToken as u32
        )))
    );
}

#[test]
fn transfers_and_burns_use_standard_nft_rules() {
    let e = Env::default();
    e.mock_all_auths();
    let owner = Address::generate(&e);
    let player = Address::generate(&e);
    let recipient = Address::generate(&e);
    let client = register_collection(&e, &owner, &owner, 0);

    client.mint(&owner, &player, &1);
    client.transfer(&player, &recipient, &1);
    assert_eq!(client.owner_of(&1), recipient);
    client.burn(&recipient, &1);
    assert_eq!(client.balance(&recipient), 0);
}

#[test]
fn purchase_transfers_usdc_and_mints_atomically() {
    let e = Env::default();
    e.mock_all_auths();
    let asset_admin = Address::generate(&e);
    let asset = e.register_stellar_asset_contract_v2(asset_admin.clone());
    let token_client = token::Client::new(&e, &asset.address());
    let token_admin = token::StellarAssetClient::new(&e, &asset.address());
    let owner = Address::generate(&e);
    let buyer = Address::generate(&e);
    let client = register_collection(&e, &owner, &owner, 500);
    token_admin.mint(&buyer, &1_000_000);

    client.set_sale_config(&owner, &asset.address(), &250_000);
    client.purchase(&buyer, &9);

    assert_eq!(client.owner_of(&9), buyer);
    assert_eq!(token_client.balance(&buyer), 750_000);
    assert_eq!(token_client.balance(&owner), 250_000);
}

#[test]
fn failed_usdc_payment_does_not_mint_the_item() {
    let e = Env::default();
    e.mock_all_auths();
    let asset_admin = Address::generate(&e);
    let asset = e.register_stellar_asset_contract_v2(asset_admin);
    let token_client = token::Client::new(&e, &asset.address());
    let owner = Address::generate(&e);
    let buyer = Address::generate(&e);
    let client = register_collection(&e, &owner, &owner, 0);

    client.set_sale_config(&owner, &asset.address(), &250_000);

    assert!(client.try_purchase(&buyer, &9).is_err());
    assert!(client.try_owner_of(&9).is_err());
    assert_eq!(token_client.balance(&buyer), 0);
    assert_eq!(token_client.balance(&owner), 0);
}

#[test]
fn real_auth_is_required_for_creator_mint() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let player = Address::generate(&e);
    let client = register_collection(&e, &owner, &owner, 0);

    client
        .mock_auths(&[MockAuth {
            address: &owner,
            invoke: &MockAuthInvoke {
                contract: &client.address,
                fn_name: "mint",
                args: (&owner, &player, 1_u32).into_val(&e),
                sub_invokes: &[],
            },
        }])
        .mint(&owner, &player, &1);

    assert_eq!(client.owner_of(&1), player);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn royalties_above_ten_percent_are_rejected() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let _ = register_collection(&e, &owner, &owner, 1_001);
}
