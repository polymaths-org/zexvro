#!/usr/bin/env python3
"""Unit tests for workspace audit helpers (no AWS required for pure logic)."""
from __future__ import annotations

import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock


ROOT = Path(__file__).resolve().parents[1]
LF_PATH = ROOT / "scratch_lambda" / "lambda_function.py"


def load_lambda_module():
    # Stub boto3 before import
    boto3 = types.ModuleType("boto3")
    boto3.resource = MagicMock()
    boto3.client = MagicMock()
    sys.modules["boto3"] = boto3
    conditions = types.ModuleType("boto3.dynamodb.conditions")
    conditions.Attr = MagicMock()
    conditions.Key = MagicMock(side_effect=lambda **kw: kw)

    class _Key:
        def __init__(self, name):
            self.name = name

        def eq(self, value):
            return ("eq", self.name, value)

    conditions.Key = _Key
    sys.modules["boto3.dynamodb.conditions"] = conditions

    # mock Table
    table_mock = MagicMock()
    resource_mock = MagicMock()
    resource_mock.Table.return_value = table_mock
    boto3.resource.return_value = resource_mock

    spec = importlib.util.spec_from_file_location("zexvro_lambda", LF_PATH)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod, table_mock


class AuditHelpersTest(unittest.TestCase):
    def setUp(self):
        self.mod, self.tables = load_lambda_module()
        # all Table() calls return same mock — fine for unit tests
        self.audit = MagicMock()
        self.mod.audit_table = self.audit

    def test_append_requires_workspace_and_action(self):
        self.assertIsNone(self.mod.append_audit_event("", action="x"))
        self.assertIsNone(self.mod.append_audit_event("ws", action=""))
        self.audit.put_item.assert_not_called()

    def test_append_writes_item(self):
        ev = self.mod.append_audit_event(
            "ws_abc",
            action="invite.sent",
            actor_id="user1",
            actor_email="a@b.com",
            target="c@d.com",
            meta={"role": "Admin"},
        )
        self.assertIsNotNone(ev)
        self.assertEqual(ev["action"], "invite.sent")
        self.assertEqual(ev["workspaceId"], "ws_abc")
        self.audit.put_item.assert_called_once()
        item = self.audit.put_item.call_args.kwargs.get("Item") or self.audit.put_item.call_args[1].get("Item")
        if item is None:
            item = self.audit.put_item.call_args[0][0] if self.audit.put_item.call_args[0] else {}
        # put_item(Item=...)
        kwargs = self.audit.put_item.call_args.kwargs
        item = kwargs["Item"]
        self.assertEqual(item["workspaceId"], "ws_abc")
        self.assertIn("eventKey", item)
        self.assertTrue(str(item["eventKey"]).startswith(str(ev["createdAt"])))

    def test_append_fail_open(self):
        self.audit.put_item.side_effect = RuntimeError("boom")
        ev = self.mod.append_audit_event("ws", action="invite.sent")
        self.assertIsNone(ev)

    def test_list_events_newest(self):
        self.audit.query.return_value = {
            "Items": [
                {
                    "workspaceId": "ws",
                    "eventKey": "0002#b",
                    "eventId": "b",
                    "action": "invite.accepted",
                    "createdAt": 2,
                },
                {
                    "workspaceId": "ws",
                    "eventKey": "0001#a",
                    "eventId": "a",
                    "action": "invite.sent",
                    "createdAt": 1,
                },
            ]
        }
        events, cursor = self.mod.list_audit_events("ws", limit=10)
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]["action"], "invite.accepted")
        self.assertIsNone(cursor)

    def test_list_project_filter(self):
        self.audit.query.return_value = {
            "Items": [
                {"workspaceId": "ws", "eventKey": "1#a", "eventId": "a", "action": "x", "projectId": "p1", "createdAt": 1},
                {"workspaceId": "ws", "eventKey": "2#b", "eventId": "b", "action": "y", "projectId": "p2", "createdAt": 2},
            ]
        }
        events, _ = self.mod.list_audit_events("ws", project_id="p1")
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["projectId"], "p1")


if __name__ == "__main__":
    unittest.main()
