// A small markdown renderer for agent text. It builds elements, never HTML strings, so transcript
// content cannot inject markup. Links render as text with their URL (relative/file links stay inert).
import type { ComponentChildren } from 'preact'

function inline(text: string): ComponentChildren[] {
  const out: ComponentChildren[] = []
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0]
    if (m[1]) out.push(<code>{t.slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong>{t.slice(2, -2)}</strong>)
    else if (m[3]) out.push(<em>{t.slice(1, -1)}</em>)
    else if (m[4]) out.push(<a href={m[5]} target="_blank" rel="noopener noreferrer">{t.slice(1, t.indexOf(']'))}</a>)
    last = m.index + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: ComponentChildren[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (line.startsWith('```')) {
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i]!.startsWith('```')) body.push(lines[i++]!)
      i++
      blocks.push(<pre class="md-code">{body.join('\n')}</pre>)
      continue
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) {
      blocks.push(<p class={`md-h md-h${h[1]!.length}`}>{inline(h[2]!)}</p>)
      i++
      continue
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: ComponentChildren[] = []
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) {
        items.push(<li>{inline(lines[i]!.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>)
        i++
      }
      blocks.push(ordered ? <ol>{items}</ol> : <ul>{items}</ul>)
      continue
    }
    if (!line.trim()) {
      i++
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i]!.trim() && !/^(```|#{1,4}\s|\s*([-*]|\d+\.)\s)/.test(lines[i]!)) para.push(lines[i++]!)
    blocks.push(<p>{inline(para.join(' '))}</p>)
  }
  return <>{blocks}</>
}
