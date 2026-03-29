"use client";

import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Checkbox,
  Drawer,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton
} from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import {
  IconArrowBackUp,
  IconChevronRight,
  IconDownload,
  IconEye,
  IconFile,
  IconFileText,
  IconFileTypePdf,
  IconFileTypePpt,
  IconFileTypeXls,
  IconFolder,
  IconLayoutGrid,
  IconLibrary,
  IconList,
  IconPhoto,
  IconRefresh,
  IconSearch,
  IconTrash
} from "@tabler/icons-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

function formatBytes(n: number): string {
  if (!n && n !== 0) return "—";
  if (n === 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"] as const;
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}

function parentPrefix(p: string): string | null {
  const t = p.replace(/\/+$/, "");
  if (!t) return null;
  const i = t.lastIndexOf("/");
  if (i === -1) return "";
  return t.slice(0, i);
}

const PREVIEW_MAX_TEXT_BYTES = 2 * 1024 * 1024;

type PreviewRenderKind = "image" | "pdf" | "text";

function getPreviewRenderKind(name: string, size: number): PreviewRenderKind | null {
  const lower = name.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lower)) return "image";
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(txt|md|csv|json|log|xml|ya?ml|tsv|html?|css)$/i.test(lower)) {
    if (size > PREVIEW_MAX_TEXT_BYTES) return null;
    return "text";
  }
  return null;
}

function fileKind(name: string): "pdf" | "ppt" | "sheet" | "image" | "text" | "other" {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) return "ppt";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) return "sheet";
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp"))
    return "image";
  if (lower.endsWith(".md") || lower.endsWith(".txt")) return "text";
  return "other";
}

function FileTypeIcon({ name, size = 28 }: { name: string; size?: number }) {
  const kind = fileKind(name);
  const common = { size, stroke: 1.35 };
  switch (kind) {
    case "pdf":
      return <IconFileTypePdf {...common} color="var(--mantine-color-red-6)" />;
    case "ppt":
      return <IconFileTypePpt {...common} color="var(--mantine-color-orange-6)" />;
    case "sheet":
      return <IconFileTypeXls {...common} color="var(--mantine-color-green-7)" />;
    case "image":
      return <IconPhoto {...common} color="var(--mantine-color-violet-6)" />;
    case "text":
      return <IconFileText {...common} color="var(--mantine-color-gray-6)" />;
    default:
      return <IconFile {...common} color="var(--mantine-color-gray-5)" />;
  }
}

