#!/usr/bin/env python3
"""Unit tests for credits service (mocked Dynamo)."""
from __future__ import annotations

import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scratch_lambda"))

# Minimal boto3 stub if credits imports nothing from boto at module level
from credits import CreditsService, InsufficientCredits, PromoError  # noqa: E402


class FakeTable:
    def __init__(self):
        self.items = {}

    def get_item(self, Key):
        key = tuple(sorted(Key.items()))
        item = self.items.get(key)
        return {"Item": item} if item else {}

    def put_item(self, Item, ConditionExpression=None):
        # simple key detection
        if "workspaceId" in Item and "sk" in Item:
            key = (("sk", Item["sk"]), ("workspaceId", Item["workspaceId"]))
        elif "code" in Item and "workspaceId" in Item:
            key = (("code", Item["code"]), ("workspaceId", Item["workspaceId"]))
        elif "code" in Item:
            key = (("code", Item["code"]),)
        else:
            key = (("workspaceId", Item["workspaceId"]),)
        if ConditionExpression and key in self.items:
            raise Exception("ConditionalCheckFailed")
        self.items[key] = dict(Item)
        return {}

    def update_item(self, Key, UpdateExpression, ExpressionAttributeValues=None, ExpressionAttributeNames=None, ConditionExpression=None, ReturnValues=None):
        key = tuple(sorted(Key.items()))
        item = dict(self.items.get(key) or {**Key, "balance": 0})
        vals = ExpressionAttributeValues or {}
        # very small interpreter for our expressions
        if "balance = if_not_exists(balance, :z) + :a" in UpdateExpression:
            item["balance"] = int(item.get("balance") or 0) + int(vals[":a"])
        elif "balance = balance - :c" in UpdateExpression:
            if ConditionExpression and int(item.get("balance") or 0) < int(vals[":c"]):
                raise Exception("ConditionalCheckFailed")
            item["balance"] = int(item.get("balance") or 0) - int(vals[":c"])
        if "redeemedCount" in UpdateExpression:
            item["redeemedCount"] = int(item.get("redeemedCount") or 0) + 1
        if "#s = :s" in UpdateExpression or "status" in UpdateExpression:
            item["status"] = vals.get(":s", item.get("status"))
        item["updatedAt"] = vals.get(":t", item.get("updatedAt"))
        if ":c" in vals and "currency" in UpdateExpression:
            item["currency"] = vals[":c"]
        self.items[key] = item
        return {"Attributes": item}

    def query(self, **kwargs):
        ws = None
        # KeyConditionExpression is mock object in real boto; we store all and filter
        items = []
        for k, v in self.items.items():
            if isinstance(k, tuple) and any(x[0] == "workspaceId" for x in k):
                items.append(v)
        items = sorted(items, key=lambda x: x.get("sk") or "", reverse=True)
        return {"Items": items[: kwargs.get("Limit", 50)]}

    def scan(self, Limit=100):
        return {"Items": list(self.items.values())[:Limit]}


class CreditsTest(unittest.TestCase):
    def setUp(self):
        self.env = "testnet"
        self.credits = FakeTable()
        self.ledger = FakeTable()
        self.promo = FakeTable()
        self.redemptions = FakeTable()
        self.svc = CreditsService(
            self.credits,
            self.ledger,
            self.promo,
            self.redemptions,
            get_workspace_env=lambda _ws: self.env,
            starter_grant=100,
        )

    def test_starter_grant(self):
        bal = self.svc.ensure_balance_row("ws1")
        self.assertEqual(bal["balance"], 100)

    def test_testnet_no_burn(self):
        self.svc.ensure_balance_row("ws1")
        self.env = "testnet"
        res = self.svc.consume("ws1", service="morph", action="run", amount=10, ref="r1")
        self.assertTrue(res["skipped"])
        self.assertFalse(res["charged"])
        self.assertEqual(self.svc.get_balance("ws1")["balance"], 100)

    def test_mainnet_burn(self):
        self.svc.ensure_balance_row("ws1")
        self.env = "mainnet"
        res = self.svc.consume("ws1", service="morph", action="run", amount=10, ref="r2")
        self.assertTrue(res["charged"])
        self.assertEqual(self.svc.get_balance("ws1")["balance"], 90)

    def test_insufficient(self):
        self.svc.ensure_balance_row("ws1")
        self.env = "mainnet"
        with self.assertRaises(InsufficientCredits):
            self.svc.consume("ws1", service="morph", action="run", amount=1000)

    def test_promo_redeem(self):
        self.svc.ensure_balance_row("ws1")
        self.svc.create_promo("HELLO", 50, created_by="nabil")
        res = self.svc.redeem_promo("ws1", "hello", actor_id="u1")
        self.assertEqual(res["balance"]["balance"], 150)
        with self.assertRaises(PromoError):
            self.svc.redeem_promo("ws1", "HELLO", actor_id="u1")

    def test_auto_generate_and_validate(self):
        self.svc.ensure_balance_row("ws1")
        promo = self.svc.create_promo("", 25, created_by="nabil", auto_generate=True, expires_at=int(__import__("time").time() * 1000) + 86400000)
        self.assertTrue(promo["code"].startswith("ZXR-"))
        check = self.svc.validate_promo("ws1", promo["code"])
        self.assertTrue(check["valid"])
        self.assertEqual(check["status"], "valid")
        # one-time after redeem
        self.svc.redeem_promo("ws1", promo["code"], actor_id="u1")
        again = self.svc.validate_promo("ws1", promo["code"])
        self.assertFalse(again["valid"])
        self.assertEqual(again["status"], "already_redeemed")

    def test_expired_promo(self):
        self.svc.ensure_balance_row("ws1")
        past = int(__import__("time").time() * 1000) - 1000
        # create_promo rejects past expiry — plant row directly
        self.promo.put_item(Item={
            "code": "OLDCODE",
            "creditAmount": 10,
            "maxRedemptions": 1,
            "maxPerWorkspace": 1,
            "status": "active",
            "redeemedCount": 0,
            "expiresAt": past,
            "eligibleEnvironments": ["testnet", "mainnet"],
        })
        check = self.svc.validate_promo("ws1", "OLDCODE")
        self.assertFalse(check["valid"])
        self.assertEqual(check["status"], "expired")


if __name__ == "__main__":
    unittest.main()
