import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import main


class FakeIssueApi:
    def __init__(self):
        self.payload = None

    def create(self, **payload):
        self.payload = payload
        return SimpleNamespace(
            id=321,
            subject=payload["subject"],
            project=SimpleNamespace(id=payload["project_id"], name="Test Project"),
        )


class FakeTimeEntryApi:
    def __init__(self):
        self.payload = None

    def create(self, **payload):
        self.payload = payload
        return SimpleNamespace(id=654)


class FakeRedmineApi:
    def __init__(self):
        self.issue = FakeIssueApi()
        self.time_entry = FakeTimeEntryApi()
        self.project = SimpleNamespace(
            get=lambda *_args, **_kwargs: SimpleNamespace(trackers=[SimpleNamespace(id=1)])
        )
        self.user = SimpleNamespace(get=lambda *_args, **_kwargs: SimpleNamespace(id=7))
        self.tracker = SimpleNamespace(all=lambda: [SimpleNamespace(id=1)])


class RedmineRequiredFieldTests(unittest.TestCase):
    def setUp(self):
        self.api = FakeRedmineApi()
        self.client = SimpleNamespace(redmine=self.api)
        self.patches = [
            patch.object(main, "get_redmine_client", return_value=self.client),
            patch.object(main, "load_cache", return_value={}),
            patch.object(main, "save_cache"),
            patch.object(main, "update_cache_with_entry"),
        ]
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in reversed(self.patches):
            item.stop()

    def test_issue_creation_sends_all_required_custom_fields(self):
        result = main.create_issue(main.IssueCreate(project_id=10, subject="Test issue"))

        self.assertEqual(result["status"], "success")
        self.assertEqual(
            self.api.issue.payload["custom_fields"],
            [
                {"id": 27, "value": "N/A"},
                {"id": 15, "value": "N/A"},
                {"id": 26, "value": "FW&SW RD"},
                {"id": 126, "value": "0"},
            ],
        )

    def test_issue_creation_rejects_blank_required_field(self):
        result = main.create_issue(main.IssueCreate(
            project_id=10,
            subject="Test issue",
            hw_version="",
        ))

        self.assertIn("HW Version", result["error"])
        self.assertIsNone(self.api.issue.payload)

    def test_time_entry_always_uses_fixed_team(self):
        result = main.create_time_entry(main.TimeEntry(
            project_id=10,
            spent_on="2026-07-22",
            hours=1,
            activity_id=9,
            rd_function_team="N/A",
        ))

        self.assertEqual(result["status"], "success")
        self.assertEqual(
            self.api.time_entry.payload["custom_fields"],
            [{"id": 93, "value": "SW_OS/BSP"}],
        )


class TimeEntryCacheTests(unittest.TestCase):
    def test_sparse_time_entry_can_be_serialized_for_calendar(self):
        entry = SimpleNamespace(
            id=341410,
            project=SimpleNamespace(id=316),
            issue=SimpleNamespace(id=145528),
            hours=7.0,
            comments="development",
            spent_on="2026-07-20",
        )

        result = main.serialize_time_entry(entry, "10:30")

        self.assertEqual(result["id"], 341410)
        self.assertEqual(result["project_id"], 316)
        self.assertEqual(result["issue"], 145528)
        self.assertEqual(result["start_time"], "10:30")
        self.assertEqual(result["project"], "")
        self.assertEqual(result["activity"], "")


class ProfileTests(unittest.TestCase):
    def test_profile_is_upserted_by_issue_id(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            config_file = os.path.join(temp_dir, "settings.yaml")
            with patch.object(main, "CONFIG_FILE", config_file):
                main.save_profile(main.Profile(
                    name="#123 · Old name",
                    project_id=10,
                    issue_id=123,
                    activity_id=9,
                ))
                result = main.save_profile(main.Profile(
                    name="#123 · New name",
                    project_id=10,
                    issue_id=123,
                    activity_id=10,
                ))

        self.assertEqual(len(result["profiles"]), 1)
        self.assertEqual(result["profiles"][0]["name"], "#123 · New name")
        self.assertEqual(result["profiles"][0]["activity_id"], 10)


if __name__ == "__main__":
    unittest.main()
