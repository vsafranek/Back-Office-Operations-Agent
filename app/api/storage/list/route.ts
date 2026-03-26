import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { getEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

type ListedItem = {
  name: string;
  id?: string | null;
  updated_at?: string;
  created_at?: string;
  metadata?: { size?: number } | null;
};

type StorageFile = {
  path: string;
  name: string;
  size: number;
  updated_at?: string;
};

type StorageFolder = {
  path: string;
  name: string;
};

type SortBy = "path" | "updated_at" | "size";
type SortOrder = "asc" | "desc";

async function listPrefix(params: {
  bucket: string;
  prefix: string;
  supabase: ReturnType<typeof getSupabaseAdminClient>;
}): Promise<{ files: StorageFile[]; folders: StorageFolder[] }> {
  const { data, error } = await params.supabase.storage.from(params.bucket).list(params.prefix, {
    limit: 100,
    sortBy: { column: "name", order: "asc" }
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ListedItem[];
  const files: StorageFile[] = [];
  const folders: StorageFolder[] = [];

  for (const row of rows) {
    const fullPath = params.prefix ? `${params.prefix}/${row.name}` : row.name;
    const looksLikeFolder = !row.id && !row.metadata;
    if (looksLikeFolder) {
      folders.push({ path: fullPath, name: row.name });
    } else {
      files.push({
        path: fullPath,
        name: row.name,
        size: Number(row.metadata?.size ?? 0),
        updated_at: row.updated_at
      });
    }
  }
  return { files, folders };
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser(request);
    const env = getEnv();
    const supabase = getSupabaseAdminClient();
    const url = new URL(request.url);
    const prefix = url.searchParams.get("prefix")?.trim() ?? "reports";
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const ext = (url.searchParams.get("ext") ?? "").trim().toLowerCase();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "25")));
    const sortByValue = (url.searchParams.get("sortBy") ?? "updated_at").trim();
    const sortOrderValue = (url.searchParams.get("order") ?? "desc").trim();
    const sortBy: SortBy = ["path", "updated_at", "size"].includes(sortByValue)
      ? (sortByValue as SortBy)
      : "updated_at";
    const sortOrder: SortOrder = ["asc", "desc"].includes(sortOrderValue)
      ? (sortOrderValue as SortOrder)
      : "desc";
    const listed = await listPrefix({
      bucket: env.SUPABASE_STORAGE_BUCKET,
      prefix,
      supabase
    });

    const filesFiltered = listed.files.filter((file) => {
      const qOk = !q || file.path.toLowerCase().includes(q) || file.name.toLowerCase().includes(q);
      const extOk = !ext || file.path.toLowerCase().endsWith(ext.startsWith(".") ? ext : `.${ext}`);
      return qOk && extOk;
    });
    const folders = listed.folders
      .filter((folder) => !q || folder.path.toLowerCase().includes(q) || folder.name.toLowerCase().includes(q))
      .sort((a, b) => (a.path < b.path ? -1 : 1));

    filesFiltered.sort((a, b) => {
      if (sortBy === "size") {
        return sortOrder === "asc" ? a.size - b.size : b.size - a.size;
      }
      if (sortBy === "updated_at") {
        const av = new Date(a.updated_at ?? 0).getTime();
        const bv = new Date(b.updated_at ?? 0).getTime();
        return sortOrder === "asc" ? av - bv : bv - av;
      }
      if (a.path === b.path) return 0;
      return sortOrder === "asc" ? (a.path < b.path ? -1 : 1) : a.path < b.path ? 1 : -1;
    });

    const total = filesFiltered.length;
    const start = (page - 1) * pageSize;
    const paged = filesFiltered.slice(start, start + pageSize);

    return Response.json({
      bucket: env.SUPABASE_STORAGE_BUCKET,
      prefix,
      folders,
      filters: { q, ext, sortBy, sortOrder, page, pageSize },
      total,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      files: paged
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
