"""Fetch the font the renderer loads (it is not in the repository) and verify it.

    python app/public/fonts/fetch.py

IBM Plex Mono, six files, from the google/fonts repository at one pinned commit, so they are the files the video
was rendered with, byte for byte (each download is checked against its SHA-256). They land in src/ with the
licence text (SIL Open Font License). Re-running skips what is already in place. Total download: about 0.6 MB.
"""
import hashlib
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / 'src'
PIN = '7085eb89a950e85db5b166b7a58d414544b4140c'  # google/fonts, 2026-10-05
RAW = f'https://raw.githubusercontent.com/google/fonts/{PIN}/ofl/ibmplexmono'

# (file, sha256 of the file the video was rendered with)
FILES = [
    ('IBMPlexMono-Light.ttf', '780bcf65509d72a35ec114b57bcbe220dc6b77d8ea2e9b25e294be3c570c5025'),
    ('IBMPlexMono-Regular.ttf', '6a3412f058c7d8dfd9170c41e85ade48e5156ecb89356110ca57a0a27734af46'),
    ('IBMPlexMono-Medium.ttf', 'a9b4c49bb299e05b5f6c481e7fb5e78943d2793249a0c8874ab574a2d1ea6755'),
    ('IBMPlexMono-SemiBold.ttf', 'd3c38e55c78f5b0f28009fddba4834ec503278936a5986032424c9bd2d23aa46'),
    ('IBMPlexMono-Bold.ttf', 'ac27abd6450a64dd94467580a02fe6235156d5b92f2926ebbc8e7489df64e0be'),
    ('IBMPlexMono-Italic.ttf', '3362fc791b0652193328b862c1c5f23a789bc7288b1617fa63302f88689a2a34'),
]


def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def fetch(url: str, dest: Path):
    req = urllib.request.Request(url, headers={'User-Agent': 'still-alive fonts/1.0'})
    with urllib.request.urlopen(req, timeout=120) as r:
        dest.write_bytes(r.read())


def main():
    SRC.mkdir(parents=True, exist_ok=True)
    for name, want in FILES:
        dest = SRC / name
        if dest.exists() and sha256(dest) == want:
            print(f'  have   src/{name}')
            continue
        print(f'  fetch  src/{name}')
        fetch(f'{RAW}/{name}', dest)
        got = sha256(dest)
        if got != want:
            dest.unlink()
            sys.exit(f'{name}: SHA-256 {got} is not the expected {want}; nothing kept')
    lic = SRC / 'OFL.txt'
    if not lic.exists():
        print('  fetch  src/OFL.txt')
        fetch(f'{RAW}/OFL.txt', lic)
    print('font in place')


if __name__ == '__main__':
    main()
