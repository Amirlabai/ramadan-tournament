"""
Daily Iran-Israel News Generator
Fetches headlines from news RSS feeds, summarizes in Hebrew via Gemini,
then writes directly to MongoDB.
"""

import os
import sys
import time
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
import google.generativeai as genai
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

def summarize_in_hebrew(snippets: list[str]) -> str:
    """Summarize snippets in Hebrew using Gemini SDK (handles rate limits internally)."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    context = "\n".join(f"- {s}" for s in snippets) if snippets else "אין כותרות חדשות זמינות."

    prompt = (
        "אתה עיתונאי ישראלי. "
        "סכם את הכותרות הבאות על המתחים בין ישראל לאיראן בעברית שוטפת ותמציתית — "
        "2 עד 4 משפטים בלבד. כתוב ישירות, ללא הקדמות.\n\n"
        "מנהיג העליון של איראן נהרג כבר בתחילת המלחמה כבר."
        f"כותרות:\n{context}"
    )

    response = model.generate_content(prompt)

    def _split_sentences(text: str) -> str:
        parts = [s.strip() for s in text.split(".") if s.strip()]
        return ".\n".join(parts) + "."

    if hasattr(response, "text") and response.text:
        return _split_sentences(response.text.strip())
    if hasattr(response, "candidates") and response.candidates:
        return _split_sentences(response.candidates[0].content.parts[0].text.strip())

    raise ValueError("Gemini returned an empty response")


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
