"""
Daily Iran-Israel News Generator
Fetches headlines from news RSS feeds, summarizes in Hebrew via Gemini,
then writes directly to MongoDB.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone


# ── News fetching via RSS ─────────────────────────────────────────────────────

RSS_FEEDS = [
    # BBC Middle East
    "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml",
    # Reuters world
    "https://feeds.reuters.com/reuters/worldNews",
    # Jerusalem Post
    "https://www.jpost.com/rss/rssfeedsheadlines.aspx",
    # Times of Israel
    "https://www.timesofisrael.com/feed/",
]

KEYWORDS = {"iran", "israel", "iranian", "israeli", "idf", "irgc", "teheran",
            "tehran", "jerusalem", "netanyahu", "khamenei"}


def fetch_rss_headlines(max_total: int = 8) -> list[str]:
    """Pull headlines from RSS feeds, keeping only Iran/Israel-related items."""
    headlines = []
    for url in RSS_FEEDS:
        if len(headlines) >= max_total:
            break
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw = resp.read()
            root = ET.fromstring(raw)
            # RSS items live under channel/item
            for item in root.iter("item"):
                title_el = item.find("title")
                desc_el = item.find("description")
                title = (title_el.text or "").strip()
                desc = (desc_el.text or "").strip()
                combined = f"{title} {desc}".lower()
                if any(kw in combined for kw in KEYWORDS):
                    headline = title if title else desc[:120]
                    if headline and headline not in headlines:
                        headlines.append(headline)
                        if len(headlines) >= max_total:
                            break
        except Exception as e:
            print(f"Warning: RSS fetch failed for {url}: {e}", file=sys.stderr)

    return headlines


# ── Gemini summarizer with retry ──────────────────────────────────────────────

def summarize_in_hebrew(snippets: list[str], max_retries: int = 3) -> str:
    """Summarize snippets in Hebrew using Gemini free tier. Retries on 429."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")

    context = "\n".join(f"- {s}" for s in snippets) if snippets else "אין כותרות חדשות זמינות."

    prompt = (
        "אתה עיתונאי ישראלי. "
        "סכם את הכותרות הבאות על המתחים בין ישראל לאיראן בעברית שוטפת ותמציתית — "
        "2 עד 4 משפטים בלבד. כתוב ישירות, ללא הקדמות.\n\n"
        f"כותרות:\n{context}"
    )

    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}]
    }).encode()

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent?key={api_key}"
    )

    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode())
            text = result["candidates"][0]["content"]["parts"][0]["text"].strip()
            if not text:
                raise ValueError("Gemini returned an empty response")
            return text

        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 2 ** attempt * 15  # 30s, 60s, 120s
                print(f"Gemini 429 — waiting {wait}s before retry {attempt}/{max_retries}…",
                      file=sys.stderr)
                time.sleep(wait)
            else:
                raise
        except Exception:
            raise

    raise RuntimeError(f"Gemini still rate-limited after {max_retries} retries")


# ── MongoDB write ─────────────────────────────────────────────────────────────

def post_news_to_mongo(summary: str) -> None:
    """Write the news item directly to MongoDB."""
    from pymongo import MongoClient

    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise ValueError("MONGODB_URI environment variable is not set")

    client = MongoClient(uri, serverSelectionTimeoutMS=10000)
    db = client.get_default_database()

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    collection = db["news"]

    # Remove today's existing entry to avoid duplicates
    collection.delete_many({"title": "Iran vs Israel", "date": {"$regex": f"^{today_str}"}})

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
    client.close()


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    # 1. Fetch RSS headlines
    print("Fetching Iran-Israel headlines from RSS feeds…")
    snippets = fetch_rss_headlines(max_total=8)
    print(f"Found {len(snippets)} relevant headline(s).")
    for s in snippets:
        print(f"  • {s}")

    # 2. Summarize in Hebrew
    print("\nGenerating Hebrew summary via Gemini…")
    try:
        summary = summarize_in_hebrew(snippets)
    except Exception as e:
        print(f"✗ Failed to generate summary: {e}", file=sys.stderr)
        return 2

    print(f"\nHebrew summary:\n{summary}\n")

    # 3. Write to MongoDB
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
