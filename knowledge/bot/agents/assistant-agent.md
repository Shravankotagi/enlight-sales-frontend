# Assistant agent

`src/agents/assistantAgent.js` provides general assistant behavior outside a focused commercial mutation. It should favor retrieval tools for company facts and must not invent record data. Keep it within authenticated caller scope and do not let free-form prompts bypass tool-level authorization.
