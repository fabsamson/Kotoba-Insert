import { requestUrl, type App, type RequestUrlResponse } from "obsidian";

import { completionEndpoint } from "./endpoint";
import { extractCompletionText, responseMessage } from "./response";

export interface AiConfiguration {
	apiBaseUrl: string;
	model: string;
	apiKeySecret: string;
}

export class AiService {
	public constructor(
		private readonly app: App,
		private readonly configuration: () => AiConfiguration,
	) {}

	public async lookup(query: string, prompt: string): Promise<string> {
		const normalizedQuery = query.trim();
		if (!normalizedQuery) throw new Error("Enter a Japanese word or grammar point.");
		if (!prompt.trim()) throw new Error("The selected prompt is empty.");

		const configuration = this.configuration();
		if (!configuration.model.trim()) throw new Error("Choose an AI model in Kotoba Insert settings.");
		if (!configuration.apiKeySecret.trim()) throw new Error("Choose an API key secret in Kotoba Insert settings.");
		const apiKey = this.app.secretStorage.getSecret(configuration.apiKeySecret);
		if (!apiKey) throw new Error(`The API key secret \"${configuration.apiKeySecret}\" is unavailable.`);

		const endpoint = completionEndpoint(configuration.apiBaseUrl);
		let response: RequestUrlResponse;
		try {
			response = await requestUrl({
				url: endpoint,
				method: "POST",
				contentType: "application/json",
				headers: { Authorization: `Bearer ${apiKey}` },
				body: JSON.stringify({
					model: configuration.model.trim(),
					messages: [
						{ role: "system", content: prompt },
						{ role: "user", content: `Japanese input:\n${normalizedQuery}` },
					],
					stream: false,
				}),
				throw: false,
			});
		} catch (error) {
			throw new Error(`Unable to contact the AI provider: ${message(error)}`);
		}

		const responseBody: unknown = response.json as unknown;
		if (response.status < 200 || response.status >= 300) {
			throw new Error(responseMessage(responseBody) ?? `The AI provider returned HTTP ${response.status}.`);
		}
		return extractCompletionText(responseBody);
	}
}

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
