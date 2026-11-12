"""Generate the site's Listening audio with Kokoro-82M (Apache-2.0), an open neural TTS.

Reads tts/segments.json ([{v, t}, ...]) and writes audio/<sha1>.mp3 plus audio/manifest.json
mapping "v|t" -> file, which index.html plays segment by segment. Existing files are kept,
so re-runs only render new segments. Phonemes are logged to tts/phonemes.txt for review.
"""
import hashlib, json, os, re, subprocess, sys
import numpy as np
import soundfile as sf
from kokoro import KPipeline

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "audio")
SEGS = json.load(open(os.path.join(ROOT, "tts", "segments.json"), encoding="utf-8"))

# site role -> (Kokoro voice, pipeline language: a = American, b = British)
VOICES = {
    "glassy":  ("af_bella", "a"),   # narrator: Part 1, the letters A-D
    "buttery": ("am_michael", "a"), # Part 2 questions, Part 4 talks
    "airy":    ("af_heart", "a"),   # women in Part 3, Part 2 answers
    "rounded": ("bm_george", "b"),  # men in Part 3 (British accent, like the real test's mix)
}
# Letter names spelled as phonemes so "A." is never read as the article "uh".
LETTERS = {"A": "[A](/ˈA/)", "B": "[B](/bˈi/)", "C": "[C](/sˈi/)", "D": "[D](/dˈi/)"}

pipes = {}
def pipe(lang):
    if lang not in pipes:
        pipes[lang] = KPipeline(lang_code=lang, repo_id="hexgrad/Kokoro-82M")
    return pipes[lang]

def fname(v, t):
    return hashlib.sha1((v + "|" + t).encode("utf-8")).hexdigest()[:12] + ".mp3"

def prepare(t):
    m = re.fullmatch(r"([A-D])\.", t)
    return LETTERS[m.group(1)] + "." if m else t

os.makedirs(OUT, exist_ok=True)
manifest, log, made = {}, [], 0
for s in SEGS:
    v, t = s["v"], s["t"]
    f = fname(v, t); path = os.path.join(OUT, f)
    manifest[v + "|" + t] = f
    if os.path.exists(path) and os.path.getsize(path) > 0:
        continue
    voice, lang = VOICES[v]
    chunks, phon = [], []
    for _, ps, audio in pipe(lang)(prepare(t), voice=voice, speed=1.0):
        phon.append(ps)
        if audio is not None:
            chunks.append(audio.numpy() if hasattr(audio, "numpy") else np.asarray(audio))
    if not chunks:
        print("no audio for", repr(t)); sys.exit(1)
    pad = np.zeros(int(24000 * 0.08), dtype=np.float32)
    wav = np.concatenate([pad] + chunks + [pad])
    tmp = path[:-4] + ".wav"
    sf.write(tmp, wav, 24000)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", tmp, "-ac", "1", "-codec:a", "libmp3lame", "-q:a", "5", path], check=True)
    os.remove(tmp)
    log.append("%s\t%s\t%s\t%s" % (f, voice, t, " | ".join(phon)))
    made += 1
    print("[%d] %s %s" % (made, voice, t[:70]), flush=True)

with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, ensure_ascii=False)
if log:
    with open(os.path.join(ROOT, "tts", "phonemes.txt"), "a", encoding="utf-8") as fh:
        fh.write("\n".join(log) + "\n")
print("done: %d new, %d total" % (made, len(manifest)))
