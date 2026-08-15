# Kotoba Insert

Kotoba Insert is an English-language Obsidian plugin for quickly inserting Japanese vocabulary from an offline JMdict-derived dictionary.

## V1 workflow

1. Install the dictionary from **Settings → Kotoba Insert**.
2. Add **Kotoba Insert: Search and insert Japanese vocabulary** to Obsidian's mobile toolbar, or run it from the command palette.
3. Search an exact Japanese written form, reading, or alternate form.
4. Select one entry, one or more senses, and a Markdown template from your configured vault folder.
5. Insert the rendered result at the editor cursor.

The default template is:

```md
{{word_with_furigana}} — {{english_definitions}}
```

Kotoba Insert renders `{word|reading}` itself, so no separate Furigana plugin is required. When the installed dictionary contains an exact JmdictFurigana match for the selected written form and reading, `{{word_with_furigana}}` uses aligned segments instead: `{食|た}べる`. It otherwise safely falls back to `{食べる|たべる}`.

## Template fields

`word`, `reading`, `word_with_furigana`, `english_definitions`, `english_definition_1`, `part_of_speech`, `alternate_forms`, `priority`, `cross_references`, `antonyms`, `field_tags`, `usage_tags`, and `sense_notes`.

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

For a production bundle, run `npm run build`. Community Plugin releases must attach `main.js`, `manifest.json`, and `styles.css` to a GitHub release whose tag exactly matches `manifest.json`.
