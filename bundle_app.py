"""Bundle src/ into the root index.html without third-party build tools."""
from pathlib import Path
import re


def bundle():
    root = Path(__file__).resolve().parent
    src_dir = root / 'src'
    html = (src_dir / 'index.html').read_text(encoding='utf-8')
    css = (src_dir / 'styles.css').read_text(encoding='utf-8')
    js_files = ['config.js', 'audio.js', 'world.js', 'vehicles.js', 'ui-hud.js', 'leaderboard.js', 'physics-main.js']
    bundled_js_parts = []
    for filename in js_files:
        content = (src_dir / filename).read_text(encoding='utf-8')
        bundled_js_parts.append(
            '\n// =========================================================================\n'
            f'// MODULE: {filename}\n'
            '// =========================================================================\n' + content
        )
    bundled_js = '\n'.join(bundled_js_parts)
    html, css_count = re.subn(
        r'<link\s+rel=["\']stylesheet["\']\s+href=["\']styles\.css["\']\s*/?>',
        lambda match: f'<style>\n{css}\n</style>',
        html,
    )
    html, js_count = re.subn(
        r'<!-- Modular Functional Scripts -->\s*(<script\s+src=["\'][^"\']+["\']></script>\s*)+',
        lambda match: f'<!-- Modular Functional Scripts -->\n  <script>\n{bundled_js}\n  </script>',
        html,
    )
    if css_count != 1 or js_count != 1:
        raise ValueError('Expected exactly one CSS link and one modular scripts block')
    out_html = root / 'index.html'
    out_html.write_text(html, encoding='utf-8')
    print(f'Bundled {out_html.name}: {len(html)} chars')


if __name__ == '__main__':
    bundle()
