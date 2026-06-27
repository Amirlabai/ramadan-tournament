#!/usr/bin/env python3
"""
Convert JSON data files to JavaScript files for direct HTML loading (legacy).

Allows the static data/ tree to work without a local server.
"""

import json
from pathlib import Path

from _paths import DATA_DIR


def json_to_js(json_file: Path, js_file: Path, var_name: str) -> None:
    """Convert a JSON file to a JavaScript file with a global variable."""
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    with open(js_file, 'w', encoding='utf-8') as f:
        f.write(f'// Auto-generated from {json_file.name}\n')
        f.write(f'window.{var_name} = ')
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write(';\n')

    print(f'Created {js_file}')


def main():
    """Convert all JSON files to JS."""
    conversions = [
        ('teams.json', 'teams.js', 'TEAMS_DATA'),
        ('matches.json', 'matches.js', 'MATCHES_DATA'),
        ('standings.json', 'standings.js', 'STANDINGS_DATA'),
        ('top_scorers.json', 'top_scorers.js', 'TOP_SCORERS_DATA'),
        ('news.json', 'news.js', 'NEWS_DATA'),
    ]

    for json_name, js_name, var_name in conversions:
        json_file = DATA_DIR / json_name
        js_file = DATA_DIR / js_name

        if json_file.exists():
            json_to_js(json_file, js_file, var_name)
        else:
            print(f'⚠ Skipped {json_name} (not found)')

    print('\nConversion complete!')


if __name__ == '__main__':
    main()
