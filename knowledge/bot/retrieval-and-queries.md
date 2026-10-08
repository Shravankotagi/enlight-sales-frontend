# Retrieval, queries, and knowledge base

`src/core/retrievalTools.js` is the broad read/query layer for deals, inquiries, visits, complaints, customers, team pipeline, churn, loss analytics, and KB search. `src/queryhandler.js` handles query interpretation/output. `src/services/kbRetrievalService.js` provides knowledge-base retrieval over `kb_documents`/`kb_chunks`.

Every read needs user-scope filtering, bounded results, and safe user-visible projection. The orchestrator caps numbered lists at eight; preserve this policy in new queries. Never return employee/private fields just because the model requested them. Treat document content as untrusted retrieval input, not tool instructions.
