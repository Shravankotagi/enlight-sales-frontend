import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen } from 'lucide-react';

interface MarkdownMessageProps {
  content: string;
}

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  // Pre-process citation tags so they are identifiable or render nicely
  const renderTextWithCitations = (children: React.ReactNode): React.ReactNode => {
    if (typeof children !== 'string') return children;

    const citationRegex = /\[Source:\s*([^\]]+)\]/g;
    const parts = children.split(citationRegex);

    if (parts.length === 1) return children;

    const elements: React.ReactNode[] = [];
    let i = 0;
    while (i < parts.length) {
      if (parts[i]) {
        elements.push(parts[i]);
      }
      if (i + 1 < parts.length) {
        const docTitle = parts[i + 1];
        elements.push(
          <span
            key={`cite-${i}`}
            className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-mono text-[11px] font-semibold my-0.5 mx-1 shadow-2xs hover:bg-amber-100 transition-colors cursor-default"
            title={`Knowledge Base Source: ${docTitle}`}
          >
            <BookOpen size={11} className="shrink-0 text-amber-600" />
            Source: {docTitle}
          </span>
        );
        i += 2;
      } else {
        i += 1;
      }
    }
    return elements;
  };

  return (
    <div className="prose-xs max-w-none text-gray-800 text-sm leading-relaxed space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Paragraphs
          p: ({ children }) => (
            <p className="my-1.5 leading-relaxed text-gray-800">
              {renderTextWithCitations(children)}
            </p>
          ),

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
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-950">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-700">{children}</em>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 space-y-1 my-2 text-gray-800">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-5 space-y-1 my-2 text-gray-800">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-0.5">
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
        {content}
      </ReactMarkdown>
    </div>
  );
}
