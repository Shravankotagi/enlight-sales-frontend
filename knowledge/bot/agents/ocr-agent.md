# OCR agent

`src/agents/ocrAgent.js` processes sales documents/images into structured commercial data. It is connected to image compression, Gemini/vision, product matching, and inquiry/deal creation flows. Input can be untrusted and incomplete: validate extracted values before writes and never log raw image/base64 data.
