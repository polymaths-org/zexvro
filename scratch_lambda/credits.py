"""
Zexvro platform credits (ZCR).

- Balance is per workspace.
- Consume burns only when workspace environment is mainnet.
- Testnet: ledger type consume_skipped, balance unchanged.
- Top-up via NFT checkout (internal) and promo redeem / admin grant.
"""
from __future__ import annotations

import os
import secrets
import string
import time
import uuid
from decimal import Decimal
from typing import Any, Callable, Optional


def _to_ddb(value):
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {k: _to_ddb(v) for k, v in value.items() if v is not None}
    if isinstance(value, list):
        return [_to_ddb(v) for v in value]
    return value


def _int(value, default=0) -> int:
    try:
        if isinstance(value, Decimal):
            return int(value)
        return int(value)
    except (TypeError, ValueError):
        return default


DEFAULT_STARTER_ZCR = int(os.environ.get("CREDITS_STARTER_GRANT") or "100")
DEFAULT_RATE_CARD = {
    "nft.collection_deploy": 50,
    "nft.mint_batch": 5,
    "morph.run": 10,
    "depin.request": 1,
    "zer0.prove": 20,
    "platform.premium": 1,
}


class CreditsService:
    def __init__(
        self,
        credits_table,
        ledger_table,
        promo_table,
        redemption_table,
        *,
        get_workspace_env: Callable[[str], str],
        append_audit: Optional[Callable[..., Any]] = None,
        starter_grant: int = DEFAULT_STARTER_ZCR,
        rate_card: Optional[dict] = None,
    ):
        self.credits_table = credits_table
        self.ledger_table = ledger_table
        self.promo_table = promo_table
        self.redemption_table = redemption_table
        self.get_workspace_env = get_workspace_env
        self.append_audit = append_audit
        self.starter_grant = max(0, int(starter_grant))
        self.rate_card = dict(rate_card or DEFAULT_RATE_CARD)

    def _audit(self, workspace_id, action, **kwargs):
        if not self.append_audit:
            return
        try:
            self.append_audit(workspace_id, action=action, **kwargs)
        except Exception as exc:
            print(f"[credits.audit] {exc}")

    def ensure_balance_row(self, workspace_id: str, *, actor_id: str = "system") -> dict:
        ws = (workspace_id or "").strip()
        if not ws:
            raise ValueError("workspaceId required")
        res = self.credits_table.get_item(Key={"workspaceId": ws})
        item = res.get("Item")
        if item:
            return self._public_balance(item)
        now = int(time.time() * 1000)
        starter = self.starter_grant
        row = {
            "workspaceId": ws,
            "balance": starter,
            "currency": "ZCR",
            "updatedAt": now,
            "createdAt": now,
        }
        try:
            self.credits_table.put_item(
                Item=_to_ddb(row),
                ConditionExpression="attribute_not_exists(workspaceId)",
            )
            if starter > 0:
                self._write_ledger(
                    ws,
                    tx_type="grant",
                    amount=starter,
                    balance_after=starter,
                    reason="starter_grant",
                    service="platform",
                    action="workspace.bootstrap",
                    environment=self.get_workspace_env(ws),
                    actor_id=actor_id,
                    ref=f"starter:{ws}",
                )
                self._audit(
                    ws,
                    "credits.grant",
                    actor_id=actor_id,
                    target=ws,
                    meta={"amount": starter, "reason": "starter_grant"},
                )
        except Exception as exc:
            # race: re-read
            print(f"[credits.ensure] put race/err: {exc}")
            item = self.credits_table.get_item(Key={"workspaceId": ws}).get("Item")
            if item:
                return self._public_balance(item)
            raise
        return self._public_balance(row)

    def _public_balance(self, item: dict) -> dict:
        return {
            "workspaceId": item.get("workspaceId"),
            "balance": _int(item.get("balance"), 0),
            "currency": item.get("currency") or "ZCR",
            "updatedAt": _int(item.get("updatedAt"), 0),
        }

    def get_balance(self, workspace_id: str) -> dict:
        return self.ensure_balance_row(workspace_id)

    def _write_ledger(
        self,
        workspace_id: str,
        *,
        tx_type: str,
        amount: int,
        balance_after: int,
        reason: str = "",
        service: str = "platform",
        action: str = "",
        environment: str = "testnet",
        actor_id: str = "",
        actor_email: str = "",
        ref: str = "",
        meta: Optional[dict] = None,
    ) -> dict:
        now = int(time.time() * 1000)
        tx_id = str(uuid.uuid4())
        sk = f"{now:013d}#{tx_id}"
        row = {
            "workspaceId": workspace_id,
            "sk": sk,
            "txId": tx_id,
            "type": tx_type,
            "amount": int(amount),
            "balanceAfter": int(balance_after),
            "reason": (reason or "")[:256],
            "service": (service or "platform")[:64],
            "action": (action or "")[:128],
            "environment": environment if environment in ("testnet", "mainnet") else "testnet",
            "actorId": (actor_id or "")[:128],
            "actorEmail": (actor_email or "").strip().lower()[:256],
            "ref": (ref or "")[:256],
            "meta": meta or {},
            "createdAt": now,
        }
        self.ledger_table.put_item(Item=_to_ddb(row))
        return {
            "id": tx_id,
            "sk": sk,
            "workspaceId": workspace_id,
            "type": tx_type,
            "amount": int(amount),
            "balanceAfter": int(balance_after),
            "reason": row["reason"],
            "service": row["service"],
            "action": row["action"],
            "environment": row["environment"],
            "actorId": row["actorId"],
            "actorEmail": row["actorEmail"],
            "ref": row["ref"],
            "meta": row["meta"],
            "createdAt": now,
        }

    def find_by_ref(self, workspace_id: str, ref: str) -> Optional[dict]:
        if not ref:
            return None
        # Query recent ledger rows for this workspace (v1; OK for low volume)
        try:
            events, _ = self.list_ledger(workspace_id, limit=100)
            for item in events:
                if (item.get("ref") or "") == ref:
                    return item
        except Exception as exc:
            print(f"[credits.find_by_ref] {exc}")
        return None

    def list_ledger(self, workspace_id: str, *, limit: int = 50, cursor: str = None) -> tuple:
        ws = (workspace_id or "").strip()
        limit = max(1, min(int(limit or 50), 100))
        # Lazy import so unit tests without boto3 can still exercise grant/consume
        # when list_ledger is mocked; production Lambda always has boto3.
        try:
            from boto3.dynamodb.conditions import Key as DKey
        except ImportError:
            return [], None
        kwargs = {
            "KeyConditionExpression": DKey("workspaceId").eq(ws),
            "ScanIndexForward": False,
            "Limit": limit,
        }
        if cursor:
            kwargs["ExclusiveStartKey"] = {"workspaceId": ws, "sk": cursor}
        res = self.ledger_table.query(**kwargs)
        events = []
        for item in res.get("Items") or []:
            events.append({
                "id": item.get("txId") or "",
                "sk": item.get("sk"),
                "type": item.get("type"),
                "amount": _int(item.get("amount")),
                "balanceAfter": _int(item.get("balanceAfter")),
                "reason": item.get("reason") or "",
                "service": item.get("service") or "",
                "action": item.get("action") or "",
                "environment": item.get("environment") or "testnet",
                "actorId": item.get("actorId") or "",
                "actorEmail": item.get("actorEmail") or "",
                "ref": item.get("ref") or "",
                "meta": item.get("meta") or {},
                "createdAt": _int(item.get("createdAt")),
            })
        next_cursor = None
        lek = res.get("LastEvaluatedKey")
        if lek and lek.get("sk"):
            next_cursor = lek["sk"]
        return events, next_cursor

    def grant(
        self,
        workspace_id: str,
        amount: int,
        *,
        reason: str = "admin_grant",
        actor_id: str = "",
        actor_email: str = "",
        ref: str = "",
        meta: Optional[dict] = None,
        tx_type: str = "grant",
    ) -> dict:
        amount = int(amount)
        if amount <= 0:
            raise ValueError("amount must be positive")
        ws = (workspace_id or "").strip()
        if ref:
            existing = self.find_by_ref(ws, ref)
            if existing:
                bal = self.get_balance(ws)
                return {"balance": bal, "tx": existing, "idempotent": True}

        self.ensure_balance_row(ws, actor_id=actor_id or "system")
        # atomic-ish update
        res = self.credits_table.update_item(
            Key={"workspaceId": ws},
            UpdateExpression="SET balance = if_not_exists(balance, :z) + :a, updatedAt = :t, currency = :c",
            ExpressionAttributeValues={
                ":a": amount,
                ":z": 0,
                ":t": int(time.time() * 1000),
                ":c": "ZCR",
            },
            ReturnValues="ALL_NEW",
        )
        bal_after = _int(res["Attributes"].get("balance"), 0)
        env = self.get_workspace_env(ws)
        tx = self._write_ledger(
            ws,
            tx_type=tx_type,
            amount=amount,
            balance_after=bal_after,
            reason=reason,
            service="platform",
            action=tx_type,
            environment=env,
            actor_id=actor_id,
            actor_email=actor_email,
            ref=ref or f"{tx_type}:{uuid.uuid4()}",
            meta=meta,
        )
        self._audit(
            ws,
            f"credits.{tx_type}" if tx_type in ("grant", "topup", "promo") else "credits.grant",
            actor_id=actor_id,
            actor_email=actor_email,
            target=ws,
            meta={"amount": amount, "reason": reason, "balanceAfter": bal_after},
        )
        return {
            "balance": self._public_balance(res["Attributes"]),
            "tx": tx,
            "idempotent": False,
        }

    def consume(
        self,
        workspace_id: str,
        *,
        service: str,
        action: str,
        amount: Optional[int] = None,
        ref: str = "",
        actor_id: str = "",
        actor_email: str = "",
        meta: Optional[dict] = None,
    ) -> dict:
        ws = (workspace_id or "").strip()
        env = self.get_workspace_env(ws)
        cost_key = f"{service}.{action}" if action and not action.startswith(service) else (action or service)
        # rate lookup
        if amount is None:
            cost = int(self.rate_card.get(cost_key) or self.rate_card.get(f"{service}.{action}") or self.rate_card.get(service) or 1)
        else:
            cost = int(amount)
        if cost < 0:
            raise ValueError("amount invalid")

        if ref:
            existing = self.find_by_ref(ws, ref)
            if existing:
                bal = self.get_balance(ws)
                return {
                    "charged": existing.get("type") == "consume",
                    "skipped": existing.get("type") == "consume_skipped",
                    "environment": env,
                    "balance": bal,
                    "tx": existing,
                    "idempotent": True,
                    "cost": cost,
                }

        self.ensure_balance_row(ws, actor_id=actor_id or "system")
        bal = self.get_balance(ws)
        balance = bal["balance"]

        if env != "mainnet":
            tx = self._write_ledger(
                ws,
                tx_type="consume_skipped",
                amount=cost,
                balance_after=balance,
                reason="testnet_no_burn",
                service=service,
                action=action or cost_key,
                environment=env,
                actor_id=actor_id,
                actor_email=actor_email,
                ref=ref or f"skip:{uuid.uuid4()}",
                meta=meta,
            )
            return {
                "charged": False,
                "skipped": True,
                "environment": env,
                "balance": bal,
                "tx": tx,
                "cost": cost,
                "idempotent": False,
            }

        if balance < cost:
            raise InsufficientCredits(balance, cost)

        res = self.credits_table.update_item(
            Key={"workspaceId": ws},
            UpdateExpression="SET balance = balance - :c, updatedAt = :t",
            ConditionExpression="balance >= :c",
            ExpressionAttributeValues={
                ":c": cost,
                ":t": int(time.time() * 1000),
            },
            ReturnValues="ALL_NEW",
        )
        bal_after = _int(res["Attributes"].get("balance"), 0)
        tx = self._write_ledger(
            ws,
            tx_type="consume",
            amount=cost,
            balance_after=bal_after,
            reason="service_use",
            service=service,
            action=action or cost_key,
            environment=env,
            actor_id=actor_id,
            actor_email=actor_email,
            ref=ref or f"consume:{uuid.uuid4()}",
            meta=meta,
        )
        self._audit(
            ws,
            "credits.consume",
            actor_id=actor_id,
            actor_email=actor_email,
            target=f"{service}.{action}",
            meta={"amount": cost, "balanceAfter": bal_after},
        )
        return {
            "charged": True,
            "skipped": False,
            "environment": env,
            "balance": self._public_balance(res["Attributes"]),
            "tx": tx,
            "cost": cost,
            "idempotent": False,
        }

    # --- promos ---
    @staticmethod
    def generate_code(length: int = 10, prefix: str = "ZXR") -> str:
        """Cryptographically random promo code, e.g. ZXR-A7K2M9QX."""
        alphabet = string.ascii_uppercase + string.digits
        # Avoid ambiguous chars
        alphabet = alphabet.replace("O", "").replace("0", "").replace("I", "").replace("1", "").replace("L", "")
        n = max(6, min(int(length or 10), 16))
        body = "".join(secrets.choice(alphabet) for _ in range(n))
        pre = (prefix or "ZXR").strip().upper()[:8] or "ZXR"
        return f"{pre}-{body}"

    def create_promo(
        self,
        code: str,
        credit_amount: int,
        *,
        max_redemptions: Optional[int] = None,
        max_per_workspace: int = 1,
        starts_at: Optional[int] = None,
        expires_at: Optional[int] = None,
        created_by: str = "",
        note: str = "",
        eligible_environments: Optional[list] = None,
        auto_generate: bool = False,
    ) -> dict:
        clean = (code or "").strip().upper()
        if auto_generate or not clean:
            # Retry a few times on rare collision
            for _ in range(8):
                candidate = self.generate_code()
                existing = self.promo_table.get_item(Key={"code": candidate}).get("Item")
                if not existing:
                    clean = candidate
                    break
            else:
                clean = self.generate_code(length=12)
        if len(clean) < 3:
            raise ValueError("code must be at least 3 characters")
        amount = int(credit_amount)
        if amount <= 0:
            raise ValueError("creditAmount must be positive")
        # Default: one-time redeem globally AND once per workspace
        if max_redemptions is None:
            max_redemptions = 1
        max_redemptions = max(1, int(max_redemptions))
        # Always enforce single redeem per workspace (platform rule)
        max_per_workspace = 1
        if expires_at is not None:
            expires_at = _int(expires_at)
            if expires_at > 0 and expires_at < 10_000_000_000:
                # seconds → ms
                expires_at = expires_at * 1000
        now = int(time.time() * 1000)
        if expires_at and expires_at <= now:
            raise ValueError("expiresAt must be in the future")
        row = {
            "code": clean,
            "creditAmount": amount,
            "maxRedemptions": max_redemptions,
            "maxPerWorkspace": max_per_workspace,
            "startsAt": starts_at,
            "expiresAt": expires_at,
            "status": "active",
            "redeemedCount": 0,
            "createdBy": created_by,
            "note": (note or "")[:256],
            "eligibleEnvironments": eligible_environments or ["testnet", "mainnet"],
            "createdAt": now,
            "updatedAt": now,
            "oneTime": True,
        }
        try:
            self.promo_table.put_item(
                Item=_to_ddb(row),
                ConditionExpression="attribute_not_exists(code)",
            )
        except Exception as exc:
            raise ValueError(f"Promo code already exists or could not be saved: {exc}") from exc
        return self._public_promo(row)

    def list_promos(self) -> list:
        res = self.promo_table.scan(Limit=100)
        return [self._public_promo(i) for i in (res.get("Items") or [])]

    def disable_promo(self, code: str) -> dict:
        clean = (code or "").strip().upper()
        res = self.promo_table.update_item(
            Key={"code": clean},
            UpdateExpression="SET #s = :s, updatedAt = :t",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": "disabled", ":t": int(time.time() * 1000)},
            ReturnValues="ALL_NEW",
        )
        return self._public_promo(res["Attributes"])

    def _public_promo(self, item: dict) -> dict:
        expires = item.get("expiresAt")
        now = int(time.time() * 1000)
        expired = bool(expires and _int(expires) < now)
        redeemed = _int(item.get("redeemedCount"))
        max_r = item.get("maxRedemptions")
        exhausted = max_r is not None and redeemed >= _int(max_r)
        return {
            "code": item.get("code"),
            "creditAmount": _int(item.get("creditAmount")),
            "maxRedemptions": item.get("maxRedemptions"),
            "maxPerWorkspace": _int(item.get("maxPerWorkspace"), 1),
            "startsAt": item.get("startsAt"),
            "expiresAt": item.get("expiresAt"),
            "status": item.get("status") or "active",
            "redeemedCount": redeemed,
            "createdBy": item.get("createdBy") or "",
            "note": item.get("note") or "",
            "eligibleEnvironments": item.get("eligibleEnvironments") or ["testnet", "mainnet"],
            "createdAt": _int(item.get("createdAt")),
            "oneTime": True,
            "isExpired": expired,
            "isExhausted": exhausted,
            "remainingRedemptions": (
                None if max_r is None else max(0, _int(max_r) - redeemed)
            ),
        }

    def validate_promo(self, workspace_id: str, code: str) -> dict:
        """
        Check promo without redeeming.
        status: valid | invalid | disabled | expired | not_started |
                exhausted | already_redeemed | env_ineligible
        """
        ws = (workspace_id or "").strip()
        clean = (code or "").strip().upper()
        if not clean:
            return {
                "valid": False,
                "status": "invalid",
                "message": "Enter a promo code",
                "code": "",
            }
        promo = self.promo_table.get_item(Key={"code": clean}).get("Item")
        if not promo:
            return {
                "valid": False,
                "status": "invalid",
                "message": "Promo code is invalid",
                "code": clean,
            }
        pub = self._public_promo(promo)
        now = int(time.time() * 1000)
        if (promo.get("status") or "") != "active":
            return {
                "valid": False,
                "status": "disabled",
                "message": "Promo code is disabled",
                "code": clean,
                "promo": pub,
            }
        starts = promo.get("startsAt")
        if starts and _int(starts) > now:
            return {
                "valid": False,
                "status": "not_started",
                "message": "Promo code is not active yet",
                "code": clean,
                "promo": pub,
            }
        expires = promo.get("expiresAt")
        if expires and _int(expires) < now:
            return {
                "valid": False,
                "status": "expired",
                "message": "Promo code has expired",
                "code": clean,
                "promo": pub,
                "expiresAt": _int(expires),
            }
        # Prefer workspace-specific "already redeemed" over global exhausted
        if ws:
            existing = self.redemption_table.get_item(
                Key={"code": clean, "workspaceId": ws}
            ).get("Item")
            if existing:
                return {
                    "valid": False,
                    "status": "already_redeemed",
                    "message": "This workspace already redeemed this code (one-time only)",
                    "code": clean,
                    "promo": pub,
                    "redeemedAt": existing.get("redeemedAt"),
                }
            env = self.get_workspace_env(ws)
            eligible = promo.get("eligibleEnvironments") or ["testnet", "mainnet"]
            if env not in eligible:
                return {
                    "valid": False,
                    "status": "env_ineligible",
                    "message": f"Promo not valid for {env}",
                    "code": clean,
                    "promo": pub,
                }
        max_global = promo.get("maxRedemptions")
        redeemed = _int(promo.get("redeemedCount"))
        if max_global is not None and redeemed >= _int(max_global):
            return {
                "valid": False,
                "status": "exhausted",
                "message": "Promo code has already been fully redeemed",
                "code": clean,
                "promo": pub,
            }
        amount = _int(promo.get("creditAmount"))
        return {
            "valid": True,
            "status": "valid",
            "message": f"Valid · +{amount} ZCR · one-time redeem",
            "code": clean,
            "creditAmount": amount,
            "promo": pub,
            "fresh": True,
        }

    def redeem_promo(
        self,
        workspace_id: str,
        code: str,
        *,
        actor_id: str = "",
        actor_email: str = "",
    ) -> dict:
        ws = (workspace_id or "").strip()
        clean = (code or "").strip().upper()
        # Re-use validation layer
        check = self.validate_promo(ws, clean)
        if not check.get("valid"):
            raise PromoError(check.get("status") or "invalid", check.get("message") or "Invalid promo")

        promo = self.promo_table.get_item(Key={"code": clean}).get("Item")
        if not promo:
            raise PromoError("invalid", "Promo code is invalid")

        now = int(time.time() * 1000)
        amount = _int(promo.get("creditAmount"))
        # record redemption first (condition) — one-time per workspace
        try:
            self.redemption_table.put_item(
                Item=_to_ddb({
                    "code": clean,
                    "workspaceId": ws,
                    "redeemedAt": now,
                    "actorId": actor_id,
                    "actorEmail": actor_email,
                    "amount": amount,
                }),
                ConditionExpression="attribute_not_exists(workspaceId)",
            )
        except Exception:
            raise PromoError("already_redeemed", "This workspace already redeemed this code (one-time only)")

        try:
            self.promo_table.update_item(
                Key={"code": clean},
                UpdateExpression="SET redeemedCount = if_not_exists(redeemedCount, :z) + :one, updatedAt = :t",
                ExpressionAttributeValues={":one": 1, ":z": 0, ":t": now},
            )
        except Exception as exc:
            print(f"[promo.count] {exc}")

        result = self.grant(
            ws,
            amount,
            reason=f"promo:{clean}",
            actor_id=actor_id,
            actor_email=actor_email,
            ref=f"promo:{clean}:{ws}",
            meta={"code": clean},
            tx_type="promo",
        )
        self._audit(
            ws,
            "credits.promo_redeemed",
            actor_id=actor_id,
            actor_email=actor_email,
            target=clean,
            meta={"amount": amount},
        )
        result["validation"] = {"status": "redeemed", "message": f"Redeemed +{amount} ZCR"}
        return result


class InsufficientCredits(Exception):
    def __init__(self, balance: int, cost: int):
        self.balance = balance
        self.cost = cost
        super().__init__(f"Insufficient credits: have {balance}, need {cost}")


class PromoError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)
