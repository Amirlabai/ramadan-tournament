"""
Tournament Stats Tracker & News Generator
Fetches current standings and top scorers from MongoDB,
compares against the last snapshot to detect changes,
then writes an AI-generated Hebrew summary to the news feed.
"""

import os
import sys
import json
import google.generativeai as genai
from datetime import datetime, timezone
from pymongo import MongoClient


# ── MongoDB connection ────────────────────────────────────────────────────────

def get_db():
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise ValueError("MONGODB_URI environment variable is not set")
    client = MongoClient(uri, serverSelectionTimeoutMS=10000)
    return client, client.get_default_database()


# ── Stats calculation (mirrors StatsService.ts) ───────────────────────────────

def calculate_standings(db) -> list[dict]:
    teams = {t["id"]: t for t in db["teams"].find()}
    matches = list(db["matches"].find({"phase": "group"}))

    standings = {}
    for tid, team in teams.items():
        standings[tid] = {
            "teamId": tid,
            "teamName": team["name"],
            "played": 0, "won": 0, "drawn": 0, "lost": 0,
            "goalsFor": 0, "goalsAgainst": 0, "points": 0,
        }

    for match in matches:
        s1, s2 = match.get("score1"), match.get("score2")
        if s1 is None or s2 is None:
            continue
        t1 = standings.get(match["team1Id"])
        t2 = standings.get(match["team2Id"])
        if not t1 or not t2:
            continue

        t1["played"] += 1; t2["played"] += 1
        t1["goalsFor"] += s1; t1["goalsAgainst"] += s2
        t2["goalsFor"] += s2; t2["goalsAgainst"] += s1

        if s1 > s2:
            t1["won"] += 1; t1["points"] += 3; t2["lost"] += 1
        elif s2 > s1:
            t2["won"] += 1; t2["points"] += 3; t1["lost"] += 1
        else:
            t1["drawn"] += 1; t1["points"] += 1
            t2["drawn"] += 1; t2["points"] += 1

    result = sorted(
        standings.values(),
        key=lambda x: (-x["points"], -(x["goalsFor"] - x["goalsAgainst"]), -x["goalsFor"])
    )
    for i, entry in enumerate(result):
        entry["rank"] = i + 1
        entry["goalDifference"] = entry["goalsFor"] - entry["goalsAgainst"]
    return result


def calculate_top_scorers(db, top_n: int = 5) -> list[dict]:
    teams = list(db["teams"].find())
    matches = list(db["matches"].find())

    members = {}
    team_matches = {}
    for team in teams:
        team_matches[team["id"]] = 0
        for p in team.get("players", []):
            name = f"{p.get('firstName', '')} {p.get('lastName', '')}".strip() or p.get("nickname", "")
            members[p["memberId"]] = {"name": name, "teamName": team["name"], "teamId": team["id"]}

    scorer_goals = {}
    for match in matches:
        if match.get("score1") is None or match.get("score2") is None:
            continue
        if match["team1Id"] in team_matches:
            team_matches[match["team1Id"]] += 1
        if match["team2Id"] in team_matches:
            team_matches[match["team2Id"]] += 1
        for goal in match.get("goals", []):
            mid = goal["memberId"]
            scorer_goals[mid] = scorer_goals.get(mid, 0) + 1

    scorers = []
    for mid, goals in scorer_goals.items():
        info = members.get(mid, {})
        played = team_matches.get(info.get("teamId", -1), 0)
        scorers.append({
            "memberId": mid,
            "playerName": info.get("name", "Unknown"),
            "teamName": info.get("teamName", "Unknown"),
            "goals": goals,
            "gamesPlayed": played,
        })

    scorers.sort(key=lambda x: (-x["goals"], -(x["goals"] / x["gamesPlayed"]) if x["gamesPlayed"] > 0 else 0))
    return scorers[:top_n]


# ── Snapshot comparison ───────────────────────────────────────────────────────

def load_last_snapshot(db) -> dict | None:
    doc = db["stats_snapshots"].find_one(sort=[("savedAt", -1)])
    return doc if doc else None


def save_snapshot(db, standings: list, scorers: list) -> None:
    db["stats_snapshots"].insert_one({
        "standings": standings,
        "topScorers": scorers,
        "savedAt": datetime.now(timezone.utc),
    })


