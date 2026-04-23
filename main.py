import requests
import json
import os
from config import subreddits

OUTPUT_FILE = "posts.json"
limit = 100
headers = {"User-Agent": "my-scraper/0.1"}

def slim_post(post_data):
    preview = post_data.get("preview", {}).get("images", [{}])[0]
    return {
        "id": post_data["id"],
        "title": post_data["title"],
        "url": post_data["url"],
        "score": post_data["score"],
        "author": post_data["author"],
        "created_utc": post_data["created_utc"],
        "permalink": post_data["permalink"],
        "subreddit": post_data["subreddit"],
        "preview": {
            "images": [{
                "source": preview.get("source"),
                "resolutions": preview.get("resolutions"),
            }]
        }
    }

# Load existing data or start fresh
if os.path.exists(OUTPUT_FILE):
    with open(OUTPUT_FILE, "r") as f:
        all_posts = json.load(f)
else:
    all_posts = []

# Build a set of existing IDs for O(1) lookup
seen_ids = {post["id"] for post in all_posts}
new_count = 0

for subreddit in subreddits:
    print(f"\nScraping r/{subreddit}...")
    after = None  # reset pagination for each subreddit

    for i in range(10):
        url = f"https://www.reddit.com/r/{subreddit}.json?limit={limit}"
        if after:
            url += f"&after={after}"

        res = requests.get(url, headers=headers)
        res.raise_for_status()
        data = res.json()

        posts = data["data"]["children"]
        batch_new = 0

        for post in posts:
            post_data = post["data"]
            if post_data.get("post_hint") == "image" and post_data["id"] not in seen_ids:
                all_posts.append(slim_post(post_data))
                seen_ids.add(post_data["id"])
                new_count += 1
                batch_new += 1

        after = data["data"]["after"]

        # Write after every batch so progress isn't lost if it crashes
        with open(OUTPUT_FILE, "w") as f:
            json.dump(all_posts, f, indent=2)

        print(f"  Batch {i+1} done — {batch_new} new posts, {len(all_posts)} total")

        if batch_new == 0 or not after:
            break

print(f"\nDone. {new_count} new posts added, {len(all_posts)} total saved to {OUTPUT_FILE}")