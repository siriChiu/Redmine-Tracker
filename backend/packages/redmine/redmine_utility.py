from redminelib import Redmine as RedmineLib

class Redmine:
    def __init__(self, api_key, url='https://redmine.sw.ciot.work'):
        self.url = url
        self.api_key = api_key
        # Add timeout to prevent hanging
        self.redmine = RedmineLib(url, key=api_key, requests={'timeout': 5})
        self.activity_map = self._get_activity_map()

    def _get_activity_map(self):
        # Hardcoded mapping as per user request
        return {
            20: "Study Spec",
            8: "Design",
            9: "Development",
            10: "Validation",
            71: "Maintain",
            14: "Others",
            61: "Support",
            73: "Preparing automation scripts",
            74: "Regression tests",
            75: "Setup test bed",
            76: "Study/Prepare test cases",
            77: "Debug session",
            78: "Code Review",
            72: "RFI/ RFQ",
            62: "SCM review"
        }

    def get_time_entries(self, user_id='me', from_date=None, to_date=None, limit=100):
        filters = {'user_id': user_id, 'limit': limit}
        if from_date:
            filters['from_date'] = from_date
        if to_date:
            filters['to_date'] = to_date
        
        return self.redmine.time_entry.filter(**filters)

    def create_time_entry(self, project_id, issue_id, hours, comments, activity_id=None, spent_on=None):
        data = {
            'hours': hours,
            'comments': comments,
        }
        if issue_id:
            data['issue_id'] = issue_id
        elif project_id:
            data['project_id'] = project_id
        
        if activity_id:
            data['activity_id'] = activity_id
        
        if spent_on:
            data['spent_on'] = spent_on

        return self.redmine.time_entry.create(**data)
