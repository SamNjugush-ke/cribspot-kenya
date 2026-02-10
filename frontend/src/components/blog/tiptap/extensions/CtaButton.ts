// src/components/blog/tiptap/extensions/CtaButton.ts
import { Node, mergeAttributes } from '@tiptap/core';

export interface CtaButtonOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ctaButton: {
      /**
       * Insert a call-to-action button with label + href.
       */
      setCtaButton: (label: string, href: string) => ReturnType;
    };
  }
}

const CtaButton = Node.create<CtaButtonOptions>({
  name: 'ctaButton',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      label: {
        default: 'Read more',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-label'),
        renderHTML: (attrs) => ({ 'data-label': attrs.label }),
      },
      href: {
        default: '#',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-href'),
        renderHTML: (attrs) => ({ 'data-href': attrs.href }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-type="cta-button"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const { label, href } = node.attrs as any;
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'cta-button',
        href,
        class:
          'inline-block px-4 py-2 rounded bg-[#004AAD] text-white hover:bg-[#00398a]',
      }),
      label,
    ];
  },

  addCommands() {
    return {
      setCtaButton:
        (label: string, href: string) =>
        ({ chain }) => {
          return chain()
            .insertContent({ type: this.name, attrs: { label, href } })
            .run();
        },
    };
  },
});

export default CtaButton;
