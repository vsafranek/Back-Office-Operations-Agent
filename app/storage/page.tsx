"use client";

import {
  Anchor,
  Button,
  Checkbox,
  Group,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { modals } from "@mantine/modals";
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

  function confirmRemove(path: string) {
    modals.openConfirmModal({
      title: "Smazat soubor?",
      children: (
        <Text size="sm" style={{ wordBreak: "break-all" }}>
          {path}
        </Text>
      ),
      labels: { confirm: "Smazat", cancel: "Zrušit" },
      confirmProps: { color: "red" },
      onConfirm: () => void remove(path)
    });
  }

  async function remove(path: string) {
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

  const crumbs = prefix.split("/").filter(Boolean);

  return (
    <Stack gap="lg" maw={1100}>
      <div>
        <Title order={1}>Storage Browser</Title>
        <Anchor href="/dashboard" size="sm" mt="xs" display="inline-block">
          Zpět na dashboard
        </Anchor>
      </div>

      <Group>
        <Button onClick={() => void loadFiles()} loading={loading}>
          {loading ? "Načítám..." : "Obnovit seznam"}
        </Button>
      </Group>

      <Paper withBorder p="md" radius="md">
        <Group align="flex-end" grow gap="sm" wrap="wrap">
          <TextInput label="Prefix" value={prefix} readOnly />
          <TextInput
            label="Hledat path/name"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <TextInput label="Přípona" value={ext} onChange={(e) => setExt(e.currentTarget.value)} placeholder="pdf/pptx/csv" />
          <Select
            label="Řazení"
            value={sortBy}
            onChange={(v) => setSortBy((v as typeof sortBy) ?? "updated_at")}
            data={[
              { value: "updated_at", label: "updated_at" },
              { value: "path", label: "path" },
              { value: "size", label: "size" }
            ]}
          />
          <Select
            label="Pořadí"
            value={order}
            onChange={(v) => setOrder((v as typeof order) ?? "desc")}
            data={[
              { value: "desc", label: "sestupně" },
              { value: "asc", label: "vzestupně" }
            ]}
          />
          <Select
            label="Na stránku"
            value={String(pageSize)}
            onChange={(v) => setPageSize(Number(v))}
            data={[
              { value: "10", label: "10" },
              { value: "25", label: "25" },
              { value: "50", label: "50" },
              { value: "100", label: "100" }
            ]}
          />
        </Group>
      </Paper>

      <Group gap="xs" wrap="wrap">
        <Button size="compact-sm" variant="light" onClick={() => setPrefix("reports")}>
          Root
        </Button>
        {crumbs.map((part, idx) => {
          const crumb = crumbs.slice(0, idx + 1).join("/");
          return (
            <Button key={crumb} size="compact-sm" variant="subtle" onClick={() => setPrefix(crumb)}>
              / {part}
            </Button>
          );
        })}
      </Group>

      {folders.length > 0 ? (
        <Group gap="xs" wrap="wrap">
          {folders.map((folder) => (
            <Button key={folder.path} size="compact-sm" variant="light" onClick={() => setPrefix(folder.path)}>
              {folder.name}/
            </Button>
          ))}
        </Group>
      ) : null}

      {error ? (
        <Text c="red" size="sm">
          {error}
        </Text>
      ) : null}

      <Text size="sm" c="dimmed">
        Celkem: {total} souborů | Strana {page}/{pages}
      </Text>

      <Group gap="sm" wrap="wrap">
        <Button
          size="xs"
          variant="default"
          onClick={() =>
            setSelectedPaths((prev) => (prev.length === files.length ? [] : files.map((file) => file.path)))
          }
          disabled={files.length === 0}
        >
          {selectedPaths.length === files.length ? "Zrušit výběr" : "Vybrat vše"}
        </Button>
        <Button
          size="xs"
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
        </Button>
        <Button
          size="xs"
          color="red"
          variant="light"
          disabled={selectedPaths.length === 0}
          onClick={() => {
            const count = selectedPaths.length;
            modals.openConfirmModal({
              title: "Smazat vybrané soubory?",
              children: <Text size="sm">Počet souborů: {count}</Text>,
              labels: { confirm: "Smazat", cancel: "Zrušit" },
              confirmProps: { color: "red" },
              onConfirm: async () => {
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
              }
            });
          }}
        >
          Smazat vybrané
        </Button>
      </Group>

      <Table.ScrollContainer minWidth={720}>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Výběr</Table.Th>
              <Table.Th>Path</Table.Th>
              <Table.Th>Velikost</Table.Th>
              <Table.Th>Upraveno</Table.Th>
              <Table.Th>Akce</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {files.map((file) => (
              <Table.Tr key={file.path}>
                <Table.Td>
                  <Checkbox
                    checked={selectedPaths.includes(file.path)}
                    onChange={(e) =>
                      setSelectedPaths((prev) =>
                        e.currentTarget.checked ? [...prev, file.path] : prev.filter((p) => p !== file.path)
                      )
                    }
                  />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" style={{ wordBreak: "break-all" }}>
                    {file.path}
                  </Text>
                </Table.Td>
                <Table.Td>{file.size}</Table.Td>
                <Table.Td>{file.updated_at ?? "—"}</Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="wrap">
                    <Button size="compact-xs" variant="light" onClick={() => void download(file.path, "original")}>
                      Stáhnout
                    </Button>
                    {file.path.endsWith(".pptx") ? (
                      <Button size="compact-xs" variant="light" onClick={() => void download(file.path, "pdf")}>
                        PDF
                      </Button>
                    ) : null}
                    {file.path.endsWith(".pdf") ? (
                      <Button size="compact-xs" variant="light" onClick={() => void download(file.path, "pptx")}>
                        PPTX
                      </Button>
                    ) : null}
                    <Button size="compact-xs" color="red" variant="subtle" onClick={() => confirmRemove(file.path)}>
                      Smazat
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Group>
        <Button disabled={page <= 1 || loading} onClick={() => void loadFiles(page - 1)}>
          Předchozí
        </Button>
        <Button disabled={page >= pages || loading} onClick={() => void loadFiles(page + 1)}>
          Další
        </Button>
      </Group>
    </Stack>
  );
}
