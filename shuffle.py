import json
import os
import random

OUTPUT_FILE = "posts.json"

def shuffle_posts():
    if not os.path.exists(OUTPUT_FILE):
        print("posts.json not found")
        return

    with open(OUTPUT_FILE, "r") as f:
        posts = json.load(f)

    random.shuffle(posts)

    with open(OUTPUT_FILE, "w") as f:
        json.dump(posts, f, indent=2)

    print(f"Shuffled {len(posts)} posts in {OUTPUT_FILE}")

if __name__ == "__main__":
    shuffle_posts()