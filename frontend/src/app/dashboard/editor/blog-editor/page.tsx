// frontend/src/app/dashboard/editor/blog-editor/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { OutputData } from "@editorjs/editorjs";
import { useSearchParams, useRouter } from "next/navigation";

import { apiGet, apiPut, apiPost, apiDelete, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Save,
  Eye,
  Image as ImageIcon,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Upload,
  Globe,
  PencilLine,
} from "lucide-react";

import MediaPickerModal from "@/components/media/MediaPickerModal";
import SearchMultiSelect, { SelectItem } from "@/components/ui/SearchMultiSelect";

/* ---------------- Types ---------------- */

type Role = "RENTER" | "LISTER" | "EDITOR" | "ADMIN" | "SUPER_ADMIN";
type Me = { id: string; role: Role };

type Blog = {
  id: string;
  title: string;
  slug: string;
  coverImage?: string | null;
  excerpt?: string | null;
  contentJson?: any;
  contentFormat?: string | null;
  published: boolean;

  seoTitle?: string | null;
  seoDesc?: string | null;
  seoKeywords?: string | null;

  deletedAt?: string | null;
};

type SlugCheck = { available: boolean };

const normalizeRole = (r: any) => (typeof r === "string" ? r.toUpperCase() : "");

const slugify = (input: string) =>
  (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

const safeEditorData = (raw: any): OutputData =>
  raw && typeof raw === "object" && Array.isArray(raw?.blocks) ? raw : { time: Date.now(), blocks: [] };

const resolveUrl = (u?: string | null) => (!u ? "" : u.startsWith("http") ? u : `${API_BASE}${u}`);

const parseKeywordString = (s: string) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const toKeywordString = (arr: string[]) => Array.from(new Set(arr.map((x) => x.trim()).filter(Boolean))).join(", ");

/* ---------------- Page Wrapper (Suspense) ---------------- */

export default function BlogEditorPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">Loading editor…</div>}>
      <BlogEditorInner />
    </Suspense>
  );
}

/* ---------------- Inner Page ---------------- */

function BlogEditorInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp.get("id");

  const editorHolderId = "editorjs-holder";
  const editorRef = useRef<any>(null);

  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingManual, setSavingManual] = useState(false);
  const [initingEditor, setInitingEditor] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // core fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [published, setPublished] = useState(false);

  // SEO
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");
  const [seoKeywordsArr, setSeoKeywordsArr] = useState<string[]>([]);
  const [keywordDraft, setKeywordDraft] = useState("");

  // relations
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // media
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [inlinePickerOpen, setInlinePickerOpen] = useState(false);

  // soft delete
  const [deletedAt, setDeletedAt] = useState<string | null>(null);

  /* ---------------- Permissions ---------------- */

  const canPublish = useMemo(() => {
    const r = normalizeRole(me?.role);
    return r === "EDITOR" || r === "ADMIN" || r === "SUPER_ADMIN";
  }, [me]);

  const canDelete = useMemo(() => {
    const r = normalizeRole(me?.role);
    return r === "ADMIN" || r === "SUPER_ADMIN";
  }, [me]);

  /* ---------------- Autosave state ---------------- */

  type AutoState = "idle" | "dirty" | "saving" | "saved" | "error";
  const [autoState, setAutoState] = useState<AutoState>("idle");
  const [autoMsg, setAutoMsg] = useState<string>("");
  const autosaveTimerRef = useRef<any>(null);
  const slugTimerRef = useRef<any>(null);
  const isBootstrappingRef = useRef(true);
  const lastSavedAtRef = useRef<number>(0);

  const markDirty = () => {
    if (isBootstrappingRef.current) return;
    setAutoState("dirty");
    setAutoMsg("Unsaved changes");
  };

  /* ---------------- Slug check ---------------- */

  type SlugStatus = "idle" | "checking" | "available" | "taken" | "error";
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");

  const checkSlugAvailability = async (candidate: string, excludeId?: string | null) => {
    const s = (candidate || "").trim();
    if (!s) {
      setSlugStatus("idle");
      return;
    }

    setSlugStatus("checking");
    try {
      const res = await apiGet<SlugCheck | null>("/api/blogs/check-slug", {
        params: { slug: s, excludeId: excludeId || undefined },
      } as any);

      if (!res.ok || !res.json) throw new Error("Check failed");
      setSlugStatus(res.json.available ? "available" : "taken");
    } catch {
      setSlugStatus("error");
    }
  };

  /* ---------------- EditorJS ---------------- */

  // We initialize editor only AFTER the holder exists.
  const [pendingEditorData, setPendingEditorData] = useState<OutputData | null>(null);

  const destroyEditor = async () => {
    if (!editorRef.current) return;
    try {
      await editorRef.current.isReady;
      editorRef.current.destroy();
    } catch {}
    editorRef.current = null;
  };

  const normalizeEditorImageUrls = (data: OutputData): OutputData => {
    const blocks = (data?.blocks || []).map((b: any) => {
      if (b?.type === "image") {
        const url = b?.data?.file?.url;
        if (typeof url === "string" && url && !url.startsWith("http")) {
          return {
            ...b,
            data: {
              ...b.data,
              file: { ...(b.data.file || {}), url: resolveUrl(url) },
            },
          };
        }
      }
      return b;
    });
    return { ...data, blocks };
  };

  // Custom tool that opens MediaPickerModal and inserts an image block
  class MediaLibraryImageTool {
    private api: any;
    private config: any;
    private wrapper: HTMLDivElement;

    static get toolbox() {
      return {
        title: "Media Library Image",
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 5h16v14H4V5zm2 2v10h12V7H6zm2 7l2-2 2 2 3-4 3 4v2H8v-2z" fill="currentColor"/>
        </svg>`,
      };
    }

    constructor({ api, config }: any) {
      this.api = api;
      this.config = config;
      this.wrapper = document.createElement("div");
    }

    render() {
      // Trigger modal immediately; insert happens via onSelect handler below.
      window.setTimeout(() => this.config?.open?.(), 0);
      this.wrapper.innerHTML = `<div style="padding:10px;border:1px dashed #ddd;border-radius:10px;color:#666;font-size:13px;">
        Select an image from Media Library…
      </div>`;
      return this.wrapper;
    }

    save() {
      // This block is just a placeholder; we replace by inserting a real image block.
      return {};
    }
  }

  const initEditor = async (data: OutputData) => {
    setInitingEditor(true);
    await destroyEditor();

    // Ensure the holder exists (fixes "Editor holder missing")
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const holder = document.getElementById(editorHolderId);
    if (!holder) throw new Error("Editor holder missing");

    // ✅ Dynamic imports to avoid SSR/prerender "Element is not defined"
    const [{ default: EditorJS }, { default: Header }, { default: List }, { default: Quote }, { default: Table }, { default: ImageTool }] =
      await Promise.all([
        import("@editorjs/editorjs"),
        import("@editorjs/header"),
        import("@editorjs/list"),
        import("@editorjs/quote"),
        import("@editorjs/table"),
        import("@editorjs/image"),
      ]);

    const tools: any = {
      header: { class: Header as any, inlineToolbar: true },
      list: { class: List as any, inlineToolbar: true },
      quote: { class: Quote as any, inlineToolbar: true },
      table: { class: Table as any, inlineToolbar: true },

      // Upload-from-PC image (still works)
      image: {
        class: ImageTool as any,
        config: {
          uploader: {
            uploadByFile: async (file: File) => {
              const fd = new FormData();
              fd.append("file", file);

              const res = await apiPost<any>("/api/uploads/editor-image", fd);
              if (!res.ok || !res.json) throw new Error("Upload failed");

              // backend returns {success:1, file:{url:"http://..."}}
              const url = res.json?.file?.url || res.json?.url;
              if (!url) throw new Error("Upload failed");

              return { success: 1, file: { url: resolveUrl(url) } };
            },
          },
        },
      },

      // Media library picker inside the "+" menu
      mediaLibraryImage: {
        class: MediaLibraryImageTool as any,
        config: {
          open: () => setInlinePickerOpen(true),
        },
      },
    };

    editorRef.current = new EditorJS({
      holder: editorHolderId,
      data: normalizeEditorImageUrls(data),
      autofocus: true,
      tools,
      onChange: () => {
        markDirty();
        scheduleAutosave("content");
      },
    });

    await editorRef.current.isReady;
    setInitingEditor(false);
  };

  // When a library image is selected, insert it and remove placeholder block
  const insertLibraryImage = async (url: string) => {
    if (!editorRef.current) return;

    const abs = resolveUrl(url);

    try {
      // Insert real image block at end
      // @ts-ignore
      editorRef.current.blocks.insert("image", { file: { url: abs } }, {}, undefined, true);

      // Remove any placeholder “mediaLibraryImage” blocks that may have been added
      // @ts-ignore
      const count = editorRef.current.blocks.getBlocksCount();
      for (let i = count - 1; i >= 0; i--) {
        // @ts-ignore
        const blk = editorRef.current.blocks.getBlockByIndex(i);
        if (blk?.name === "mediaLibraryImage") {
          // @ts-ignore
          editorRef.current.blocks.delete(i);
        }
      }
    } catch {
      // do nothing
    }
  };

  /* ---------------- Tag/Category helpers ---------------- */

  const searchTags = async (q: string) => {
    const query = (q || "").trim();
    if (!query) return (await apiGet<SelectItem[] | null>("/api/blogs/tags/all")).json || [];
    return (await apiGet<SelectItem[] | null>("/api/blogs/tags", { params: { q: query } } as any)).json || [];
  };

  const searchCategories = async (q: string) => {
    const query = (q || "").trim();
    if (!query) return (await apiGet<SelectItem[] | null>("/api/blogs/categories/all")).json || [];
    return (await apiGet<SelectItem[] | null>("/api/blogs/categories", { params: { q: query } } as any)).json || [];
  };

  const createTag = async (name: string) => {
    if (!id) throw new Error("Save draft first");
    const res = await apiPost<SelectItem | null>(`/api/blogs/${id}/tags/new`, { name });
    if (!res.json) throw new Error("Create failed");
    return res.json;
  };

  const createCategory = async (name: string) => {
    if (!id) throw new Error("Save draft first");
    const res = await apiPost<SelectItem | null>(`/api/blogs/${id}/categories/new`, { name });
    if (!res.json) throw new Error("Create failed");
    return res.json;
  };

  /* ---------------- Autosave core ---------------- */

  const buildPayload = async () => {
    if (!editorRef.current) throw new Error("Editor not ready");
    const raw = await editorRef.current.save();
    const data = normalizeEditorImageUrls(raw as any);

    return {
      title: title.trim(),
      slug: (slug || slugify(title)).trim(),
      excerpt: excerpt?.trim() || undefined,
      coverImage: coverImage?.trim() || undefined,
      contentJson: data,
      contentFormat: "EDITORJS",
      published: !!published,

      seoTitle: seoTitle?.trim() || undefined,
      seoDesc: seoDesc?.trim() || undefined,
      seoKeywords: toKeywordString(seoKeywordsArr) || undefined,
    };
  };

  const autosave = async (_reason: string) => {
    if (!id) return;
    if (isBootstrappingRef.current) return;

    try {
      setAutoState("saving");
      setAutoMsg(`Saving…`);

      const payload = await buildPayload();

      const upd = await apiPut(`/api/blogs/${id}`, payload);
      if (!upd.ok) throw new Error("Autosave failed");

      await Promise.all([
        apiPost(`/api/blogs/${id}/tags`, { tagIds: selectedTagIds }).catch(() => null),
        apiPost(`/api/blogs/${id}/categories`, { categoryIds: selectedCategoryIds }).catch(() => null),
      ]);

      lastSavedAtRef.current = Date.now();
      setAutoState("saved");
      setAutoMsg(`Saved`);

      setTimeout(() => {
        if (Date.now() - lastSavedAtRef.current >= 900) {
          setAutoState("idle");
          setAutoMsg("");
        }
      }, 1000);
    } catch (e: any) {
      setAutoState("error");
      setAutoMsg(e?.message || "Autosave failed");
    }
  };

  const scheduleAutosave = (reason: string) => {
    if (!id) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => void autosave(reason), 900);
  };

  /* ---------------- Load ---------------- */

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);

      isBootstrappingRef.current = true;
      setAutoState("idle");
      setAutoMsg("");
      setSlugStatus("idle");

      try {
        // ✅ backend returns { user: {...} }
        const meRes = await apiGet<any>("/api/auth/me");
        const u = meRes.json?.user || meRes.json;
        if (!u?.id) throw new Error("Profile load failed");
        setMe({ id: u.id, role: normalizeRole(u.role) as Role });

        if (id) {
          const res = await apiGet<Blog | null>(`/api/blogs/${id}`);
          if (!res.json) throw new Error("Blog not found");

          const b = res.json;
          setTitle(b.title);
          setSlug(b.slug);
          setExcerpt(b.excerpt || "");
          setCoverImage(b.coverImage || "");
          setPublished(!!b.published);

          setSeoTitle((b as any).seoTitle || "");
          setSeoDesc((b as any).seoDesc || "");
          setSeoKeywordsArr(parseKeywordString((b as any).seoKeywords || ""));

          setDeletedAt((b as any).deletedAt || null);

          const [tRes, cRes] = await Promise.all([
            apiGet<SelectItem[] | null>(`/api/blogs/${id}/tags`),
            apiGet<SelectItem[] | null>(`/api/blogs/${id}/categories`),
          ]);

          setSelectedTagIds((tRes.json || []).map((x) => x.id));
          setSelectedCategoryIds((cRes.json || []).map((x) => x.id));

          setPendingEditorData(safeEditorData((b as any).contentJson));
          await checkSlugAvailability(b.slug, id);
        } else {
          setTitle("");
          setSlug("");
          setExcerpt("");
          setCoverImage("");
          setPublished(false);

          setSeoTitle("");
          setSeoDesc("");
          setSeoKeywordsArr([]);
          setKeywordDraft("");

          setSelectedTagIds([]);
          setSelectedCategoryIds([]);
          setDeletedAt(null);

          setPendingEditorData({ time: Date.now(), blocks: [] });
        }
      } catch (e: any) {
        setErr(e.message || "Failed to load");
      } finally {
        setLoading(false);
        setTimeout(() => {
          isBootstrappingRef.current = false;
        }, 150);
      }
    };

    void load();

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
      void destroyEditor();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ✅ Initialize editor only after render & pendingEditorData is set
  useEffect(() => {
    if (!pendingEditorData) return;
    void initEditor(pendingEditorData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEditorData]);

  /* ---------------- Slug auto + check ---------------- */

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  useEffect(() => {
    if (!slug) {
      setSlugStatus("idle");
      return;
    }
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    slugTimerRef.current = setTimeout(() => void checkSlugAvailability(slug, id), 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, id]);

  /* ---------------- Mark dirty on meta changes ---------------- */

  useEffect(() => {
    markDirty();
    scheduleAutosave("meta");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, excerpt, coverImage, published, seoTitle, seoDesc, seoKeywordsArr]);

  useEffect(() => {
    if (isBootstrappingRef.current) return;
    markDirty();
    scheduleAutosave("relations");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTagIds, selectedCategoryIds]);

  /* ---------------- Manual Save ---------------- */

  const save = async () => {
    setSavingManual(true);
    try {
      if (!title.trim()) throw new Error("Title required");
      if (!editorRef.current) throw new Error("Editor not ready");

      if (slugStatus === "taken") throw new Error("Slug is already taken. Please change it.");

      const payload = await buildPayload();

      if (!id) {
        const created = await apiPost<Blog | null>("/api/blogs", payload);
        if (!created.json) throw new Error("Create failed");

        toast.success("Draft created");

        await Promise.all([
          apiPost(`/api/blogs/${created.json.id}/tags`, { tagIds: selectedTagIds }).catch(() => null),
          apiPost(`/api/blogs/${created.json.id}/categories`, { categoryIds: selectedCategoryIds }).catch(() => null),
        ]);

        router.replace(`/dashboard/editor/blog-editor?id=${created.json.id}`);
      } else {
        await apiPut(`/api/blogs/${id}`, payload);
        toast.success("Saved");

        await Promise.all([
          apiPost(`/api/blogs/${id}/tags`, { tagIds: selectedTagIds }).catch(() => null),
          apiPost(`/api/blogs/${id}/categories`, { categoryIds: selectedCategoryIds }).catch(() => null),
        ]);

        lastSavedAtRef.current = Date.now();
        setAutoState("saved");
        setAutoMsg("Saved");
        setTimeout(() => {
          setAutoState("idle");
          setAutoMsg("");
        }, 900);
      }
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSavingManual(false);
    }
  };

  /* ---------------- Publish UX ---------------- */

  const setPublishState = async (next: boolean) => {
    if (!id) {
      toast.error("Save the draft first.");
      return;
    }
    if (!canPublish) {
      toast.error("You do not have permission to publish.");
      return;
    }
    if (deletedAt) {
      toast.error("Restore from Trash before publishing.");
      return;
    }

    try {
      setPublished(next);
      await apiPut(`/api/blogs/${id}`, { published: next });
      toast.success(next ? "Published" : "Unpublished");
    } catch (e: any) {
      toast.error(e?.message || "Publish change failed");
    }
  };

  /* ---------------- Soft delete / restore ---------------- */

  const moveToTrash = async () => {
    if (!id) return;
    if (!confirm("Move this post to Trash? (It will be unpublished)")) return;

    try {
      const res = await apiDelete(`/api/blogs/${id}`);
      if (!res.ok) throw new Error("Trash failed");
      toast.success("Moved to Trash");
      const b = await apiGet<Blog | null>(`/api/blogs/${id}`);
      setDeletedAt((b.json as any)?.deletedAt || new Date().toISOString());
      setPublished(false);
    } catch (e: any) {
      toast.error(e?.message || "Trash failed");
    }
  };

  const restoreFromTrash = async () => {
    if (!id) return;
    try {
      const res = await apiPost(`/api/blogs/${id}/restore`, {});
      if (!res.ok) throw new Error("Restore failed");
      toast.success("Restored");
      const b = await apiGet<Blog | null>(`/api/blogs/${id}`);
      setDeletedAt((b.json as any)?.deletedAt || null);
    } catch (e: any) {
      toast.error(e?.message || "Restore failed");
    }
  };

  /* ---------------- Keyword pills ---------------- */

  const addKeyword = (raw: string) => {
    const k = (raw || "").trim();
    if (!k) return;
    setSeoKeywordsArr((prev) => Array.from(new Set([...prev, k])));
    setKeywordDraft("");
  };

  const removeKeyword = (k: string) => setSeoKeywordsArr((prev) => prev.filter((x) => x !== k));

  /* ---------------- Render helpers ---------------- */

  const renderAutosaveBadge = () => {
    if (!id) return <span className="text-xs text-gray-500">Autosave starts after you create the draft.</span>;

    if (autoState === "saving") {
      return (
        <span className="inline-flex items-center gap-2 text-xs text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Saving…
        </span>
      );
    }
    if (autoState === "saved") {
      return (
        <span className="inline-flex items-center gap-2 text-xs text-green-700">
          <CheckCircle2 className="h-4 w-4" /> Saved
        </span>
      );
    }
    if (autoState === "dirty") {
      return (
        <span className="inline-flex items-center gap-2 text-xs text-amber-700">
          <AlertTriangle className="h-4 w-4" /> Unsaved changes
        </span>
      );
    }
    if (autoState === "error") {
      return (
        <span className="inline-flex items-center gap-2 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4" /> {autoMsg || "Autosave error"}
        </span>
      );
    }
    return <span className="text-xs text-gray-500">{autoMsg || ""}</span>;
  };

  const renderSlugHint = () => {
    if (!slug.trim()) return null;
    if (slugStatus === "checking") return <span className="text-xs text-gray-500">Checking slug…</span>;
    if (slugStatus === "available") return <span className="text-xs text-green-700">Slug available</span>;
    if (slugStatus === "taken") return <span className="text-xs text-red-700">Slug already taken</span>;
    if (slugStatus === "error") return <span className="text-xs text-amber-700">Could not verify slug</span>;
    return null;
  };

  if (loading) return <div className="p-6 text-sm text-gray-600">Loading editor…</div>;

  return (
    <div className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold">{id ? "Edit Blog Post" : "New Blog Post"}</h1>
          <div className="mt-1">{renderAutosaveBadge()}</div>

          {deletedAt && (
            <div className="mt-2 text-xs text-red-700">
              This post is in Trash (deletedAt: {new Date(deletedAt).toLocaleString()})
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {id && (
            <Button variant="outline" onClick={() => router.push(`/dashboard/editor/preview/${id}`)}>
              <Eye className="h-4 w-4 mr-2" /> Preview
            </Button>
          )}

          <Button onClick={save} disabled={savingManual || initingEditor || slugStatus === "taken"}>
            <Save className="h-4 w-4 mr-2" /> {savingManual ? "Saving…" : "Save"}
          </Button>

          {id && !deletedAt && canDelete && (
            <Button variant="destructive" onClick={moveToTrash}>
              <Trash2 className="h-4 w-4 mr-2" /> Trash
            </Button>
          )}

          {id && !!deletedAt && canDelete && (
            <Button variant="outline" onClick={restoreFromTrash}>
              <RotateCcw className="h-4 w-4 mr-2" /> Restore
            </Button>
          )}
        </div>
      </div>

      {err && <div className="mb-4 text-sm text-red-600">{err}</div>}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2 border rounded-xl p-4 bg-white">
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Title</div>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Slug</div>
              <Input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="Slug"
              />
              <div className="mt-1">{renderSlugHint()}</div>
              <div className="mt-1 text-xs text-gray-500">
                Tip: keep it short. If you change the title, slug auto-updates until you edit it manually.
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Excerpt</div>
              <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Excerpt" />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-gray-600">Content</div>
              <Button variant="outline" size="sm" onClick={() => setInlinePickerOpen(true)}>
                <ImageIcon className="h-4 w-4 mr-2" /> Insert from Media
              </Button>
            </div>

            <div className="border rounded-lg">
              <div id={editorHolderId} className="p-3 min-h-[320px]" />
            </div>

            <div className="text-xs text-gray-500">
              Tip: In the editor “+” menu, use <span className="font-medium">Media Library Image</span> to insert from your
              library.
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="border rounded-xl p-4 bg-white space-y-6">
          {/* Cover image */}
          <div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold">Cover image</span>
              <Button size="sm" variant="outline" onClick={() => setCoverPickerOpen(true)}>
                <ImageIcon className="h-4 w-4 mr-2" /> Choose
              </Button>
            </div>

            {coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveUrl(coverImage)} className="mt-2 rounded-lg h-40 w-full object-cover" />
            ) : (
              <div className="mt-2 text-xs text-gray-500">No cover selected.</div>
            )}
          </div>

          {/* Publish (WordPress-ish) */}
          <div className="rounded-xl border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold">Status</div>
                <div className="text-xs text-gray-500">
                  {published ? (
                    <span className="inline-flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <PencilLine className="h-3 w-3" /> Draft
                    </span>
                  )}
                </div>
                {!canPublish && <div className="mt-1 text-xs text-gray-500">You do not have permission to publish.</div>}
                {!!deletedAt && <div className="mt-1 text-xs text-red-700">In Trash — restore to publish.</div>}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={published ? "outline" : "default"}
                  disabled={!id || !canPublish || !!deletedAt}
                  onClick={() => setPublishState(true)}
                >
                  <Upload className="h-4 w-4 mr-2" /> Publish
                </Button>
                <Button size="sm" variant="outline" disabled={!id || !canPublish} onClick={() => setPublishState(false)}>
                  Unpublish
                </Button>
              </div>
            </div>
          </div>

          {/* SEO */}
          <div className="space-y-2">
            <div className="text-xs font-semibold">SEO</div>

            <div>
              <div className="text-xs text-gray-600 mb-1">SEO Title</div>
              <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Optional (defaults to title)" />
            </div>

            <div>
              <div className="text-xs text-gray-600 mb-1">SEO Description</div>
              <Textarea
                value={seoDesc}
                onChange={(e) => setSeoDesc(e.target.value)}
                placeholder="Optional (defaults to excerpt)"
                className="min-h-[90px]"
              />
            </div>

            {/* ✅ SEO Keywords as chips */}
            <div>
              <div className="text-xs text-gray-600 mb-1">SEO Keywords</div>
              <div className="flex flex-wrap gap-2 mb-2">
                {seoKeywordsArr.length === 0 && (
                  <div className="text-xs text-gray-500">Add keywords like a CMS: type and press Enter.</div>
                )}
                {seoKeywordsArr.map((k) => (
                  <span key={k} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs bg-white">
                    {k}
                    <button
                      type="button"
                      onClick={() => removeKeyword(k)}
                      className="text-gray-500 hover:text-gray-900"
                      aria-label="Remove keyword"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <Input
                value={keywordDraft}
                onChange={(e) => setKeywordDraft(e.target.value)}
                placeholder="Type a keyword and press Enter"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword(keywordDraft);
                  }
                  if (e.key === ",") {
                    e.preventDefault();
                    addKeyword(keywordDraft);
                  }
                }}
                onBlur={() => addKeyword(keywordDraft)}
              />
            </div>
          </div>

          {/* Tags/Categories */}
          <SearchMultiSelect
            label="Tags"
            selectedIds={selectedTagIds}
            onChange={(ids) => setSelectedTagIds(ids)}
            onSearch={searchTags}
            allowCreate={!!id}
            onCreate={createTag}
          />

          <SearchMultiSelect
            label="Categories"
            selectedIds={selectedCategoryIds}
            onChange={(ids) => setSelectedCategoryIds(ids)}
            onSearch={searchCategories}
            allowCreate={!!id}
            onCreate={createCategory}
          />
        </div>
      </div>

      {/* Cover picker: choose OR upload, and upload auto-selects now (after modal patch below) */}
      <MediaPickerModal
        open={coverPickerOpen}
        onOpenChange={setCoverPickerOpen}
        dir="blog"
        onSelect={(url: string) => setCoverImage(url)}
        autoSelectOnUpload
      />

      {/* Inline picker: inserts into EditorJS */}
      <MediaPickerModal
        open={inlinePickerOpen}
        onOpenChange={setInlinePickerOpen}
        dir="blog"
        onSelect={(url: string) => {
          insertLibraryImage(url);
          setInlinePickerOpen(false);
          toast.success("Image inserted");
        }}
      />
    </div>
  );
}