def detect_changes(old: dict | None, standings: list, scorers: list) -> list[str]:
    """Return a list of plain-text change descriptions (empty = no changes)."""
    if old is None:
        return ["נתוני הטורניר נשמרו לראשונה. סטטיסטיקות עדכניות זמינות."]

    changes = []

    # --- Standings changes ---
    old_standings = {s["teamId"]: s for s in old.get("standings", [])}
    for entry in standings:
        tid = entry["teamId"]
        old_e = old_standings.get(tid)
        if old_e is None:
            continue
        if entry["points"] != old_e["points"]:
            diff = entry["points"] - old_e["points"]
            changes.append(
                f"קבוצת {entry['teamName']} הוסיפה {diff} נקודות ועומדת על {entry['points']} נקודות (מקום #{entry['rank']})"
            )
        if entry["rank"] != old_e.get("rank", entry["rank"]):
            changes.append(
                f"קבוצת {entry['teamName']} זזה למקום #{entry['rank']} בטבלה"
            )

    # --- Top scorer changes ---
    old_scorers = {s["memberId"]: s for s in old.get("topScorers", [])}
    for scorer in scorers:
        mid = scorer["memberId"]
        old_s = old_scorers.get(mid)
        if old_s is None:
            continue
        if scorer["goals"] != old_s["goals"]:
            new_goals = scorer["goals"] - old_s["goals"]
            changes.append(
                f"{scorer['playerName']} מ{scorer['teamName']} כבש {new_goals} שער{'ים' if new_goals > 1 else ''} ועומד על {scorer['goals']} שערים"
            )

    return changes


# ── Gemini summary ────────────────────────────────────────────────────────────

def generate_summary(changes: list[str]) -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    bullets = "\n".join(f"- {c}" for c in changes)
    prompt = (
        "אתה כתב ספורט בטורניר כדורגל. "
        "תאר את השינויים הבאים בעברית קצרה וישירה — 2 עד 3 משפטים בלבד. "
        "כתוב בסגנון ניוז-פלאש, ללא הקדמות. ודא שהמשפטים ממוספרים או מופרדים בנקודה.\n\n"
        f"שינויים:\n{bullets}"
    )

    response = model.generate_content(prompt)
    text = ""
    if hasattr(response, "text") and response.text:
        text = response.text.strip()
    elif hasattr(response, "candidates") and response.candidates:
        text = response.candidates[0].content.parts[0].text.strip()

    if not text:
        raise ValueError("Gemini returned an empty response")

    # Split sentences onto separate lines
    parts = [s.strip() for s in text.split(".") if s.strip()]
    return ".\n".join(parts) + "."


# ── MongoDB write ─────────────────────────────────────────────────────────────

def post_news(db, summary: str) -> None:
    collection = db["news"]
    last = collection.find_one(sort=[("id", -1)])
    next_id = (last["id"] if last else 0) + 1

    doc = {
        "id": next_id,
        "title": "Iran vs Israel",
        "message": summary,
        "date": datetime.now(timezone.utc),
        "priority": "normal",
        "createdAt": datetime.now(timezone.utc),
    }
    collection.insert_one(doc)
    print(f"Inserted news doc with id={next_id}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    print("Connecting to MongoDB…")
    client, db = get_db()

    try:
        # 1. Calculate current stats
        print("Calculating standings and top scorers…")
        standings = calculate_standings(db)
        scorers = calculate_top_scorers(db, top_n=5)

        print("Standings:")
        for s in standings:
            print(f"  #{s['rank']} {s['teamName']} — {s['points']}pts")
        print("Top scorers:")
        for sc in scorers:
            print(f"  {sc['playerName']} ({sc['teamName']}) — {sc['goals']} goals")

        # 2. Load previous snapshot and compare
        last_snapshot = load_last_snapshot(db)
        changes = detect_changes(last_snapshot, standings, scorers)

        if not changes:
            print("No changes detected. Nothing to post.")
            save_snapshot(db, standings, scorers)
            return 0

        print(f"\nDetected {len(changes)} change(s):")
        for c in changes:
            print(f"  • {c}")

        # 3. Summarize via Gemini
        print("\nGenerating Hebrew summary via Gemini…")
        try:
            summary = generate_summary(changes)
        except Exception as e:
            print(f"✗ Failed to generate summary: {e}", file=sys.stderr)
            return 2

        print(f"\nSummary:\n{summary}\n")

        # 4. Post to news feed
        print("Writing to MongoDB news…")
        try:
            post_news(db, summary)
        except Exception as e:
            print(f"✗ Failed to write news: {e}", file=sys.stderr)
            return 3

        # 5. Save new snapshot
        save_snapshot(db, standings, scorers)
        print("✓ Stats tracked and news posted successfully!")
        return 0

    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
