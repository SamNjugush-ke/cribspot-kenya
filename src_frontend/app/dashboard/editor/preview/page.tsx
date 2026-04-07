'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { toast } from 'sonner';

type Blog = {
  id: string;
  title: string;
  excerpt?: string | null;
  coverImage?: string | null;
  contentHtml?: string | null;
  published: boolean;
  author?: { id: string; name: string } | null;
  categories?: { id: string; name: string }[];
  tags?: { id: string; name: string }[];
};

export default function BlogPreviewPage() {
  const searchParams = useSearchParams();
  const blogId = searchParams.get('id');
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!blogId) {
      toast.error('No blog ID provided for preview');
      return;
    }
    (async () => {
      setLoading(true);
      const res = await apiGet<Blog>(`/api/blogs/${blogId}`);
      if (res.ok && res.data) {
        setBlog(res.data);
      } else {
        toast.error('Failed to load preview');
      }
      setLoading(false);
    })();
  }, [blogId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading preview…
      </div>
    );
  }
  if (!blog) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        No blog found
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Public Header */}
      <Header />

      {/* Blog Content */}
      <main className="flex-1">
        {/* Cover */}
        {blog.coverImage && (
          <div className="w-full h-72 relative mb-8">
            <img
              src={blog.coverImage}
              alt="Cover"
              className="w-full h-72 object-cover"
            />
          </div>
        )}

        <article className="max-w-3xl mx-auto bg-white p-8 shadow-sm rounded-lg">
          {/* Title */}
          <h1 className="text-4xl font-bold mb-3">{blog.title}</h1>
          {blog.author && (
            <p className="text-gray-500 text-sm mb-6">
              By {blog.author.name}
            </p>
          )}

          {/* Excerpt */}
          {blog.excerpt && (
            <p className="italic text-gray-700 mb-6">{blog.excerpt}</p>
          )}

          {/* Content */}
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: blog.contentHtml || '' }}
          />

          {/* Categories & Tags */}
          <div className="mt-10 flex flex-wrap gap-3">
            {blog.categories?.map((c) => (
              <span
                key={c.id}
                className="px-3 py-1 rounded bg-blue-100 text-blue-800 text-xs"
              >
                {c.name}
              </span>
            ))}
            {blog.tags?.map((t) => (
              <span
                key={t.id}
                className="px-3 py-1 rounded bg-red-100 text-red-800 text-xs"
              >
                #{t.name}
              </span>
            ))}
          </div>
        </article>
      </main>

      {/* Public Footer */}
      <Footer />
    </div>
  );
}