export function StorageBrowser() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [folders, setFolders] = useState<StorageFolder[]>([]);
  const [rootFolders, setRootFolders] = useState<StorageFolder[]>([]);
  const [bucketName, setBucketName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefix, setPrefix] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query.trim(), 320);
  const [ext, setExt] = useState("");
  const [sortBy, setSortBy] = useState<"path" | "updated_at" | "size">("updated_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [libsOpened, { open: openLibs, close: closeLibs }] = useDisclosure(false);
  const [previewOpened, { open: openPreviewDrawer, close: closePreviewDrawer }] = useDisclosure(false);
  const [previewFile, setPreviewFile] = useState<StorageFile | null>(null);
  const [previewRender, setPreviewRender] = useState<PreviewRenderKind | "unsupported" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const crumbs = prefix.split("/").filter(Boolean);
  const parent = parentPrefix(prefix);

  const loadFiles = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setError(null);
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) {
        router.push("/auth/login");
        setLoading(false);
        return;
      }
      const qs = new URLSearchParams({
        prefix,
        q: debouncedQuery,
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
        setError(payload.error ?? "Nepodařilo se načíst soubory.");
        return;
      }
      if (typeof payload.bucket === "string") setBucketName(payload.bucket);
      setFolders(payload.folders ?? []);
      setFiles(payload.files ?? []);
      setTotal(Number(payload.total ?? 0));
      setPages(Number(payload.pages ?? 1));
      setPage(nextPage);
      setSelectedPaths([]);
    },
    [supabase, router, prefix, debouncedQuery, ext, sortBy, order, pageSize]
  );

  async function downloadFromSignedUrl(signedUrl: string, pathForName: string) {
    const nameFromPath = pathForName.split("/").pop() ?? "soubor";
    try {
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error("fetch");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = nameFromPath;
      a.rel = "noopener";
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch {
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function refreshCurrentPage() {
    await loadFiles(page);
  }

  async function loadRootLibraries() {
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) return;
    const qs = new URLSearchParams({ prefix: "", page: "1", pageSize: "100", q: "", ext: "" });
    const response = await fetch(`/api/storage/list?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = await response.json();
    if (response.ok) {
      setRootFolders(payload.folders ?? []);
      if (typeof payload.bucket === "string") setBucketName(payload.bucket);
    }
  }

  useEffect(() => {
    void loadRootLibraries();
  }, [supabase]);

  useEffect(() => {
    void loadFiles(1);
  }, [loadFiles, prefix, debouncedQuery, ext, sortBy, order, pageSize]);

  const downloadToDevice = async (path: string, format: "original" | "pptx" | "pdf") => {
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
      setError(payload.error ?? "Odkaz ke stažení se nepodařilo vytvořit.");
      return;
    }
    const signedUrl = payload.signedUrl as string;
    const pathForName = (payload.path as string) ?? path;
    await downloadFromSignedUrl(signedUrl, pathForName);
  };

  async function fetchInlineSignedUrl(
    path: string,
    format: "original" | "pdf" | "pptx" = "original"
  ): Promise<string> {
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) {
      router.push("/auth/login");
      throw new Error("Nejste přihlášeni.");
    }
    const reqUrl = `/api/storage/download?path=${encodeURIComponent(path)}&format=${format}&disposition=inline`;
    const response = await fetch(reqUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(typeof payload.error === "string" ? payload.error : "Nepodařilo se vytvořit odkaz.");
    }
    return payload.signedUrl as string;
  }

  function resetPreviewState() {
    setPreviewFile(null);
    setPreviewRender(null);
    setPreviewUrl(null);
    setPreviewText(null);
    setPreviewBusy(false);
    setPreviewError(null);
  }

  function handleClosePreview() {
    resetPreviewState();
    closePreviewDrawer();
  }

  async function openFilePreview(file: StorageFile) {
    const kind = getPreviewRenderKind(file.name, file.size);
    setPreviewError(null);
    setPreviewText(null);
    setPreviewUrl(null);
    setPreviewFile(file);
    setPreviewRender(kind ?? "unsupported");
    openPreviewDrawer();

    if (!kind) return;

    setPreviewBusy(true);
    try {
      const signedUrl = await fetchInlineSignedUrl(file.path, "original");
      if (kind === "image" || kind === "pdf") {
        setPreviewUrl(signedUrl);
        return;
      }
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error("Nepodařilo se načíst obsah souboru.");
      const text = await res.text();
      setPreviewText(text);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Náhled selhal.");
    } finally {
      setPreviewBusy(false);
    }
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
      setError(payload.error ?? "Smazání se nezdařilo.");
      return;
    }
    void loadFiles(Math.min(page, pages));
    void loadRootLibraries();
  }

  function toggleSelected(path: string) {
    setSelectedPaths((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]));
  }

  async function bulkDownload() {
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
      setError(payload.error ?? "Hromadné stažení selhalo.");
      return;
    }
    for (const item of payload.results ?? []) {
      if (item.signedUrl && item.path && !item.error) {
        await downloadFromSignedUrl(item.signedUrl as string, item.path as string);
      }
    }
  }

  async function bulkDelete() {
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
      setError(payload.error ?? "Hromadné smazání selhalo.");
      return;
    }
    void loadFiles(Math.min(page, pages));
    void loadRootLibraries();
  }

  const sidebar = (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={700} c="dimmed">
        Knihovny
      </Text>
      <UnstyledButton
        onClick={() => {
          setPrefix("");
          closeLibs();
        }}
        p="sm"
        style={{
          borderRadius: 8,
          background: prefix === "" ? "var(--mantine-color-indigo-light)" : undefined
        }}
      >
        <Group gap="sm" wrap="nowrap">
          <IconLibrary size={18} stroke={1.5} />
          <Text size="sm" fw={prefix === "" ? 600 : 500}>
            Kořen bucketu
          </Text>
        </Group>
      </UnstyledButton>
      <ScrollArea.Autosize mah={360}>
        <Stack gap={4}>
          {rootFolders.map((f) => (
            <UnstyledButton
              key={f.path}
              onClick={() => {
                setPrefix(f.path);
                closeLibs();
              }}
              p="sm"
              style={{
                borderRadius: 8,
                background: prefix === f.path ? "var(--mantine-color-indigo-light)" : undefined
              }}
            >
              <Group gap="sm" wrap="nowrap">
                <IconFolder size={18} stroke={1.5} color="var(--mantine-color-yellow-7)" />
                <Text size="sm" lineClamp={2} style={{ wordBreak: "break-all" }}>
                  {f.name}
                </Text>
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );

  const breadcrumbRow = (
    <Group gap={6} wrap="wrap" align="center">
      <UnstyledButton
        onClick={() => setPrefix("")}
        c={!prefix ? "indigo" : undefined}
        fw={!prefix ? 600 : 500}
        style={{ borderRadius: 6 }}
        p={4}
      >
        {bucketName || "Storage"}
      </UnstyledButton>
      {crumbs.map((part, idx) => {
        const target = crumbs.slice(0, idx + 1).join("/");
        const isLast = idx === crumbs.length - 1;
        return (
          <Group key={target} gap={6} wrap="nowrap">
            <IconChevronRight size={14} color="var(--mantine-color-dimmed)" />
            <UnstyledButton
              onClick={() => !isLast && setPrefix(target)}
              fw={isLast ? 600 : 500}
              c={isLast ? "dark" : "indigo"}
              p={4}
              style={{ borderRadius: 6 }}
            >
              {part}
            </UnstyledButton>
          </Group>
        );
      })}
    </Group>
  );

  const previewDrawer = (
    <Drawer
      opened={previewOpened}
      onClose={handleClosePreview}
      position="right"
      size="xl"
      title={
        previewFile ? (
          <Group gap="sm" wrap="nowrap" style={{ maxWidth: "min(100%, 65vw)" }}>
            <FileTypeIcon name={previewFile.name} size={22} />
            <Text fw={600} lineClamp={2} style={{ wordBreak: "break-word" }}>
              {previewFile.name}
            </Text>
          </Group>
        ) : (
          "Náhled"
        )
      }
      padding="md"
      zIndex={500}
    >
      <Stack gap="md">
        <Group gap="xs" wrap="wrap">
          {previewFile ? (
            <Button
              size="compact-sm"
              leftSection={<IconDownload size={16} />}
              onClick={() => void downloadToDevice(previewFile.path, "original")}
            >
              Stáhnout
            </Button>
          ) : null}
          <Button size="compact-sm" variant="default" onClick={handleClosePreview}>
            Zavřít
          </Button>
        </Group>

        {previewBusy ? (
          <Group justify="center" py="xl">
            <Loader size="md" />
          </Group>
        ) : null}

        {previewError ? (
          <Text c="red" size="sm">
            {previewError}
          </Text>
        ) : null}

        {!previewBusy && previewRender === "unsupported" && previewFile ? (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Pro tento typ souboru není v prohlížeči náhled k dispozici (např. PowerPoint, Excel jako XLSX). Otevřete ho
              lokálně po stažení.
            </Text>
            {previewFile.size > PREVIEW_MAX_TEXT_BYTES &&
            /\.(txt|md|csv|json|log|xml|ya?ml|tsv|html?|css)$/i.test(previewFile.name) ? (
              <Text size="sm" c="dimmed">
                Textový soubor je větší než {formatBytes(PREVIEW_MAX_TEXT_BYTES)} — zobrazit bez stažení by zpomalilo
                stránku.
              </Text>
            ) : null}
          </Stack>
        ) : null}

        {!previewBusy && previewRender === "image" && previewUrl ? (
          <Box ta="center">
            <img
              src={previewUrl}
              alt=""
              style={{ maxWidth: "100%", maxHeight: "min(75vh, 900px)", objectFit: "contain" }}
            />
          </Box>
        ) : null}

        {!previewBusy && previewRender === "pdf" && previewUrl ? (
          <Box>
            <iframe
              title={previewFile?.name ?? "PDF"}
              src={previewUrl}
              style={{
                width: "100%",
                height: "min(75vh, 820px)",
                border: 0,
                borderRadius: 8
              }}
            />
          </Box>
        ) : null}

        {!previewBusy && previewRender === "text" && previewText !== null ? (
          <ScrollArea h="min(75vh, 820px)" type="auto" offsetScrollbars>
            <Box
              component="pre"
              p="md"
              style={{
                margin: 0,
                fontFamily: "var(--mantine-font-family-monospace)",
                fontSize: 12,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}
            >
              {previewText}
            </Box>
          </ScrollArea>
        ) : null}
      </Stack>
    </Drawer>
  );

  return (
    <>
    <Stack gap="md" style={{ flex: 1, minHeight: 0 }} maw={1400} mx="auto" w="100%">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={1}>Dokumenty</Title>
          <Text size="sm" c="dimmed" mt={4}>
            Prohlížení souborů v úložišti — náhledy (obrázky, PDF, text), stahování, mazání, struktura složek.
          </Text>
          <Anchor component={Link} href="/dashboard" size="sm" mt="xs" display="inline-block">
            Zpět na dashboard
          </Anchor>
        </div>
        <Group gap="xs">
          <Button
            variant="light"
            leftSection={<IconLibrary size={18} />}
            hiddenFrom="sm"
            onClick={openLibs}
          >
            Knihovny
          </Button>
          <Tooltip label="Obnovit">
            <ActionIcon variant="light" size="lg" onClick={() => void refreshCurrentPage()} loading={loading}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Group align="stretch" wrap="nowrap" style={{ flex: 1, minHeight: 420 }}>
        <Paper
          visibleFrom="sm"
          withBorder
          p="md"
          radius="md"
          w={270}
          style={{ flexShrink: 0 }}
        >
          {sidebar}
        </Paper>

        <Drawer opened={libsOpened} onClose={closeLibs} title="Knihovny" position="left" size="85%" hiddenFrom="sm">
          {sidebar}
        </Drawer>

        <Stack gap="md" style={{ flex: 1, minWidth: 0 }}>
          <Paper withBorder p="md" radius="md">
            <Stack gap="md">
              <Group justify="space-between" wrap="wrap" align="center">
                {breadcrumbRow}
                <Group gap="xs">
                  <Tooltip label="O úroveň výš">
                    <span>
                      <Button
                        variant="default"
                        size="compact-sm"
                        leftSection={<IconArrowBackUp size={16} />}
                        disabled={parent === null}
                        onClick={() => {
                          if (parent !== null) setPrefix(parent);
                        }}
                      >
                        Nahoru
                      </Button>
                    </span>
                  </Tooltip>
                </Group>
              </Group>

              <Group align="flex-end" grow gap="sm" wrap="wrap">
                <TextInput
                  label="Hledat"
                  placeholder="Název nebo část cesty…"
                  leftSection={<IconSearch size={16} />}
                  value={query}
                  onChange={(e) => setQuery(e.currentTarget.value)}
                />
                <TextInput
                  label="Přípona"
                  value={ext}
                  onChange={(e) => setExt(e.target.value)}
                  placeholder="pdf, pptx, csv…"
                  w={{ base: "100%", sm: 140 }}
                />
                <Select
                  label="Řadit podle"
                  value={sortBy}
                  onChange={(v) => setSortBy((v as typeof sortBy) ?? "updated_at")}
                  data={[
                    { value: "updated_at", label: "Upraveno" },
                    { value: "path", label: "Cesta" },
                    { value: "size", label: "Velikost" }
                  ]}
                  w={{ base: "100%", sm: 160 }}
                />
                <Select
                  label="Pořadí"
                  value={order}
                  onChange={(v) => setOrder((v as typeof order) ?? "desc")}
                  data={[
                    { value: "desc", label: "Sestupně" },
                    { value: "asc", label: "Vzestupně" }
                  ]}
                  w={{ base: "100%", sm: 130 }}
                />
                <Select
                  label="Na stránku"
                  value={String(pageSize)}
                  onChange={(v) => setPageSize(Number(v))}
                  data={[
                    { value: "20", label: "20" },
                    { value: "50", label: "50" },
                    { value: "100", label: "100" }
                  ]}
                  w={{ base: "100%", sm: 120 }}
                />
              </Group>

              <Group justify="space-between" wrap="wrap">
                <SegmentedControl
                  value={view}
                  onChange={(v) => setView(v as typeof view)}
                  data={[
                    { label: <Group gap={6} justify="center"><IconLayoutGrid size={16} /> Mřížka</Group>, value: "grid" },
                    { label: <Group gap={6} justify="center"><IconList size={16} /> Seznam</Group>, value: "list" }
                  ]}
                />
                <Text size="sm" c="dimmed">
                  {total} souborů · strana {page} / {pages}
                </Text>
              </Group>
            </Stack>
          </Paper>

          {error ? (
            <Text c="red" size="sm">
              {error}
            </Text>
          ) : null}

          {selectedPaths.length > 0 ? (
            <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-indigo-light)">
              <Group justify="space-between" wrap="wrap">
                <Text size="sm" fw={600}>
                  Vybráno: {selectedPaths.length}
                </Text>
                <Group gap="xs">
                  <Button size="compact-sm" leftSection={<IconDownload size={16} />} onClick={() => void bulkDownload()}>
                    Stáhnout
                  </Button>
                  <Button
                    size="compact-sm"
                    color="red"
                    variant="light"
                    leftSection={<IconTrash size={16} />}
                    onClick={() => {
                      modals.openConfirmModal({
                        title: "Smazat vybrané soubory?",
                        children: <Text size="sm">Počet: {selectedPaths.length}</Text>,
                        labels: { confirm: "Smazat", cancel: "Zrušit" },
                        confirmProps: { color: "red" },
                        onConfirm: () => void bulkDelete()
                      });
                    }}
                  >
                    Smazat
                  </Button>
                  <Button size="compact-sm" variant="default" onClick={() => setSelectedPaths([])}>
                    Zrušit výběr
                  </Button>
                </Group>
              </Group>
            </Paper>
          ) : null}

          <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
            {view === "grid" ? (
              <SimpleGrid cols={{ base: 2, xs: 2, sm: 3, md: 4, lg: 5 }} spacing="md">
                {folders.map((folder) => (
                  <Paper
                    key={folder.path}
                    withBorder
                    p="md"
                    radius="md"
                    onClick={() => setPrefix(folder.path)}
                    onDoubleClick={() => setPrefix(folder.path)}
                    style={{ cursor: "pointer" }}
                  >
                    <Stack gap="sm" align="center" ta="center">
                      <IconFolder size={44} stroke={1.2} color="var(--mantine-color-yellow-7)" />
                      <Text size="sm" fw={600} lineClamp={3} style={{ wordBreak: "break-word" }}>
                        {folder.name}
                      </Text>
                      <Badge size="xs" variant="light" color="gray">
                        Složka
                      </Badge>
                    </Stack>
                  </Paper>
                ))}

                {files.map((file) => {
                  const selected = selectedPaths.includes(file.path);
                  return (
                    <Paper
                      key={file.path}
                      withBorder
                      p="md"
                      radius="md"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button, [role='checkbox'], a")) return;
                        toggleSelected(file.path);
                      }}
                      style={{
                        cursor: "pointer",
                        outline: selected ? "2px solid var(--mantine-color-indigo-5)" : undefined
                      }}
                    >
                      <Stack gap="sm" align="center" ta="center">
                        <Group justify="space-between" w="100%" wrap="nowrap">
                          <Checkbox
                            checked={selected}
                            onChange={(e) => {
                              const nextChecked = e.currentTarget.checked;
                              setSelectedPaths((prev) =>
                                nextChecked ? [...prev, file.path] : prev.filter((p) => p !== file.path)
                              );
                            }}
                            aria-label={`Vybrat ${file.name}`}
                          />
                          <Group gap={4} wrap="nowrap">
                            <Tooltip label="Náhled">
                              <ActionIcon
                                variant="light"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void openFilePreview(file);
                                }}
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Stáhnout">
                              <ActionIcon
                                variant="light"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void downloadToDevice(file.path, "original");
                                }}
                              >
                                <IconDownload size={16} />
                              </ActionIcon>
                            </Tooltip>
                            {file.path.toLowerCase().endsWith(".pptx") ? (
                              <Tooltip label="Stáhnout PDF">
                                <ActionIcon
                                  variant="light"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void downloadToDevice(file.path, "pdf");
                                  }}
                                >
                                  <IconFileTypePdf size={16} />
                                </ActionIcon>
                              </Tooltip>
                            ) : null}
                            {file.path.toLowerCase().endsWith(".pdf") ? (
                              <Tooltip label="Stáhnout PPTX">
                                <ActionIcon
                                  variant="light"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void downloadToDevice(file.path, "pptx");
                                  }}
                                >
                                  <IconFileTypePpt size={16} />
                                </ActionIcon>
                              </Tooltip>
                            ) : null}
                            <Tooltip label="Smazat">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmRemove(file.path);
                                }}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Group>
                        <FileTypeIcon name={file.name} size={40} />
                        <Text size="sm" fw={600} lineClamp={2} style={{ wordBreak: "break-word" }}>
                          {file.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatBytes(file.size)}
                          {file.updated_at ? ` · ${new Date(file.updated_at).toLocaleString("cs-CZ")}` : ""}
                        </Text>
                      </Stack>
                    </Paper>
                  );
                })}
              </SimpleGrid>
            ) : (
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 44 }} />
                    <Table.Th>Název</Table.Th>
                    <Table.Th>Velikost</Table.Th>
                    <Table.Th>Upraveno</Table.Th>
                    <Table.Th>Akce</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {folders.map((folder) => (
                    <Table.Tr key={folder.path} onDoubleClick={() => setPrefix(folder.path)} style={{ cursor: "pointer" }}>
                      <Table.Td />
                      <Table.Td onClick={() => setPrefix(folder.path)}>
                        <Group gap="xs" wrap="nowrap">
                          <IconFolder size={18} color="var(--mantine-color-yellow-7)" />
                          <Text size="sm" fw={600}>
                            {folder.name}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>—</Table.Td>
                      <Table.Td>—</Table.Td>
                      <Table.Td>
                        <Button size="compact-xs" variant="light" onClick={() => setPrefix(folder.path)}>
                          Otevřít
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {files.map((file) => (
                    <Table.Tr key={file.path}>
                      <Table.Td>
                        <Checkbox
                          checked={selectedPaths.includes(file.path)}
                          onChange={(e) => {
                            const nextChecked = e.currentTarget.checked;
                            setSelectedPaths((prev) =>
                              nextChecked ? [...prev, file.path] : prev.filter((p) => p !== file.path)
                            );
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <FileTypeIcon name={file.name} size={20} />
                          <Text size="sm" style={{ wordBreak: "break-all" }}>
                            {file.name}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>{formatBytes(file.size)}</Table.Td>
                      <Table.Td>{file.updated_at ? new Date(file.updated_at).toLocaleString("cs-CZ") : "—"}</Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="wrap">
                          <Button size="compact-xs" variant="light" onClick={() => void openFilePreview(file)}>
                            Náhled
                          </Button>
                          <Button size="compact-xs" variant="light" onClick={() => void downloadToDevice(file.path, "original")}>
                            Stáhnout
                          </Button>
                          {file.path.endsWith(".pptx") ? (
                            <Button size="compact-xs" variant="light" onClick={() => void downloadToDevice(file.path, "pdf")}>
                              PDF
                            </Button>
                          ) : null}
                          {file.path.endsWith(".pdf") ? (
                            <Button size="compact-xs" variant="light" onClick={() => void downloadToDevice(file.path, "pptx")}>
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
            )}
          </ScrollArea>

          <Group>
            <Button disabled={page <= 1 || loading} onClick={() => void loadFiles(page - 1)} variant="default">
              Předchozí
            </Button>
            <Button disabled={page >= pages || loading} onClick={() => void loadFiles(page + 1)} variant="default">
              Další
            </Button>
          </Group>
        </Stack>
      </Group>
    </Stack>
    {previewDrawer}
    </>
  );
}
