import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { BookOpen, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { MASTER_PRODUCTS_CATALOG } from '../utils/hsnDetector';
import type { CatalogDbProduct } from './AddProductDialog';
import { productsApi } from '../lib/api';
import { normalizeListResponse } from '../lib/queryKeys';

interface MarkdownMessageProps {
  content: string;
}

/**
 * Preprocesses raw message content to ensure standard Markdown list syntax,
 * clean line breaks, and proper paragraph structure for the chat interface.
 */
export function preprocessMarkdown(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw;

  // Keep thickness*width*length specs from being read as italic markers.
  text = text.replace(/(\d)\*(?=\d)/g, '$1\\*');

  // 1. Convert mid-sentence / inline Unicode bullets (e.g., "Field: * • Field 2: ...") into separate list lines
  text = text.replace(/([^\n])\s*[•⁃◦▪▫►◆]\s+/g, '$1\n- ');

  // 2. Convert Unicode bullets or asterisks at start of lines into standard Markdown hyphen list items (- )
  text = text.replace(/^([ \t]*)[•⁃◦▪▫►◆–—]\s*/gm, '$1- ');

  // 3. Convert keycap number emojis (1️⃣, 2️⃣, etc.) at line starts into standard numbered lists
  text = text.replace(/^([ \t]*)([1-9]|10)️⃣\s*/gm, '$1$2. ');

  // 4. Normalize WhatsApp-style bold labels in list items (e.g. "- *Field Name:* value") to standard Markdown bold ("- **Field Name:** value")
  text = text.replace(/^([ \t]*-\s*)\*([^*:\n]+:)\*/gm, '$1**$2**');

  // 5. Normalize standalone WhatsApp-style bold title lines (e.g. "*Title Header*") to standard Markdown bold ("**Title Header**")
  text = text.replace(/^([ \t]*)\*([^*\n]+)\*([ \t]*)$/gm, '$1**$2**$3');

  // 6. Ensure proper separation before and after list blocks so CommonMark parses <ul>/<ol> correctly
  // Add a blank line before a list if preceded by non-list, non-empty text
  text = text.replace(/([^\n\-*+\d])\n([ \t]*[-*+]\s+)/g, '$1\n\n$2');
  text = text.replace(/([^\n\-*+\d])\n([ \t]*\d+\.\s+)/g, '$1\n\n$2');

  // Add a blank line after a list if followed by regular paragraph text
  text = text.replace(/(\n[ \t]*[-*+]\s+[^\n]+)\n([^\n\s\-*+\d])/g, '$1\n\n$2');
  text = text.replace(/(\n[ \t]*\d+\.\s+[^\n]+)\n([^\n\s\-*+\d])/g, '$1\n\n$2');

  return text.trim();
}

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  const [showProductListModal, setShowProductListModal] = useState(false);
  const { data: rawDbProducts = [] } = useQuery<CatalogDbProduct[]>({
    queryKey: ['products-catalog'],
    queryFn: async () => {
      const res = await productsApi.getAll().catch(() => null);
      return normalizeListResponse(res?.data);
    },
    enabled: showProductListModal,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const processedContent = useMemo(() => preprocessMarkdown(content), [content]);

  // Pre-process citation tags so they render as rich, high-visibility Knowledge Base badges
  const renderTextWithCitations = (children: React.ReactNode): React.ReactNode => {
    if (typeof children !== 'string') return children;

    // Matches:
    // 1. [Source: Document Title]
    // 2. _Source: Document Title_
    // 3. *Source:* Document Title
    // 4. **Source:** Document Title
    // 5. Source: Document Title (at line/block level)
    const citationRegex = /(\[Source:\s*[^\]]+\]|_Source:\s*[^_]+_|\*\*Source:\*\*\s*[^\n\r]+|\*Source:\*\s*[^\n\r]+|(?:\n|^)Source:\s*[^\n\r]+)/gi;
    const parts = children.split(citationRegex);

    if (parts.length === 1) return children;

    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < parts.length) {
      const part = parts[i];
      if (!part) {
        i++;
        continue;
      }

      const match = part.match(/(?:\[Source:\s*([^\]]+)\]|_Source:\s*([^_]+)_|\*\*Source:\*\*\s*([^\n\r]+)|\*Source:\*\s*([^\n\r]+)|(?:^|\n)Source:\s*([^\n\r]+))/i);

      if (match) {
        const rawTitle = (match[1] || match[2] || match[3] || match[4] || match[5] || '').trim();
        const cleanTitle = rawTitle.replace(/^[*_~`]+|[*_~`]+$/g, '').trim();

        if (cleanTitle) {
          elements.push(
            <span
              key={`cite-${i}`}
              className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-300/80 px-2.5 py-1 rounded-lg text-xs font-medium my-1.5 shadow-2xs transition-colors cursor-default"
              title={`Knowledge Base Source Document: ${cleanTitle}`}
            >
              <BookOpen size={13} className="shrink-0 text-amber-600" />
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                Source
              </span>
              <span className="text-gray-400">|</span>
              <span className="font-semibold text-gray-900">
                {cleanTitle}
              </span>
            </span>
          );
        }
      } else {
        elements.push(part);
      }
      i++;
    }

    return elements;
  };

  return (
    <div className="prose-xs max-w-none text-gray-800 text-sm leading-relaxed space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          // Paragraphs
          p: ({ children }) => (
            <p className="my-1.5 leading-relaxed text-gray-800">
              {renderTextWithCitations(children)}
            </p>
          ),

          // Links
          a: ({ href, children, ...props }) => {
            if (href === '#view-product-list') {
              return (
                <button
                  type="button"
                  onClick={() => setShowProductListModal(true)}
                  className="font-bold text-blue-600 underline hover:text-blue-800 cursor-pointer inline"
                >
                  {children}
                </button>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-600 underline hover:text-blue-800"
                {...props}
              >
                {children}
              </a>
            );
          },

          // Headings
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-gray-900 mt-3 mb-1.5 pb-1 border-b border-gray-100 flex items-center gap-1.5">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-gray-900 mt-2.5 mb-1 flex items-center gap-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-bold text-gray-800 mt-2 mb-1 uppercase tracking-wide">
              {children}
            </h3>
          ),

          // Bold & Italic
          strong: ({ children }) => {
            const formatted = React.Children.map(children, (child) => {
              if (typeof child === 'string' && child.includes('*')) {
                const parts = child.split('*');
                return parts.map((part, idx) => (
                  <React.Fragment key={idx}>
                    {part}
                    {idx < parts.length - 1 && (
                      <span className="text-red-500 font-bold">*</span>
                    )}
                  </React.Fragment>
                ));
              }
              return child;
            });
            return <strong className="font-semibold text-gray-950">{formatted}</strong>;
          },
          em: ({ children }) => (
            <em className="italic text-gray-700">{children}</em>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 space-y-1.5 my-2.5 text-gray-800 marker:text-blue-500">
              {children}
            </ul>
          ),
          ol: ({ children, start, ...props }) => (
            <ol
              start={start}
              className="list-decimal list-outside pl-5 space-y-1.5 my-2.5 text-gray-800 marker:text-blue-600 font-medium"
              {...props}
            >
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-1 font-normal text-gray-800">
              {renderTextWithCitations(children)}
            </li>
          ),

          // Tables
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-gray-200 shadow-2xs">
              <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-100 bg-white">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-blue-50/30 transition-colors even:bg-gray-50/40">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200 last:border-r-0 whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-xs text-gray-800 border-r border-gray-100 last:border-r-0">
              {renderTextWithCitations(children)}
            </td>
          ),

          // Code
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            return isInline ? (
              <code
                className="bg-gray-100 text-blue-700 font-mono text-[12px] px-1.5 py-0.5 rounded border border-gray-200 font-semibold"
                {...props}
              >
                {children}
              </code>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-xs overflow-x-auto my-2.5 border border-slate-800">
              {children}
            </pre>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 bg-blue-50/60 pl-3.5 pr-3 py-2 my-2 rounded-r-xl text-xs text-blue-950 italic">
              {children}
            </blockquote>
          ),

          // Horizontal Rule
          hr: () => <hr className="my-3 border-gray-200" />,
        }}
      >
        {processedContent}
      </ReactMarkdown>

      {showProductListModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={() => setShowProductListModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Product List &amp; HSN Catalog</h3>
              <button
                type="button"
                onClick={() => setShowProductListModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <table className="w-full border-collapse border border-slate-800 text-xs text-slate-900">
                <thead>
                  <tr className="bg-slate-100 font-bold text-center">
                    <th className="border border-slate-800 px-3 py-2 w-[26%]">Product Name</th>
                    <th className="border border-slate-800 px-3 py-2 w-[52%]">Dimensions</th>
                    <th className="border border-slate-800 px-3 py-2 w-[22%]">8-Digit HSN Code</th>
                  </tr>
                </thead>
                <tbody>
                  {(['Flat Steel', 'Structural Steel', 'Pipes and Tubes', 'Value Added Products'] as const).map(
                    (category) => {
                      const rows = MASTER_PRODUCTS_CATALOG.filter((p) => p.category === category);
                      return [
                        <tr key={`cat-${category}`}>
                          <td
                            colSpan={3}
                            className="border border-slate-800 px-3 py-1.5 text-center font-bold text-red-600 bg-white"
                          >
                            {category}
                          </td>
                        </tr>,
                        ...rows.map((row, rIdx) => (
                          <tr key={`${category}-${rIdx}`} className="hover:bg-slate-50">
                            <td className="border border-slate-800 px-3 py-1.5 text-center font-bold">
                              {row.product_name}
                            </td>
                            <td className="border border-slate-800 px-3 py-1.5 text-center">
                              {row.dimensions}
                            </td>
                            <td className="border border-slate-800 px-3 py-1.5 text-center font-mono">
                              {row.hsn_code}
                            </td>
                          </tr>
                        )),
                      ];
                    },
                  )}
                  {(() => {
                    const staticKeys = new Set(
                      MASTER_PRODUCTS_CATALOG.map(
                        (p) => `${p.product_name.trim().toLowerCase()}|${p.dimensions.trim().toLowerCase()}`,
                      ),
                    );
                    const customRows = (rawDbProducts || []).filter((p) => {
                      const name = (p.product_name || '').trim();
                      if (!name) return false;
                      const key = `${name.toLowerCase()}|${(p.dimensions || '').trim().toLowerCase()}`;
                      return !staticKeys.has(key);
                    });
                    if (customRows.length === 0) return null;
                    return [
                      <tr key="cat-custom">
                        <td
                          colSpan={3}
                          className="border border-slate-800 px-3 py-1.5 text-center font-bold text-red-600 bg-white"
                        >
                          Custom Products
                        </td>
                      </tr>,
                      ...customRows.map((row, rIdx) => (
                        <tr key={`custom-${rIdx}`} className="hover:bg-slate-50">
                          <td className="border border-slate-800 px-3 py-1.5 text-center font-bold">
                            {row.product_name}
                          </td>
                          <td className="border border-slate-800 px-3 py-1.5 text-center">
                            {row.dimensions || '—'}
                          </td>
                          <td className="border border-slate-800 px-3 py-1.5 text-center font-mono">
                            {row.hsn_code || '—'}
                          </td>
                        </tr>
                      )),
                    ];
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
