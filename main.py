import requests
import json
import os
from config import subreddits, ur
import browser_cookie3

OUTPUT_FILE = "posts.json"
limit = 100

cookies = browser_cookie3.chrome(domain_name='.reddit.com')

session = requests.Session()
session.cookies.update(cookies)
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/124.0.0.0 Safari/537.36"
})


def extract_gallery_images(post_data):
    """
    Returns a list of normalized 'image post' dicts
    derived from a Reddit gallery post.
    """
    images = []

    media_metadata = post_data.get("media_metadata") or {}
    gallery_data = post_data.get("gallery_data") or {}

    for idx, item in enumerate(gallery_data.get("items", [])):
        media_id = item.get("media_id")
        if not media_id:
            continue

        media = media_metadata.get(media_id)
        if not media:
            continue

        source = media.get("s") or {}
        if not source:
            continue

        resolutions = media.get("p") or []

        images.append({
            "id": f"{post_data['id']}_{idx}",
            "title": post_data.get("title", ""),
            "url": source.get("u", "").replace("&amp;", "&"),
            "score": post_data.get("score", 0),
            "author": post_data.get("author", ""),
            "created_utc": post_data.get("created_utc", 0),
            "permalink": post_data.get("permalink", ""),
            "subreddit": post_data.get("subreddit", ""),
            "preview": {
                "images": [{
                    "source": {
                        "url": source.get("u", "").replace("&amp;", "&"),
                        "width": source.get("x"),
                        "height": source.get("y"),
                    },
                    "resolutions": [
                        {
                            "url": r.get("u", "").replace("&amp;", "&"),
                            "width": r.get("x"),
                            "height": r.get("y"),
                        }
                        for r in resolutions
                    ]
                }]
            }
        })

    return images


def slim_post(post_data):
    """
    Normal (non-gallery) image post.
    Returns a single normalized item.
    """

    preview_images = []

    preview = post_data.get("preview", {}).get("images", [{}])[0]

    if preview:
        preview_images.append({
            "source": preview.get("source"),
            "resolutions": preview.get("resolutions"),
        })

    return {
        "id": post_data["id"],
        "title": post_data.get("title", ""),
        "url": post_data.get("url", ""),
        "score": post_data.get("score", 0),
        "author": post_data.get("author", ""),
        "created_utc": post_data.get("created_utc", 0),
        "permalink": post_data.get("permalink", ""),
        "subreddit": post_data.get("subreddit", ""),
        "preview": {
            "images": preview_images
        }
    }


# Load existing data or start fresh
if os.path.exists(OUTPUT_FILE):
    with open(OUTPUT_FILE, "r") as f:
        all_posts = json.load(f)
else:
    all_posts = []

seen_ids = {post["id"] for post in all_posts}
new_count = 0


for subreddit in subreddits:
    print(f"\nScraping {ur}/{subreddit}...")
    after = None

    for i in range(10):
        url = f"https://www.reddit.com/{ur}/{subreddit}.json?limit={limit}"
        if after:
            url += f"&after={after}"

        res = session.get(url)
        res.raise_for_status()
        data = res.json()

        posts = data["data"]["children"]
        batch_new = 0

        for post in posts:
            post_data = post["data"]
            post_id = post_data.get("id")

            is_gallery = post_data.get("is_gallery") is True
            is_image_post = (
                post_data.get("post_hint") == "image"
                or is_gallery
            )

            if not is_image_post:
                continue

            # -------------------------
            # HANDLE GALLERIES
            # -------------------------
            if is_gallery:
                images = extract_gallery_images(post_data)

                for img in images:
                    if img["id"] in seen_ids:
                        continue

                    all_posts.append(img)
                    seen_ids.add(img["id"])
                    new_count += 1
                    batch_new += 1

                continue

            # -------------------------
            # HANDLE SINGLE IMAGE POST
            # -------------------------
            if post_id in seen_ids:
                continue

            all_posts.append(slim_post(post_data))
            seen_ids.add(post_id)
            new_count += 1
            batch_new += 1

        after = data["data"]["after"]

        # Persist after each batch
        with open(OUTPUT_FILE, "w") as f:
            json.dump(all_posts, f, indent=2)

        print(f"  Batch {i+1} done — {batch_new} new items, {len(all_posts)} total")

        if batch_new == 0 or not after:
            break


print(f"\nDone. {new_count} new images added, {len(all_posts)} total saved to {OUTPUT_FILE}")
