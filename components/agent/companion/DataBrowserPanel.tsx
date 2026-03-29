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
import { DATASET_IDS, type DataPullDataset } from "@/lib/agent/tools/data-pull-plan";
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
  created_at: string;
};

function TableBlock({
  dataset,
  displayColumns,
  rows
}: {
  dataset: DataPullDataset;
  displayColumns: string[];
  rows: Record<string, unknown>[];
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
            <Table.Th key={k} style={{ whiteSpace: "nowrap", minWidth: 90 }}>
              {columnHeaderLabel(dataset, k)}
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
  const canSaveView = Boolean(source) && (!needsTextFilterToSave || globalSearch.trim().length > 0);
  const saveBlockReason = !source
    ? "Nejdřív načtěte data v kroku Tabulka."
    : needsTextFilterToSave && !globalSearch.trim()
      ? "Pro uložení doplňte rychlé vyhledávání (u této tabulky je filtr povinný)."
      : "";

  const displayColumns = useMemo(
    () => getDisplayColumns(dataset, rows[0]),
    [dataset, rows]
  );

  const perPage = Math.max(1, Number.parseInt(rowsPerPage, 10) || 10);
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages, rows.length, perPage]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * perPage;
    return rows.slice(start, start + perPage);
  }, [rows, page, perPage]);

  const rangeStart = rows.length === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, rows.length);

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
    };
    setLoading(false);
    if (!res.ok) {
      setErr(data.error ?? "Dotaz selhal.");
      return;
    }
    setRows(data.rows ?? []);
    setSource(data.source ?? "");
    setPage(1);
    setStep(1);
  }

  function resetToSelect() {
    setStep(0);
    setRows([]);
    setSource("");
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
    const res = await fetch("/api/data/browser-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name,
        base_dataset: dataset,
        row_text_narrowing: globalSearch.trim() || null
      })
    });
    const data = (await res.json()) as {
      preset?: { id: string; row_text_narrowing: string | null };
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
        Zvolte zdroj a načtěte náhled. V kroku Data můžete upravit rychlé vyhledávání a znovu načíst; uložení pohledu je
        až potud (u tabulek Klienti / Q1 / Prodeje — detail musí být vyplněn alespoň filtr v textovém poli). Šipky pod
        tabulkou posouvají šířku; „Zvětšit“ otevře celý výpis.
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
            Uloží se zdroj „{preset.title}“ a aktuální text rychlého vyhledávání (stejné jako v kroku Data po případné
            úpravě filtrů).
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
        <ScrollArea h="calc(100dvh - 100px)" type="scroll" scrollbars="xy" offsetScrollbars>
          <TableBlock dataset={dataset} displayColumns={displayColumns} rows={rows} />
        </ScrollArea>
        <Text size="xs" c="dimmed" mt="md">
          Celkem {rows.length} načtených řádků · {source}
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
                  if (p) setGlobalSearch(p.row_text_narrowing ?? "");
                }
                setErr(null);
              }}
              size="xs"
              searchable
            />
            <TextInput
              label="Rychlé vyhledání při prvním načtení (volitelné)"
              description="Po zobrazení tabulky ho můžete v kroku Data upravit a znovu načíst. U pipeline view zadejte část názvu stavu leadu."
              placeholder="Klienti: jméno, město… · Pipeline: stav…"
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
                  disabled={rows.length === 0}
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
                  label="Rychlé vyhledávání (filtry)"
                  description="Upravte dotaz a znovu načtěte stejný zdroj."
                  placeholder="Stejné jako v prvním kroku — text podle typu tabulky."
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
              type="scroll"
              scrollbars="x"
              offsetScrollbars
              style={{ maxWidth: "100%" }}
              maw={720}
              scrollbarSize={8}
            >
              <TableBlock dataset={dataset} displayColumns={displayColumns} rows={pagedRows} />
            </ScrollArea>

            {rows.length > 0 ? (
              <Stack gap="xs">
                <Group justify="space-between" align="center" wrap="wrap" gap="md">
                  <Text size="xs" c="dimmed">
                    Řádky {rangeStart}–{rangeEnd} z {rows.length}
                    {rows.length >= BROWSER_FETCH_LIMIT ? " (dosáhnut limit náhledu)" : ""}
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
