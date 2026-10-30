extern crate std;
use super::*;
use soroban_sdk::{testutils::Address as _, token, Error};

fn setup() -> (Env, Address, Address, Address) {
 let e=Env::default();e.mock_all_auths();e.cost_estimate().budget().reset_unlimited();
 let admin=Address::generate(&e);let token=e.register_stellar_asset_contract_v2(admin.clone()).address();
 let id=e.register(Zer0Pool,());Zer0PoolClient::new(&e,&id).initialize(&admin,&10,&token);
 (e,id,admin,token)
}
fn bytes<const N:usize>(e:&Env,s:&str)->BytesN<N>{
 let mut out=[0u8;N];for(i,b)in out.iter_mut().enumerate(){*b=u8::from_str_radix(&s[i*2..i*2+2],16).unwrap()}BytesN::from_array(e,&out)
}
fn fixture()->serde_json::Value{serde_json::from_str(include_str!("../test-fixtures/legacy-withdraw.json")).unwrap()}
fn proof(e:&Env,v:&serde_json::Value)->Groth16Proof{Groth16Proof{a:bytes(e,v["a"].as_str().unwrap()),b:bytes(e,v["b"].as_str().unwrap()),c:bytes(e,v["c"].as_str().unwrap())}}
#[test]
fn initialized_state_and_duplicate_initialization(){
 let(e,id,admin,token)=setup();let c=Zer0PoolClient::new(&e,&id);
 assert_eq!(c.get_denomination(),10);assert_eq!(c.get_token(),token);assert_eq!(c.get_commitment_count(),0);assert_eq!(c.get_commitment(&0),None);
 assert_eq!(c.try_initialize(&admin,&20,&token),Err(Ok(PoolError::AlreadyInitialized)));
}
#[test]
fn deposit_maintains_commitment_index_and_root(){
 let(e,id,_,_)=setup();let c=Zer0PoolClient::new(&e,&id);let v=fixture();let commitment=bytes(&e,v["commitment"].as_str().unwrap());
 assert_eq!(c.deposit(&Address::generate(&e),&commitment),0);assert_eq!(c.get_commitment_count(),1);assert_eq!(c.get_commitment(&0),Some(commitment));assert_eq!(c.get_root(),bytes::<32>(&e,v["root"].as_str().unwrap()));
}
#[test]
fn full_tree_rejects_deposit_without_state_change(){
 let(e,id,_,_)=setup();let c=Zer0PoolClient::new(&e,&id);e.as_contract(&id,||e.storage().instance().set(&DataKey::CommitmentCount,&1_000_000u32));
 assert_eq!(c.try_deposit(&Address::generate(&e),&BytesN::from_array(&e,&[1;32])),Err(Ok(PoolError::MerkleTreeFull)));assert_eq!(c.get_commitment_count(),1_000_000);
}
#[test]
fn wrong_root_rejects_withdraw_and_keeps_nullifier_unspent(){
 let(e,id,_,token)=setup();let c=Zer0PoolClient::new(&e,&id);let v=fixture();let n=bytes(&e,v["nullifier"].as_str().unwrap());let recipient=Address::generate(&e);
 assert_eq!(c.try_withdraw(&recipient,&proof(&e,&v),&n,&BytesN::from_array(&e,&[0;32])),Err(Ok(PoolError::InvalidRoot)));assert!(!c.is_nullifier_spent(&n));assert_eq!(token::Client::new(&e,&token).balance(&recipient),0);
}
// Security regression evidence for the legacy circuit/contract. The console must
// keep NEW FUNDING disabled until an upgraded pool fixes both properties below.
#[test]
fn legacy_security_reproduction_unfunded_note_can_spend_prefunded_pool_to_arbitrary_recipient(){
 let(e,id,admin,token)=setup();let c=Zer0PoolClient::new(&e,&id);let v=fixture();let depositor=Address::generate(&e);let recipient=Address::generate(&e);
 token::StellarAssetClient::new(&e,&token).mint(&id,&100);
 assert_eq!(token::Client::new(&e,&token).balance(&depositor),0);
 c.deposit(&depositor,&bytes(&e,v["commitment"].as_str().unwrap()));
 let n=bytes(&e,v["nullifier"].as_str().unwrap());c.withdraw(&recipient,&proof(&e,&v),&n,&c.get_root());
 assert_eq!(token::Client::new(&e,&token).balance(&recipient),10);assert!(c.is_nullifier_spent(&n));
 assert!(e.auths().iter().all(|(address,_)|address!=&recipient));
 assert_eq!(c.try_withdraw(&admin,&proof(&e,&v),&n,&c.get_root()),Err(Ok(PoolError::NullifierSpent)));
}
