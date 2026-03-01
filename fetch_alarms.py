import csv
import json
import os
import requests
from datetime import datetime

CSV_URL = "https://raw.githubusercontent.com/yuval-harpaz/alarms/master/data/alarms.csv"
START_DATE = datetime(2026, 2, 28)
DESCRIPTION = "ירי רקטות וטילים"

CITIES_INTEREST = {
    "כפר כמא": "Kfar Kama",
    "ריחאנייה": "Reihaniya"
}

def fetch_and_filter():
    print(f"Fetching data from {CSV_URL}...")
    response = requests.get(CSV_URL)
    response.raise_for_status()
    
    decoded_content = response.content.decode('utf-8')
    cr = csv.DictReader(decoded_content.splitlines())
    
    filtered_data = []
    stats = {
        "total": 0,
        "cities": {city: 0 for city in CITIES_INTEREST}
    }
    
    for row in cr:
        try:
            # Format: 2019-06-13 00:17:00
            row_time = datetime.strptime(row['time'], '%Y-%m-%d %H:%M:%S')
            row_description = row['description']
            if row_time >= START_DATE and row_description == DESCRIPTION:
                filtered_data.append(row)
                stats["total"] += 1
                
                # Check for interest cities in 'cities' column (comma separated)
                row_cities = [c.strip() for c in row['cities'].split(',')]
                for city in CITIES_INTEREST:
                    if city in row_cities:
                        stats["cities"][city] += 1
                        
        except Exception as e:
            print(f"Error parsing row: {e}")
            continue

    result = {
        "last_updated": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "stats": stats,
        "data": filtered_data
    }
    
    json_str = json.dumps(result, ensure_ascii=False, indent=2)
    
    # Save to data/ (legacy / static index.html)
    os.makedirs('data', exist_ok=True)
    with open('data/alarms.json', 'w', encoding='utf-8') as f:
        f.write(json_str)
    with open('data/alarms.js', 'w', encoding='utf-8') as f:
        f.write(f"window.ALARMS_DATA = {json_str};")

    # Save to client/public/data/ (Vite dev server & production build)
    os.makedirs('client/public/data', exist_ok=True)
    with open('client/public/data/alarms.json', 'w', encoding='utf-8') as f:
        f.write(json_str)
        
    print(f"Processed {len(filtered_data)} alarms. Stats: {stats}")

if __name__ == "__main__":
    fetch_and_filter()
