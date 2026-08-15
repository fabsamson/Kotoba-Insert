# Kotoba Insert

Kotoba Insert is an English-language Obsidian plugin for quickly inserting Japanese vocabulary from an offline JMdict-derived dictionary.

## Features

- Search a local Japanese dictionary and insert selected meanings with a Markdown template.
- Insert verified per-kanji or word-group furigana when the dictionary provides an alignment.
- Read Kotoba Insert furigana directly in Reading view and Live Preview. In the editor, furigana renders above the kanji until you place the cursor on that token, when the editable `{word|reading}` source is shown.

## V1 workflow

1. Install the dictionary from **Settings → Kotoba Insert**.
2. Add **Kotoba Insert: Search and insert Japanese vocabulary** to Obsidian's mobile toolbar, or run it from the command palette.
3. Search any complete or partial Japanese written form, reading, or alternate form.
4. Select one entry, one or more senses, and a Markdown template from your configured vault folder.
5. Insert the rendered result at the editor cursor.

The default template is:

```md
{{word_with_furigana}} — {{english_definitions}}
```

Kotoba Insert renders `{word|reading}` itself, so no separate Furigana plugin is required. When the installed dictionary contains an exact JmdictFurigana match for the selected written form and reading, `{{word_with_furigana}}` uses aligned segments instead: `{食|た}べる`. It otherwise safely falls back to `{食べる|たべる}`.

## Template fields

`word`, `reading`, `word_with_furigana`, `english_definitions`, `english_definition_1`, `part_of_speech`, `alternate_forms`, `priority`, `commonness`, `cross_references`, `antonyms`, `field_tags`, `usage_tags`, and `sense_notes`.

Multi-sense values are semicolon-separated. An absent optional field becomes an empty string.

## Privacy and data source

Lookups are local after installation. The plugin sends neither note content nor search terms to a server. See [PRIVACY.md](PRIVACY.md) and [NOTICE.md](NOTICE.md).

## Support

If Kotoba Insert is useful to you, you can support its development through [Buy Me a Coffee](https://buymeacoffee.com/gibbonolive9442).

## Development

```bash
npm install
npm run dev
```

For a production bundle, run `npm run build`.

## Releases

The release workflow runs when you push a Git tag. Before tagging, update `manifest.json` and `versions.json`, commit the version change, and verify `npm run check`, `npm test`, and `npm run build`. The tag must exactly match `manifest.json` (for example, `0.1.0`, not `v0.1.0`). The workflow creates a GitHub release with `main.js`, `manifest.json`, and `styles.css` attached.
