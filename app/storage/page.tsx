"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

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

export default function StoragePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [folders, setFolders] = useState<StorageFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefix, setPrefix] = useState("reports");
  const [query, setQuery] = useState("");
  const [ext, setExt] = useState("");
  const [sortBy, setSortBy] = useState<"path" | "updated_at" | "size">("updated_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);

  async function loadFiles(nextPage = page) {
    setLoading(true);
    setError(null);
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) {
      router.push("/auth/login");
      return;
    }
    const qs = new URLSearchParams({
      prefix,
      q: query,
      ext,
      sortBy,
      order,
      page: String(nextPage),
      pageSize: String(pageSize)
    });
    const response = await fetch(`/api/storage/list?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error ?? "Failed to load storage files.");
      return;
    }
    setFolders(payload.folders ?? []);
    setFiles(payload.files ?? []);
    setTotal(Number(payload.total ?? 0));
    setPages(Number(payload.pages ?? 1));
    setPage(nextPage);
    setSelectedPaths([]);
  }

  useEffect(() => {
    void loadFiles(1);
  }, [prefix, query, ext, sortBy, order, pageSize]);

  async function download(path: string, format: "original" | "pptx" | "pdf") {
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) {
      router.push("/auth/login");
      return;
    }
    const response = await fetch(`/api/storage/download?path=${encodeURIComponent(path)}&format=${format}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Download link generation failed.");
      return;
    }
    window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function remove(path: string) {
    const approved = window.confirm(`Opravdu smazat soubor?\n${path}`);
    if (!approved) return;
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) {
      router.push("/auth/login");
      return;
    }
    const response = await fetch(`/api/storage/file?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Delete failed.");
      return;
    }
    await loadFiles(Math.min(page, pages));
  }

  return (
    <main style={{ maxWidth: 1100 }}>
      <h1>Storage Browser</h1>
      <p>
        <a href="/dashboard">Zpět na dashboard</a>
      </p>
      <button type="button" onClick={() => void loadFiles()} disabled={loading}>
        {loading ? "Načítám..." : "Obnovit seznam"}
      </button>
      <div style={{ marginTop: 12, display: "grid", gap: 8, gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
        <input value={prefix} readOnly placeholder="prefix" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="hledat path/name" />
        <input value={ext} onChange={(e) => setExt(e.target.value)} placeholder="ext (pdf/pptx/csv)" />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "path" | "updated_at" | "size")}>
          <option value="updated_at">Sort: updated_at</option>
          <option value="path">Sort: path</option>
          <option value="size">Sort: size</option>
        </select>
        <select value={order} onChange={(e) => setOrder(e.target.value as "asc" | "desc")}>
          <option value="desc">Order: desc</option>
          <option value="asc">Order: asc</option>
        </select>
        <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setPrefix("reports")}>
          Root
        </button>
        {prefix
          .split("/")
          .filter(Boolean)
          .map((part, idx, arr) => {
            const crumb = arr.slice(0, idx + 1).join("/");
            return (
              <button key={crumb} type="button" onClick={() => setPrefix(crumb)}>
                / {part}
              </button>
            );
          })}
      </div>
      {folders.length > 0 ? (
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {folders.map((folder) => (
            <button key={folder.path} type="button" onClick={() => setPrefix(folder.path)}>
              {folder.name}/
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <p style={{ marginTop: 10 }}>
        Celkem: {total} souborů | Strana {page}/{pages}
      </p>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() =>
            setSelectedPaths((prev) => (prev.length === files.length ? [] : files.map((file) => file.path)))
          }
          disabled={files.length === 0}
        >
          {selectedPaths.length === files.length ? "Zrušit výběr" : "Vybrat vše"}
        </button>
        <button
          type="button"
          disabled={selectedPaths.length === 0}
          onClick={async () => {
            const sessionResult = await supabase.auth.getSession();
            const accessToken = sessionResult.data.session?.access_token;
            if (!accessToken) return;
            const response = await fetch("/api/storage/download-batch", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`
              },
              body: JSON.stringify({ paths: selectedPaths, format: "original" })
            });
            const payload = await response.json();
            if (!response.ok) {
              setError(payload.error ?? "Bulk download failed.");
              return;
            }
            for (const item of payload.results ?? []) {
              if (item?.signedUrl) window.open(item.signedUrl, "_blank", "noopener,noreferrer");
            }
          }}
        >
          Stáhnout vybrané
        </button>
        <button
          type="button"
          disabled={selectedPaths.length === 0}
          onClick={async () => {
            const approved = window.confirm(`Smazat ${selectedPaths.length} souborů?`);
            if (!approved) return;
            const sessionResult = await supabase.auth.getSession();
            const accessToken = sessionResult.data.session?.access_token;
            if (!accessToken) return;
            const response = await fetch("/api/storage/files", {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`
              },
              body: JSON.stringify({ paths: selectedPaths })
            });
            const payload = await response.json();
            if (!response.ok) {
              setError(payload.error ?? "Bulk delete failed.");
              return;
            }
            await loadFiles(Math.min(page, pages));
          }}
        >
          Smazat vybrané
        </button>
      </div>
      <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Select</th>
            <th style={{ textAlign: "left" }}>Path</th>
            <th style={{ textAlign: "left" }}>Size</th>
            <th style={{ textAlign: "left" }}>Updated</th>
            <th style={{ textAlign: "left" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.path}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedPaths.includes(file.path)}
                  onChange={(e) =>
                    setSelectedPaths((prev) =>
                      e.target.checked ? [...prev, file.path] : prev.filter((path) => path !== file.path)
                    )
                  }
                />
              </td>
              <td>{file.path}</td>
              <td>{file.size}</td>
              <td>{file.updated_at ?? "-"}</td>
              <td style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => void download(file.path, "original")}>
                  Stáhnout
                </button>
                {file.path.endsWith(".pptx") ? (
                  <button type="button" onClick={() => void download(file.path, "pdf")}>
                    Stáhnout PDF
                  </button>
                ) : null}
                {file.path.endsWith(".pdf") ? (
                  <button type="button" onClick={() => void download(file.path, "pptx")}>
                    Stáhnout PPTX
                  </button>
                ) : null}
                <button type="button" onClick={() => void remove(file.path)}>
                  Smazat
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button type="button" disabled={page <= 1 || loading} onClick={() => void loadFiles(page - 1)}>
          Předchozí
        </button>
        <button type="button" disabled={page >= pages || loading} onClick={() => void loadFiles(page + 1)}>
          Další
        </button>
      </div>
    </main>
  );
}
