#!/usr/bin/env python3
"""
download_video.py — download a video from a URL (X/Twitter or YouTube)
using yt-dlp and save it to the transcripts working directory.

Usage:
  python scripts/transcribe/download_video.py <url> <output_path_no_ext>

Output:
  Downloads the best available audio-only stream (or video if audio-only
  unavailable) to <output_path_no_ext>.m4a (or .mp3 / .webm).
  Prints the final downloaded file path to stdout on the last line.

Exit codes:
  0 = success
  1 = download failed
"""

import sys
import os
import subprocess
import json

def main():
    if len(sys.argv) < 3:
        print("Usage: download_video.py <url> <output_path_no_ext>", file=sys.stderr)
        sys.exit(1)

    url         = sys.argv[1]
    output_base = sys.argv[2]  # e.g. data/transcripts/tmp/1234567890

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_base) or ".", exist_ok=True)

    # yt-dlp command: prefer audio-only (smaller, faster), fallback to best
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--format", "bestaudio/best",
        "--output", f"{output_base}.%(ext)s",
        "--quiet",
        "--print", "after_move:filepath",  # prints final path after download
        url,
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    except subprocess.TimeoutExpired:
        print(f"[download] ERROR: yt-dlp timed out after 5 min", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print("[download] ERROR: yt-dlp not found. Install with: pip install yt-dlp", file=sys.stderr)
        sys.exit(1)

    if result.returncode != 0:
        print(f"[download] ERROR: yt-dlp exit {result.returncode}", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        sys.exit(1)

    # yt-dlp --print after_move:filepath prints the final file path
    downloaded_path = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ""

    if not downloaded_path or not os.path.exists(downloaded_path):
        # Fallback: glob for any file matching the base
        import glob
        matches = glob.glob(f"{output_base}.*")
        if matches:
            downloaded_path = matches[0]
        else:
            print(f"[download] ERROR: could not find downloaded file at {output_base}.*", file=sys.stderr)
            sys.exit(1)

    # Print the path so Node.js wrapper can capture it
    print(downloaded_path)

if __name__ == "__main__":
    main()
