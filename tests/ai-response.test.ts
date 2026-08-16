import { describe, expect, it } from "vitest";

import { completionEndpoint } from "../src/ai/endpoint";
import { extractCompletionText, responseMessage } from "../src/ai/response";

describe("AI completion responses", () => {
	it("extracts a text completion", () => {
		expect(extractCompletionText({ choices: [{ message: { content: "{食|た}べる - to eat" } }] }))
			.toBe("{食|た}べる - to eat");
	});

	it("extracts text content parts", () => {
		expect(extractCompletionText({ choices: [{ message: { content: [{ type: "text", text: "first " }, { type: "text", text: "second" }] } }] }))
			.toBe("first second");
	});

	it("uses the provider error message when no completion is returned", () => {
		const response = { error: { message: "Invalid API key" } };
		expect(responseMessage(response)).toBe("Invalid API key");
		expect(() => extractCompletionText(response)).toThrow("Invalid API key");
	});

	it("builds a compatible completion endpoint from the configured base URL", () => {
		expect(completionEndpoint("https://api.openai.com/v1")).toBe("https://api.openai.com/v1/chat/completions");
		expect(completionEndpoint("http://localhost:1234/v1/")).toBe("http://localhost:1234/v1/chat/completions");
	});

	it("rejects an insecure remote API URL", () => {
		expect(() => completionEndpoint("http://example.com/v1")).toThrow("must use HTTPS");
	});
});
