"""Inline design/src into one self-contained HTML file per option: design/option-{a,b,c}/index.html.
Run: python3 -I design/build.py"""
import pathlib, re

root = pathlib.Path(__file__).resolve().parent
src = root / 'src'
content = (src / 'content.js').read_text()
status = re.search(r"const STATUS_BAR = `(.*?)`", content, re.S).group(1)
for opt in 'abc':
    html = (src / f'option-{opt}.html').read_text()
    html = html.replace('/*@include world.css*/', (src / 'world.css').read_text())
    html = html.replace('//@include content.js', content)
    html = html.replace('<!--@status-->', status)
    out = root / f'option-{opt}' / 'index.html'
    out.parent.mkdir(exist_ok=True)
    out.write_text(html)
    print(out.relative_to(root.parent), len(html), 'bytes')
