'use client';

import { useEffect, useRef } from 'react';
import EditorJS, { OutputData } from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';
import Table from '@editorjs/table';
import ImageTool from '@editorjs/image';
import Checklist from '@editorjs/checklist';
import Embed from '@editorjs/embed';
import Delimiter from '@editorjs/delimiter';
import CodeTool from '@editorjs/code';
import RawTool from '@editorjs/raw';

export default function EditorJSWrapper({
  content,
  onChange,
}: {
  content?: OutputData;
  onChange?: (data: OutputData) => void;
}) {
  const ejInstance = useRef<EditorJS | null>(null);
  const holderId = 'editorjs-container';

  useEffect(() => {
    if (!ejInstance.current) {
      const editor = new EditorJS({
        holder: holderId,
        autofocus: true,
        data: content || { blocks: [] },
        tools: {
          header: { class: Header as any, inlineToolbar: true },
          list: { class: List as any, inlineToolbar: true },
          checklist: { class: Checklist as any, inlineToolbar: true },
          quote: { class: Quote as any, inlineToolbar: true },
          table: { class: Table as any, inlineToolbar: true },
          code: CodeTool as any,
          raw: RawTool as any,
          delimiter: Delimiter as any,
          embed: Embed as any,
          image: {
            class: ImageTool as any,
            config: {
              uploader: {
                async uploadByFile(file: File) {
                  return {
                    success: 1,
                    file: { url: URL.createObjectURL(file) },
                  };
                },
              },
            },
          },
        },
        onChange: async (api) => {
          const data = await api.saver.save();
          onChange?.(data);
        },
      });

      ejInstance.current = editor;
    }

    return () => {
      if (ejInstance.current) {
        ejInstance.current.isReady
          .then(() => {
            ejInstance.current?.destroy();
            ejInstance.current = null;
          })
          .catch(() => {
            ejInstance.current = null;
          });
      }
    };
  }, []);

  return <div id={holderId} className="prose max-w-none" />;
}
