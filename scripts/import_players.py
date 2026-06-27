#!/usr/bin/env python3
"""
CSV Player Import Utility (legacy static-data workflow).

Reads players from CSV and writes data/teams.json plus data/teams.js.
The live app uses Postgres + admin CSV import; this script remains for
bootstrapping or offline data/ edits.
"""

import json
import csv
from pathlib import Path
from collections import defaultdict

from _paths import DATA_DIR, REPO_ROOT


def import_players_from_csv(
    csv_path: str | Path | None = None,
    output_path: str | Path | None = None,
):
    """Import players from CSV and generate teams.json."""
    csv_file = Path(csv_path) if csv_path else REPO_ROOT / "players-data.csv"
    output_file = Path(output_path) if output_path else DATA_DIR / "teams.json"

    teams_data = defaultdict(lambda: {
        'members': [],
        'coach': '',
        'logo': ''
    })

    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header

        member_id = 100
        team_id_map = {}
        next_team_id = 1

        for row in reader:
            if not row or not row[0]:
                continue

            team_name = row[0].strip()
            first_name = row[1].strip() if len(row) > 1 else ''
            last_name = row[2].strip() if len(row) > 2 else ''
            nickname = row[3].strip() if len(row) > 3 else ''
            number = row[4].strip() if len(row) > 4 else ''
            position = row[5].strip() if len(row) > 5 else ''
            bio = row[6].strip() if len(row) > 6 else ''
            captain = row[7].strip() if len(row) > 7 else ''

            if not first_name and not last_name and not nickname:
                continue

            if team_name not in team_id_map:
                team_id_map[team_name] = next_team_id
                next_team_id += 1

            team_id = team_id_map[team_name]
            full_name = f"{first_name} {last_name}".strip() if first_name or last_name else nickname
            display_nickname = nickname if nickname else (first_name if first_name else last_name)

            try:
                player_number = int(number) if number else member_id % 100
            except ValueError:
                player_number = member_id % 100

            if not position:
                position = 'מחמם ספסל'

            if not bio:
                bio = f'משחק בעד {team_name}'

            player = {
                'id': member_id,
                'name': full_name,
                'nickname': display_nickname,
                'number': player_number,
                'position': position.capitalize(),
                'head_photo': f'assets/images/players/heads/{member_id}.jpg',
                'bio': bio,
                'is_captain': captain == '1'
            }

            teams_data[team_name]['members'].append(player)
            member_id += 1

    teams_list = []
    for team_name, team_data in teams_data.items():
        team_id = team_id_map[team_name]
        teams_list.append({
            'id': team_id,
            'name': team_name,
            'logo': f'assets/images/teams/{team_name.lower().replace(" ", "_")}.png',
            'coach': team_data['coach'] or 'Coach',
            'members': team_data['members']
        })

    teams_list.sort(key=lambda x: x['id'])

    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(teams_list, f, indent=2, ensure_ascii=False)

    js_file = output_file.with_suffix('.js')
    with open(js_file, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated from teams.json\n')
        f.write('window.TEAMS_DATA = ')
        json.dump(teams_list, f, indent=2, ensure_ascii=False)
        f.write(';\n')

    print("Import complete!")
    print(f"  - {len(teams_list)} teams")
    print(f"  - {sum(len(t['members']) for t in teams_list)} players")
    print(f"  - Created {output_file.name} and {js_file.name}")
    print("\nTeams:")
    for team in teams_list:
        print(f"  - {team['name']}: {len(team['members'])} players")


if __name__ == '__main__':
    import_players_from_csv()
