"use client";

import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Pagination,
  ScrollArea,
  Select,
  Stack,
  Stepper,
  Table,
  Text,
  TextInput,
  Tooltip
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconDeviceFloppy, IconMaximize, IconTrash } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DATASET_IDS,
  type DataPullDataset,
  normalizeAsciiForSearch
} from "@/lib/agent/tools/data-pull-plan";
import {
  browserPresetSourceCaption,
  columnHeaderLabel,
  DATA_BROWSER_PRESETS,
  formatBrowserCell,
  getDisplayColumns,
  listBrowserTableSelectData
} from "@/lib/data/data-browser-presets";

/** Stejné maximum jako `POST /api/data/preset-query` — větší sady by vyžadovaly stránkování na serveru. */
const BROWSER_FETCH_LIMIT = 200;

const ROWS_PER_PAGE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" }
];

type Props = { getAccessToken: () => Promise<string | null> };

type SavedPresetRow = {
  id: string;
  name: string;
  base_dataset: DataPullDataset;
  row_text_narrowing: string | null;
  column_filters?: unknown;
  created_at: string;
};

function normalizeColumnFiltersFromDb(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== "string" || !k.trim()) continue;
    const s = typeof v === "string" ? v : v != null ? String(v) : "";
    const t = s.trim();
    if (!t) continue;
    out[k] = t.length > 160 ? t.slice(0, 160) : t;
  }
  return out;
}

function rowMatchesColumnFilters(
  row: Record<string, unknown>,
  filters: Record<string, string>
): boolean {
  for (const [key, raw] of Object.entries(filters)) {
    const q = raw.trim();
    if (!q) continue;
    const cellText = String(formatBrowserCell(row[key]) ?? "");
    const hay = normalizeAsciiForSearch(cellText);
    const needle = normalizeAsciiForSearch(q);
    if (!hay.includes(needle)) return false;
  }
  return true;
}

function TableBlock({
  dataset,
  displayColumns,
  rows,
  columnFilters,
  onColumnFilterChange,
  filterEnabled
}: {
  dataset: DataPullDataset;
  displayColumns: string[];
  rows: Record<string, unknown>[];
  columnFilters?: Record<string, string>;
  onColumnFilterChange?: (columnKey: string, value: string) => void;
  filterEnabled?: boolean;
}) {
  if (displayColumns.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Žádné sloupce k zobrazení.
      </Text>
    );
  }

  return (
    <Table striped highlightOnHover withTableBorder withColumnBorders verticalSpacing={4} horizontalSpacing={6} fz="xs">
      <Table.Thead>
        <Table.Tr>
          {displayColumns.map((k) => (
            <Table.Th key={k} style={{ verticalAlign: "top", minWidth: filterEnabled ? 130 : 90 }}>
              <Stack gap={6}>
                <Text size="xs" fw={700} style={{ whiteSpace: "nowrap" }}>
                  {columnHeaderLabel(dataset, k)}
                </Text>
                {filterEnabled && onColumnFilterChange ? (
                  <TextInput
                    size="xs"
                    placeholder="Obsahuje…"
                    aria-label={`Filtr sloupce ${columnHeaderLabel(dataset, k)}`}
                    value={columnFilters?.[k] ?? ""}
                    onChange={(e) => onColumnFilterChange(k, e.currentTarget.value)}
                    maxLength={160}
                  />
                ) : null}
              </Stack>
            </Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={Math.max(displayColumns.length, 1)}>
              <Text size="xs" c="dimmed" py="md">
                Žádné řádky.
              </Text>
            </Table.Td>
          </Table.Tr>
        ) : (
          rows.map((row, ri) => (
            <Table.Tr key={ri}>
              {displayColumns.map((k) => (
                <Table.Td key={k} maw={260} style={{ wordBreak: "break-word" }}>
                  <Text size="xs" lineClamp={5}>
                    {formatBrowserCell(row[k]) || "—"}
                  </Text>
                </Table.Td>
              ))}
            </Table.Tr>
          ))
        )}
      </Table.Tbody>
    </Table>
  );
}

