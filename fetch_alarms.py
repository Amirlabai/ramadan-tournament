import csv
import json
import os
import requests
from datetime import datetime, timedelta
from collections import defaultdict

CSV_URL = "https://raw.githubusercontent.com/yuval-harpaz/alarms/master/data/alarms.csv"

# Start date for main stats display
START_DATE = datetime(2026, 2, 28)

# Start date for regression training data (broader historical window)
REGRESSION_START_DATE = START_DATE

DESCRIPTION = "ירי רקטות וטילים"

CITIES_INTEREST = {
    "כפר כמא": "Kfar Kama",
    "ריחאנייה": "Reihaniya"
}


def get_5min_bin_key(dt: datetime) -> str:
    """Returns a string key 'HH:MM' for the 5-minute bin of a datetime."""
    minute_bin = (dt.minute // 30) * 30
    return f"{dt.hour:02d}:{minute_bin:02d}"


def linear_regression(x_vals: list[float], y_vals: list[float]):
    """Simple linear regression: returns (slope, intercept)."""
    n = len(x_vals)
    if n < 2:
        return 0.0, y_vals[0] if y_vals else 0.0
    sum_x = sum(x_vals)
    sum_y = sum(y_vals)
    sum_xy = sum(x * y for x, y in zip(x_vals, y_vals))
    sum_xx = sum(x * x for x in x_vals)
    denom = n * sum_xx - sum_x ** 2
    if denom == 0:
        return 0.0, sum_y / n
    slope = (n * sum_xy - sum_x * sum_y) / denom
    intercept = (sum_y - slope * sum_x) / n
    return slope, intercept


def predict_next_alarm(alert_times: list[datetime]) -> str | None:
    """
    Uses regression on inter-arrival intervals to predict when the next alarm
    might occur after the most recent alert.
    """
    if len(alert_times) < 3:
        return None

    # Sort and compute intervals in seconds
    sorted_times = sorted(alert_times)
    intervals = [
        (sorted_times[i + 1] - sorted_times[i]).total_seconds()
        for i in range(len(sorted_times) - 1)
    ]

    # Regress interval index -> interval duration
    x_vals = list(range(len(intervals)))
    slope, intercept = linear_regression(x_vals, intervals)

    # Predict the next interval
    next_x = len(intervals)
    predicted_interval = slope * next_x + intercept

    # Clamp to something realistic (between 1 minute and 30 days)
    predicted_interval = max(60, min(predicted_interval, 60 * 60 * 24 * 30))

    last_alarm = sorted_times[-1]
    predicted_next = last_alarm + timedelta(seconds=predicted_interval)

    return predicted_next.strftime('%Y-%m-%d %H:%M:%S')


def fetch_and_filter():
    print(f"Fetching data from {CSV_URL}...")
    response = requests.get(CSV_URL)
    response.raise_for_status()

    decoded_content = response.content.decode('utf-8')
    cr = csv.DictReader(decoded_content.splitlines())

    # Data structures
    recent_rows = []   # rows since START_DATE (for display)
    stats = {
        "total": 0,
        "cities": {city: 0 for city in CITIES_INTEREST}
    }

    # 5-min bins: { city: { "HH:MM": count } }
    bins: dict[str, dict[str, int]] = {city: defaultdict(int) for city in CITIES_INTEREST}

    # Alert timestamps per city for regression (historical window)
    regression_times: dict[str, list[datetime]] = {city: [] for city in CITIES_INTEREST}

    all_rows_parsed = []
    for row in cr:
        try:
            row_time = datetime.strptime(row['time'], '%Y-%m-%d %H:%M:%S')
            if row['description'] != DESCRIPTION:
                continue

            row_cities = [c.strip() for c in row['cities'].split(',')]

            # Collect for regression (historical)
            if row_time >= REGRESSION_START_DATE:
                for city in CITIES_INTEREST:
                    if city in row_cities:
                        regression_times[city].append(row_time)

            # Collect recent stats and bins
            if row_time >= START_DATE:
                recent_rows.append(row)
                stats["total"] += 1
                for city in CITIES_INTEREST:
                    if city in row_cities:
                        stats["cities"][city] += 1
                        bin_key = get_5min_bin_key(row_time)
                        bins[city][bin_key] += 1

        except Exception as e:
            print(f"Error parsing row: {e}")
            continue

    # Build sorted bin lists for each city
    # Produce all 288 bins (00:00 to 23:55) with counts (0 if no alarm)
    all_bins: dict[str, list[dict]] = {}
    for city in CITIES_INTEREST:
        city_bins = []
        for hour in range(24):
            for minute in range(0, 60, 30):
                key = f"{hour:02d}:{minute:02d}"
                city_bins.append({"time": key, "count": bins[city].get(key, 0)})
        all_bins[city] = city_bins

    # Predictions per city
    predictions: dict[str, str | None] = {}
    for city in CITIES_INTEREST:
        predictions[city] = predict_next_alarm(regression_times[city])
        print(f"  Prediction for {city}: {predictions[city]}")

    result = {
        "last_updated": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "stats": stats,
        "bins": all_bins,
        "predictions": predictions,
        "data": recent_rows
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

    print(f"Processed {len(recent_rows)} recent alarms. Stats: {stats}")


if __name__ == "__main__":
    fetch_and_filter()
