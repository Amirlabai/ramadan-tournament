"""
Daily Iran-Israel News Generator
Searches for the latest Iran vs Israel news, summarizes it in Hebrew
using Gemini (free tier), then writes directly to MongoDB.
"""

import os
import sys
import json
import urllib.request
import urllib.parse
from datetime import datetime, timezone


# ── Helpers ──────────────────────────────────────────────────────────────────

def search_news(query: str, max_results: int = 5) -> list[str]:
    """
    Fetch recent headlines via DuckDuckGo Instant Answer API.
    Falls back to an empty list on any error so the script degrades gracefully.
    """
    snippets = []
    try:
        params = urllib.parse.urlencode({
            "q": query,
            "format": "json",
            "no_html": "1",
            "skip_disambig": "1",
        })
        url = f"https://api.duckduckgo.com/?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())

        # RelatedTopics contain recent results
        for topic in data.get("RelatedTopics", [])[:max_results]:
            text = topic.get("Text", "").strip()
            if text:
                snippets.append(text)

        # Also grab the Abstract if there is one
        abstract = data.get("AbstractText", "").strip()
        if abstract:
            snippets.insert(0, abstract)

    except Exception as e:
        print(f"Warning: DuckDuckGo search failed: {e}", file=sys.stderr)

    return snippets


def summarize_in_hebrew(snippets: list[str]) -> str:
    """
    Ask Gemini (free tier via REST) to summarize the snippets in Hebrew.
    Returns the Hebrew summary string.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")

    context = "\n".join(f"- {s}" for s in snippets) if snippets else "אין מידע חדש זמין."

    prompt = (
        "אתה עיתונאי ישראלי. "
        "סכם את הידיעות הבאות על המתח בין ישראל לאיראן בעברית שוטפת ותמציתית, "
        "2-4 משפטים. אל תתחיל ב'בטח' או ב'כמובן'. כתוב ישירות את הסיכום.\n\n"
        f"ידיעות:\n{context}"
    )

    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}]
    }).encode()

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent?key={api_key}"
    )
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read().decode())

    text = (
        result["candidates"][0]["content"]["parts"][0]["text"].strip()
    )
    if not text:
        raise ValueError("Gemini returned an empty response")
    return text


def post_news_to_mongo(summary: str) -> None:
    """Write the news item directly to MongoDB."""
    from pymongo import MongoClient

    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise ValueError("MONGODB_URI environment variable is not set")

    client = MongoClient(uri, serverSelectionTimeoutMS=10000)
    db = client.get_default_database()  # database name is part of the URI

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    collection = db["news"]

    # Remove any existing Iran vs Israel entry for today to avoid duplicates
    collection.delete_many({"title": "Iran vs Israel", "date": {"$regex": f"^{today_str}"}})

    # Determine next id
    last = collection.find_one(sort=[("id", -1)])
    next_id = (last["id"] if last else 0) + 1

    doc = {
        "id": next_id,
        "title": "Iran vs Israel",
        "message": summary,
        "date": datetime.now(timezone.utc),
        "priority": "high",
        "createdAt": datetime.now(timezone.utc),
    }
    collection.insert_one(doc)
    print(f"Inserted news doc with id={next_id}")
    client.close()


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    # 1. Search for news
    print("Searching for latest Iran-Israel news…")
    snippets = search_news("Iran Israel latest news 2026", max_results=6)
    print(f"Found {len(snippets)} snippet(s).")

    # 2. Summarize in Hebrew
    print("Generating Hebrew summary via Gemini…")
    try:
        summary = summarize_in_hebrew(snippets)
    except Exception as e:
        print(f"✗ Failed to generate summary: {e}", file=sys.stderr)
        return 2

    print(f"\nHebrew summary:\n{summary}\n")

    # 3. Write directly to MongoDB
    print("Writing to MongoDB…")
    try:
        post_news_to_mongo(summary)
    except Exception as e:
        print(f"✗ Failed to write to MongoDB: {e}", file=sys.stderr)
        return 3

    print("✓ News posted successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
