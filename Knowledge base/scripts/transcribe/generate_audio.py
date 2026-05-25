#!/usr/bin/env python3
"""
generate_audio.py — Convert a 2-speaker podcast script to MP3 using Magpie TTS (NVIDIA NIM).

Usage:
    python scripts/transcribe/generate_audio.py <script_file> <output_mp3>

Script format expected:
    [ALEX]: Hello, welcome to the show...
    [SAM]: Thanks Alex, today we're talking about...

Voice roles:
    ALEX = male   (explainer)  — default: Magpie-Multilingual.EN-US.Male.Neutral
    SAM  = female (questioner) — default: Magpie-Multilingual.EN-US.Female.Neutral

Override voices via env vars: MAGPIE_VOICE_MALE, MAGPIE_VOICE_FEMALE
Full voice list: https://docs.nvidia.com/deeplearning/riva/user-guide/docs/tts/tts-overview.html

Requirements:
    NVIDIA_API_KEY in .env  (free tier at https://build.nvidia.com)
    ffmpeg on PATH

Orpheus upgrade path (GPU, high quality):
    Set ORPHEUS_API_URL=http://localhost:5005 in .env
    Requires: ollama pull legraphista/Orpheus:3b-ft-q4_k_m + Orpheus-FastAPI server
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request


# ── Load .env if present (for direct Python invocations) ─────────────────────
def _load_dotenv() -> None:
    """Minimal .env loader — does not override existing env vars."""
    dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env")
    if not os.path.isfile(dotenv_path):
        return
    with open(dotenv_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            if key.strip() and key.strip() not in os.environ:
                os.environ[key.strip()] = val.strip()


_load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
# Magpie TTS voice names — override via MAGPIE_VOICE_MALE / MAGPIE_VOICE_FEMALE env vars.
# Available EN-US voices: Male.Neutral, Male.Male-1, Male.Calm, Male.Happy, Male.Angry,
#                         Female.Neutral, Female.Female-1, Female.Calm, Female.Happy, Female.Angry
MAGPIE_VOICE_MALE   = os.environ.get("MAGPIE_VOICE_MALE",   "Magpie-Multilingual.EN-US.Male.Neutral")
MAGPIE_VOICE_FEMALE = os.environ.get("MAGPIE_VOICE_FEMALE", "Magpie-Multilingual.EN-US.Female.Neutral")

# ALEX = male (explainer), SAM = female (questioner)
VOICES = {
    "ALEX": MAGPIE_VOICE_MALE,    # male voice — explainer role
    "SAM":  MAGPIE_VOICE_FEMALE,  # female voice — questioner role
}

ORPHEUS_VOICES = {
    "ALEX": "tara",  # Orpheus voice when ORPHEUS_API_URL is set
    "SAM":  "leo",
}

MAGPIE_MODEL    = "nvidia/magpie-tts-multilingual"
MAGPIE_BASE_URL = "https://integrate.api.nvidia.com"

# ── Parse dialogue ────────────────────────────────────────────────────────────
def parse_dialogue(script_text: str) -> list[tuple[str, str]]:
    """Parse [SPEAKER]: text lines into (speaker, text) list."""
    segments: list[tuple[str, str]] = []
    current_speaker: str | None     = None
    current_lines:   list[str]      = []

    for line in script_text.splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.match(r"^\[(ALEX|SAM)\]:\s*(.*)", line, re.IGNORECASE)
        if m:
            if current_speaker and current_lines:
                segments.append((current_speaker, " ".join(current_lines)))
            current_speaker = m.group(1).upper()
            current_lines   = [m.group(2).strip()]
        elif current_speaker:
            current_lines.append(line)

    if current_speaker and current_lines:
        segments.append((current_speaker, " ".join(current_lines)))

    return segments

# ── Magpie TTS (NVIDIA NIM) ───────────────────────────────────────────────────
def tts_segment_magpie(text: str, voice: str, out_path: str, api_key: str) -> None:
    """Generate audio using Magpie TTS via NVIDIA NIM REST API.

    Voice list: https://docs.nvidia.com/deeplearning/riva/user-guide/docs/tts/tts-overview.html
    EN-US Magpie voices: Male.Neutral, Male.Male-1, Male.Calm, Male.Happy, Male.Angry, Male.Fearful,
                         Female.Neutral, Female.Female-1, Female.Calm, Female.Happy, Female.Angry, Female.Fearful
    """
    payload = json.dumps({
        "model": MAGPIE_MODEL,
        "input": text,
        "voice": voice,
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{MAGPIE_BASE_URL}/v1/audio/speech",
        data=payload,
        headers={
            "Content-Type":  "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            audio_data = resp.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Magpie TTS HTTP {e.code}: {body[:400]}") from e

    # Magpie returns WAV — convert to MP3 via ffmpeg
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_data)
        tmp_wav = tmp.name

    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", tmp_wav, "-q:a", "4", out_path],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    finally:
        os.unlink(tmp_wav)

# ── Orpheus TTS (optional, GPU) ───────────────────────────────────────────────
def tts_segment_orpheus(text: str, voice: str, out_path: str, api_url: str) -> None:
    """Generate audio using Orpheus-FastAPI (requires GPU + Orpheus-FastAPI server)."""
    payload = json.dumps({"text": text, "voice": voice}).encode("utf-8")
    req = urllib.request.Request(
        f"{api_url.rstrip('/')}/v1/audio/speech",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        audio_data = resp.read()

    # Orpheus returns WAV — convert to MP3 for consistency
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_data)
        tmp_wav = tmp.name

    subprocess.run(
        ["ffmpeg", "-y", "-i", tmp_wav, "-q:a", "4", out_path],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    os.unlink(tmp_wav)

# ── Concatenate MP3 files ─────────────────────────────────────────────────────
def concat_mp3(segment_files: list[str], output: str) -> None:
    """Use ffmpeg to concatenate segment MP3 files into final output."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
        for fp in segment_files:
            # ffmpeg concat uses forward slashes; escape apostrophes
            fp_escaped = fp.replace("\\", "/").replace("'", r"\'")
            f.write(f"file '{fp_escaped}'\n")
        list_file = f.name

    try:
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-f", "concat", "-safe", "0",
                "-i", list_file,
                "-c:a", "libmp3lame", "-q:a", "4",
                output,
            ],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode("utf-8", errors="replace") if e.stderr else ""
        raise RuntimeError(f"ffmpeg concat failed:\n{stderr}") from e
    finally:
        os.unlink(list_file)

# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <script_file> <output_mp3>")
        sys.exit(1)

    script_file = sys.argv[1]
    output_mp3  = sys.argv[2]

    # Validate inputs
    if not os.path.isfile(script_file):
        print(f"[audio] ERROR: Script file not found: {script_file}")
        sys.exit(1)

    script_text = open(script_file, encoding="utf-8").read()
    segments    = parse_dialogue(script_text)

    if not segments:
        print(f"[audio] ERROR: No [ALEX]/[SAM] dialogue found in {script_file}")
        sys.exit(1)

    print(f"[audio] {len(segments)} dialogue segments found")

    # Detect TTS backend: Orpheus (GPU) > Magpie TTS (NVIDIA NIM) > error
    orpheus_url = os.environ.get("ORPHEUS_API_URL", "").strip()
    nvidia_key  = os.environ.get("NVIDIA_API_KEY",  "").strip()
    use_orpheus = bool(orpheus_url)

    if use_orpheus:
        print(f"[audio] Using Orpheus TTS at {orpheus_url}")
    elif nvidia_key:
        print(f"[audio] Using Magpie TTS (NVIDIA NIM) — model: {MAGPIE_MODEL}")
        print(f"[audio]   ALEX voice (male):   {VOICES['ALEX']}")
        print(f"[audio]   SAM  voice (female): {VOICES['SAM']}")
    else:
        print("[audio] ERROR: NVIDIA_API_KEY not set — cannot generate podcast audio.")
        print("  Get a free API key at: https://build.nvidia.com")
        print("  Add NVIDIA_API_KEY=<your-key> to your .env file")
        sys.exit(1)

    # Generate each segment into a temp file
    os.makedirs(os.path.dirname(os.path.abspath(output_mp3)), exist_ok=True)
    tmp_dir   = tempfile.mkdtemp(prefix="kb_podcast_")
    seg_files = []

    try:
        for i, (speaker, text) in enumerate(segments):
            seg_path = os.path.join(tmp_dir, f"seg_{i:04d}.mp3")
            print(f"[audio]   {i+1:2d}/{len(segments)} [{speaker}] {text[:60]}…")

            if use_orpheus:
                voice = ORPHEUS_VOICES.get(speaker, "tara")
                tts_segment_orpheus(text, voice, seg_path, orpheus_url)
            else:
                voice = VOICES.get(speaker, VOICES["ALEX"])
                tts_segment_magpie(text, voice, seg_path, nvidia_key)

            seg_files.append(seg_path)

        print(f"[audio] Concatenating {len(seg_files)} segments → {output_mp3}")
        concat_mp3(seg_files, output_mp3)
        size_kb = os.path.getsize(output_mp3) // 1024
        print(f"[audio] ✓ Done — {size_kb} KB saved to {output_mp3}")

    finally:
        # Clean up temp segment files
        for fp in seg_files:
            try: os.unlink(fp)
            except OSError: pass
        try: os.rmdir(tmp_dir)
        except OSError: pass


if __name__ == "__main__":
    main()