export function DataPresetPanel({ getAccessToken }: Props) {
  const [step, setStep] = useState(0);
  const [selectValue, setSelectValue] = useState<string>(DATASET_IDS[0]!);
  const [savedPresets, setSavedPresets] = useState<SavedPresetRow[]>([]);
  const [rowsPerPage, setRowsPerPage] = useState("10");
  const [page, setPage] = useState(1);
  const [globalSearch, setGlobalSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [saveModalOpened, { open: openSaveModal, close: closeSaveModal }] = useDisclosure(false);

  const refreshSavedPresets = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch("/api/data/browser-presets", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = (await res.json()) as { presets?: SavedPresetRow[] };
    if (!res.ok) return;
    setSavedPresets(data.presets ?? []);
  }, [getAccessToken]);

  useEffect(() => {
    void refreshSavedPresets();
  }, [refreshSavedPresets]);

  useEffect(() => {
    if (!selectValue.startsWith("saved:")) return;
    const id = selectValue.slice(6);
    if (savedPresets.some((s) => s.id === id)) return;
    setSelectValue(DATASET_IDS[0]!);
  }, [savedPresets, selectValue]);

  const resolved = useMemo(() => {
    if (selectValue.startsWith("saved:")) {
      const id = selectValue.slice(6);
      const p = savedPresets.find((s) => s.id === id);
      const dataset = (p?.base_dataset ?? DATASET_IDS[0]) as DataPullDataset;
      return {
        dataset,
        savedId: p ? id : null as string | null,
        selectDescription: p
          ? `${DATA_BROWSER_PRESETS[dataset].title} — uložený pohled „${p.name}“. ${browserPresetSourceCaption(dataset)}.`
          : `${DATA_BROWSER_PRESETS[dataset].description} · ${browserPresetSourceCaption(dataset)}`
      };
    }
    const dataset = selectValue as DataPullDataset;
    return {
      dataset,
      savedId: null as string | null,
      selectDescription: `${DATA_BROWSER_PRESETS[dataset].description} · ${browserPresetSourceCaption(dataset)}`
    };
  }, [selectValue, savedPresets]);

  const dataset = resolved.dataset;

  const isBuiltinSelection = !selectValue.startsWith("saved:");
  const needsTextFilterToSave =
    isBuiltinSelection &&
    ["clients", "new_clients_q1", "deal_sales_detail", "properties", "deals", "leads"].includes(dataset);
  const hasColumnFilter = Object.values(columnFilters).some((v) => v.trim().length > 0);
  const canSaveView =
    Boolean(source) &&
    (!needsTextFilterToSave || globalSearch.trim().length > 0 || hasColumnFilter);
  const saveBlockReason = !source
    ? "Nejdřív načtěte data v kroku Tabulka."
    : needsTextFilterToSave && !globalSearch.trim() && !hasColumnFilter
      ? "Pro uložení doplňte buď text v prvním kroku, nebo alespoň jeden filtr ve sloupci tabulky."
      : "";

  const displayColumns = useMemo(
    () => getDisplayColumns(dataset, rows[0]),
    [dataset, rows]
  );

  useEffect(() => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const k of Object.keys(next)) {
        if (!displayColumns.includes(k)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [displayColumns]);

  const filteredRows = useMemo(
    () => rows.filter((row) => rowMatchesColumnFilters(row, columnFilters)),
    [rows, columnFilters]
  );

  const perPage = Math.max(1, Number.parseInt(rowsPerPage, 10) || 10);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPage));

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages, filteredRows.length, perPage]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredRows.slice(start, start + perPage);
  }, [filteredRows, page, perPage]);

  const rangeStart = filteredRows.length === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, filteredRows.length);

  const setColumnFilter = useCallback((key: string, value: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (!value.trim()) delete next[key];
      else next[key] = value;
      return next;
    });
    setPage(1);
  }, []);

  async function loadData() {
    setLoading(true);
    setErr(null);
    const token = await getAccessToken();
    if (!token) {
      setErr("Nejste přihlášeni.");
      setLoading(false);
      return;
    }
    const savedIdForQuery = selectValue.startsWith("saved:") ? selectValue.slice(6) : null;
    const body = savedIdForQuery
      ? { saved_preset_id: savedIdForQuery, limit: BROWSER_FETCH_LIMIT }
      : {
          dataset: selectValue as DataPullDataset,
          row_text_narrowing: globalSearch.trim() || null,
          limit: BROWSER_FETCH_LIMIT
        };

    const res = await fetch("/api/data/preset-query", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const data = (await res.json()) as {
      rows?: Record<string, unknown>[];
      source?: string;
      error?: string;
      column_filters?: Record<string, string> | null;
    };
    setLoading(false);
    if (!res.ok) {
      setErr(data.error ?? "Dotaz selhal.");
      return;
    }
    setRows(data.rows ?? []);
    setSource(data.source ?? "");
    if (savedIdForQuery) {
      setColumnFilters(
        data.column_filters && typeof data.column_filters === "object"
          ? normalizeColumnFiltersFromDb(data.column_filters)
          : {}
      );
    } else {
      setColumnFilters({});
    }
    setPage(1);
    setStep(1);
  }

  function resetToSelect() {
    setStep(0);
    setRows([]);
    setSource("");
    setColumnFilters({});
    setPage(1);
    setErr(null);
    closeModal();
  }

  async function saveCurrentAsPreset() {
    const name = saveName.trim();
    if (!name) return;
    setSaveLoading(true);
    setErr(null);
    const token = await getAccessToken();
    if (!token) {
      setErr("Nejste přihlášeni.");
      setSaveLoading(false);
      return;
    }
    const cfPayload = Object.fromEntries(
      Object.entries(columnFilters).filter(([, v]) => v.trim().length > 0)
    );
    const res = await fetch("/api/data/browser-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name,
        base_dataset: dataset,
        row_text_narrowing: globalSearch.trim() || null,
        column_filters: Object.keys(cfPayload).length > 0 ? cfPayload : null
      })
    });
    const data = (await res.json()) as {
      preset?: { id: string; row_text_narrowing: string | null; column_filters?: unknown };
      error?: string;
    };
    setSaveLoading(false);
    if (!res.ok) {
      setErr(data.error ?? "Uložení selhalo.");
      return;
    }
    if (data.preset?.id) {
      await refreshSavedPresets();
      setSelectValue(`saved:${data.preset.id}`);
      setGlobalSearch(data.preset.row_text_narrowing ?? "");
      setColumnFilters(normalizeColumnFiltersFromDb(data.preset.column_filters));
    }
    setSaveName("");
    closeSaveModal();
  }

  async function deleteSavedPreset() {
    if (!resolved.savedId) return;
    const token = await getAccessToken();
    if (!token) {
      setErr("Nejste přihlášeni.");
      return;
    }
    const res = await fetch(`/api/data/browser-presets/${resolved.savedId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Smazání selhalo.");
      return;
    }
    await refreshSavedPresets();
    setSelectValue(dataset);
    closeModal();
  }

  const preset = DATA_BROWSER_PRESETS[dataset];

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Zvolte zdroj a klikněte <Text span fw={600}>Načíst data</Text>. Volitelný text v prvním kroku zúží dotaz na serveru;
        po načtení můžete v kroku <Text span fw={600}>Data</Text> filtrovat každý sloupec zvlášť (obsahuje text). Filtry
        ve sloupcích se ukládají s pohledem. U tabulek Klienti / Q1 / Prodeje je pro uložení potřeba vyplnit buď text v
        prvním kroku, nebo alespoň jeden sloupcový filtr. Posuvník pod tabulkou zůstává viditelný pro horizontální posun.
        „Zvětšit“ otevře celý výpis.
      </Text>

      <Modal opened={saveModalOpened} onClose={closeSaveModal} title="Uložit pohled" size="sm">
        <Stack gap="sm">
          <TextInput
            label="Název"
            placeholder="např. Klienti — Praha východ"
            value={saveName}
            onChange={(e) => setSaveName(e.currentTarget.value)}
            size="xs"
            maxLength={120}
          />
          <Text size="xs" c="dimmed">
            Uloží se zdroj „{preset.title}“, text z prvního kroku a aktuální filtry ve sloupcích tabulky.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" size="xs" onClick={closeSaveModal}>
              Zrušit
            </Button>
            <Button size="xs" leftSection={<IconDeviceFloppy size={16} />} loading={saveLoading} onClick={() => void saveCurrentAsPreset()}>
              Uložit
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={preset.title}
        fullScreen
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <ScrollArea h="calc(100dvh - 100px)" type="always" scrollbars="xy" offsetScrollbars scrollbarSize={10}>
          <TableBlock
            dataset={dataset}
            displayColumns={displayColumns}
            rows={filteredRows}
            columnFilters={columnFilters}
            onColumnFilterChange={setColumnFilter}
            filterEnabled
          />
        </ScrollArea>
        <Text size="xs" c="dimmed" mt="md">
          Celkem {filteredRows.length} řádků po sloupcových filtrech ({rows.length} načtených) · {source}
        </Text>
      </Modal>

      <Stepper active={step} onStepClick={setStep} allowNextStepsSelect={false} size="sm">
        <Stepper.Step label="Tabulka" description="Výběr zdroje">
          <Stack gap="sm" pt="md">
            <Select
              label="Datový zdroj"
              description={resolved.selectDescription}
              data={listBrowserTableSelectData(savedPresets)}
              value={selectValue}
              onChange={(v) => {
                if (!v) return;
                setSelectValue(v);
                if (v.startsWith("saved:")) {
                  const id = v.slice(6);
                  const p = savedPresets.find((s) => s.id === id);
                  if (p) {
                    setGlobalSearch(p.row_text_narrowing ?? "");
                    setColumnFilters(normalizeColumnFiltersFromDb(p.column_filters));
                  }
                } else {
                  setColumnFilters({});
                }
                setErr(null);
              }}
              size="xs"
              searchable
            />
            <TextInput
              label="Textový filtr před načtením"
              description="Nepovinné. Prázdné pole je v pořádku — načte se celý náhled. Pokud něco vyplníte, hledá se libovolný kus tohoto textu v řádcích (u klientů např. jméno nebo město; u pipeline stačí část názvu stavu). Stejný filtr upravíte znovu v kroku Data."
              placeholder="Nechte prázdné, nebo např. Brno · Novák · rezervace…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.currentTarget.value)}
              size="xs"
            />
            <Button size="xs" onClick={() => void loadData()} loading={loading}>
              Načíst data
            </Button>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Data" description="Stránky a náhled">
          <Stack gap="sm" pt="md">
            <Group justify="space-between" wrap="wrap" gap="xs">
              <Text size="xs" c="dimmed" maw={400}>
                Zdroj: {source || "—"}
              </Text>
              <Group gap="xs">
                <Tooltip label={saveBlockReason} disabled={!saveBlockReason}>
                  <span style={{ display: "inline-block" }}>
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<IconDeviceFloppy size={16} />}
                      disabled={!canSaveView}
                      onClick={openSaveModal}
                    >
                      Uložit pohled…
                    </Button>
                  </span>
                </Tooltip>
                {resolved.savedId ? (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="lg"
                    aria-label="Smazat uložený pohled"
                    onClick={() => void deleteSavedPreset()}
                  >
                    <IconTrash size={18} stroke={1.5} />
                  </ActionIcon>
                ) : null}
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconMaximize size={16} stroke={1.5} />}
                  onClick={openModal}
                  disabled={filteredRows.length === 0}
                >
                  Zvětšit
                </Button>
                <Button variant="default" size="xs" onClick={resetToSelect}>
                  Změnit tabulku
                </Button>
              </Group>
            </Group>

            {isBuiltinSelection ? (
              <Stack gap="xs">
                <TextInput
                  label="Textový filtr (server)"
                  description="Znovu dotáhne data z API. Sloupcové filtry pod tabulkou zůstanou a po načtení je můžete upravit — pro čistý začátek je vymažte ručně."
                  placeholder="Nechte prázdné, nebo upravte dotaz…"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.currentTarget.value)}
                  size="xs"
                />
                <Button variant="light" size="xs" onClick={() => void loadData()} loading={loading}>
                  Aplikovat filtry a znovu načíst
                </Button>
              </Stack>
            ) : (
              <Text size="xs" c="dimmed">
                Uložený pohled používá filtry z databáze. Pro změnu textu zvolte „Změnit tabulku“ a standardní tabulku,
                nebo preset smažte a vytvořte nový.
              </Text>
            )}

            {err ? (
              <Text size="sm" c="red">
                {err}
              </Text>
            ) : null}

            <ScrollArea
              type="always"
              scrollbars="x"
              offsetScrollbars
              style={{ maxWidth: "100%" }}
              maw={720}
              scrollbarSize={10}
            >
              <TableBlock
                dataset={dataset}
                displayColumns={displayColumns}
                rows={pagedRows}
                columnFilters={columnFilters}
                onColumnFilterChange={setColumnFilter}
                filterEnabled
              />
            </ScrollArea>

            {filteredRows.length > 0 ? (
              <Stack gap="xs">
                <Group justify="space-between" align="center" wrap="wrap" gap="md">
                  <Text size="xs" c="dimmed">
                    Řádky {rangeStart}–{rangeEnd} z {filteredRows.length}
                    {rows.length >= BROWSER_FETCH_LIMIT ? " (dosáhnut limit náhledu načtených řádků)" : ""}
                  </Text>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="xs" c="dimmed">
                      Řádků na stránku
                    </Text>
                    <Select
                      size="xs"
                      w={90}
                      data={ROWS_PER_PAGE_OPTIONS}
                      value={rowsPerPage}
                      onChange={(v) => {
                        setRowsPerPage(v ?? "10");
                        setPage(1);
                      }}
                    />
                  </Group>
                </Group>
                <Pagination total={totalPages} value={page} onChange={setPage} size="sm" siblings={1} boundaries={1} />
              </Stack>
            ) : null}
          </Stack>
        </Stepper.Step>
      </Stepper>
    </Stack>
  );
}
