# Privacy

Kotoba Insert does not collect telemetry, analytics, accounts, or note content.

Japanese term lookups are performed locally after the dictionary is installed. The plugin makes a network request only when the user explicitly installs or updates the dictionary. That request downloads the public dictionary metadata and snapshot from the configured Kotoba Insert data-release URL.

If the user configures and uses AI lookup, the plugin sends the entered Japanese term and selected Markdown prompt to the user-configured AI provider. The plugin does not send note content. AI providers may retain or process those requests according to their own terms and privacy policies, and may charge the user. API keys are selected through Obsidian SecretStorage; Kotoba Insert stores only the selected secret name in its plugin settings.
