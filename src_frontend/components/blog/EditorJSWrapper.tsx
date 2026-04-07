"use client";

import { useEffect, useRef } from "react";
import EditorJS, { OutputData } from "@editorjs/editorjs";

type Props = {
  content?: OutputData | null;
  onChange?: (data: OutputData) => void;
};

export default function EditorJSWrapper({ content, onChange }: Props) {
  const editorRef = useRef<EditorJS | null>(null);
  const holder = "editorjs-container";

  useEffect(() => {
    if (editorRef.current) return;

    const editor = new EditorJS({
      holder,
      data: content || undefined,
      placeholder: "Write your blog content here…",
      async onChange(api) {
        const saved = await api.saver.save();
        onChange?.(saved);
      },
      tools: {
        header: require("@editorjs/header"),
        list: require("@editorjs/list"),
        quote: require("@editorjs/quote"),
        image: require("@editorjs/image"),
        delimiter: require("@editorjs/delimiter"),
        embed: require("@editorjs/embed"),
        table: require("@editorjs/table"),
      },
    });

    editorRef.current = editor;

    return () => {
      if (editorRef.current?.destroy) {
        editorRef.current.destroy();
      }
      editorRef.current = null;
    };
  }, [content, onChange]);

  return <div id={holder} className="min-h-[300px]" />;
}