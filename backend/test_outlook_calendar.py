import unittest

from outlook_calendar import match_mapping


class CalendarMappingTests(unittest.TestCase):
    def test_longest_matching_pattern_wins(self):
        mappings = [
            {"id": "general", "title_pattern": "weekly", "enabled": True},
            {"id": "specific", "title_pattern": "platform weekly", "enabled": True},
        ]
        self.assertEqual(
            match_mapping("Platform Weekly Sync", mappings)["id"],
            "specific",
        )

    def test_matching_is_case_insensitive(self):
        mapping = {"id": "one", "title_pattern": "CUSTOMER SYNC", "enabled": True}
        self.assertEqual(match_mapping("Customer Sync - APAC", [mapping])["id"], "one")

    def test_exact_and_disabled_rules_are_respected(self):
        mappings = [
            {"id": "disabled", "title_pattern": "Standup", "enabled": False},
            {"id": "exact", "title_pattern": "Standup", "match_type": "exact", "enabled": True},
        ]
        self.assertIsNone(match_mapping("Standup - Platform", mappings))
        self.assertEqual(match_mapping("Standup", mappings)["id"], "exact")


if __name__ == "__main__":
    unittest.main()
