// src/components/blog/tiptap/extensions/Gallery.ts
import { Node, mergeAttributes } from '@tiptap/core';

export interface GalleryOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    gallery: {
      /**
       * Insert a gallery node with an array of image URLs.
       */
      setGallery: (urls: string[]) => ReturnType;
    };
  }
}

const Gallery = Node.create<GalleryOptions>({
  name: 'gallery',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      urls: {
        default: [] as string[],
        parseHTML: (el: HTMLElement) => {
          try {
            const raw = el.getAttribute('data-urls');
            return raw ? JSON.parse(raw) : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({
          'data-urls': JSON.stringify(attrs.urls || []),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="gallery"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const urls: string[] = (node.attrs as any).urls || [];
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'gallery',
        class: 'rk-gallery grid grid-cols-2 gap-2',
      }),
      ...urls.map((u) => [
        'img',
        { src: u, class: 'w-full h-40 object-cover rounded' },
      ]),
    ];
  },

  addCommands() {
    return {
      setGallery:
        (urls: string[]) =>
        ({ chain }) => {
          return chain()
            .insertContent({ type: this.name, attrs: { urls } })
            .run();
        },
    };
  },
});

export default Gallery;
