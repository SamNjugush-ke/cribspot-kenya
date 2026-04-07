//frontend/src/components/blogs/PreviewRenderer.tsx
"use client";

import React from "react";

export default function PreviewRenderer({
  format,
  content,
  html,
}: {
  format: "EDITORJS" | "TIPTAP";
  content: any;
  html?: string; // optional pre-rendered HTML from backend
}) {
  if (!content && !html) {
    return <div className="p-3 text-gray-500">Empty content</div>;
  }

  // Prefer backend-rendered HTML if available
  if (html) {
    return (
      <div
        className="prose prose-lg max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (format === "EDITORJS") {
    const blocks = Array.isArray(content?.blocks) ? content.blocks : [];

    return (
      <div className="prose prose-lg max-w-none dark:prose-invert">
        {blocks.map((b: any, i: number) => {
          switch (b.type) {
            case "header":
              return <h2 key={i}>{b.data.text}</h2>;

            case "paragraph":
              return (
                <p
                  key={i}
                  dangerouslySetInnerHTML={{ __html: b.data.text }}
                />
              );

            case "list":
              return b.data.style === "ordered" ? (
                <ol key={i} className="list-decimal ml-6">
                  {b.data.items.map((it: string, idx: number) => (
                    <li key={idx} dangerouslySetInnerHTML={{ __html: it }} />
                  ))}
                </ol>
              ) : (
                <ul key={i} className="list-disc ml-6">
                  {b.data.items.map((it: string, idx: number) => (
                    <li key={idx} dangerouslySetInnerHTML={{ __html: it }} />
                  ))}
                </ul>
              );

            case "quote":
              return (
                <blockquote key={i} className="border-l-4 pl-4 italic text-gray-600">
                  {b.data.text}
                  {b.data.caption && (
                    <footer className="mt-1 text-sm text-gray-500">— {b.data.caption}</footer>
                  )}
                </blockquote>
              );

            case "table":
              return (
                <table key={i} className="table-auto border-collapse border">
                  <tbody>
                    {b.data.content.map((row: string[], ri: number) => (
                      <tr key={ri}>
                        {row.map((cell: string, ci: number) => (
                          <td
                            key={ci}
                            className="border px-3 py-2"
                            dangerouslySetInnerHTML={{ __html: cell }}
                          />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );

            case "image":
              return (
                <figure key={i} className="my-4">
                  <img
                    src={b.data.file?.url}
                    alt={b.data.caption || "Image"}
                    className="rounded-lg shadow"
                  />
                  {b.data.caption && (
                    <figcaption className="text-center text-sm text-gray-500 mt-1">
                      {b.data.caption}
                    </figcaption>
                  )}
                </figure>
              );

            case "embed":
              return (
                <div key={i} className="my-4">
                  <iframe
                    className="w-full aspect-video rounded"
                    src={b.data.embed}
                    title={b.data.caption || "Embedded content"}
                    allowFullScreen
                  />
                  {b.data.caption && (
                    <div className="text-sm text-gray-500">{b.data.caption}</div>
                  )}
                </div>
              );

            case "delimiter":
              return <hr key={i} className="my-6 border-t-2 border-gray-300" />;

            default:
              return null;
          }
        })}
      </div>
    );
  }

  if (format === "TIPTAP") {
    return (
      <div
        className="prose prose-lg max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{
          __html: content?.html || "<p>[No preview available]</p>",
        }}
      />
    );
  }

  return <div className="text-gray-500">Unsupported format</div>;
}
