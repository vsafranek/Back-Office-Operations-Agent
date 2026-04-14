import { Button, Card, Checkbox, Grid, Group, NumberInput, Select, Text, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";

const offerTypeOptions = [
  { label: "Vše", value: "" },
  { label: "Prodej", value: "sale" },
  { label: "Pronájem", value: "rent" },
  { label: "Aukce", value: "auction" }
];

const propertyTypeOptions = [
  { label: "Vše", value: "" },
  { label: "Byt", value: "apartment" },
  { label: "Dům", value: "house" },
  { label: "Pozemek", value: "land" },
  { label: "Komerční", value: "commercial" }
];

const sortOptions = [
  { label: "Nejnovější", value: "last_seen_desc" },
  { label: "Cena ^", value: "price_asc" },
  { label: "Cena ˇ", value: "price_desc" },
  { label: "Plocha ^", value: "area_asc" },
  { label: "Plocha ˇ", value: "area_desc" }
];

const transitMatchOptions = [
  { label: "Splní libovolný režim", value: "any" },
  { label: "Splní všechny režimy", value: "all" }
];

type ListingFiltersPanelProps = {
  q: string;
  setQ: (value: string) => void;
  offerType: string;
  setOfferType: (value: string) => void;
  propertyType: string;
  setPropertyType: (value: string) => void;
  disposition: string;
  setDisposition: (value: string) => void;
  sort: string;
  setSort: (value: string) => void;
  minPrice: number | undefined;
  setMinPrice: (value: number | undefined) => void;
  maxPrice: number | undefined;
  setMaxPrice: (value: number | undefined) => void;
  minFloorArea: number | undefined;
  setMinFloorArea: (value: number | undefined) => void;
  maxFloorArea: number | undefined;
  setMaxFloorArea: (value: number | undefined) => void;
  nearMetro: boolean;
  setNearMetro: (value: boolean) => void;
  maxMetroDistanceM: number | undefined;
  setMaxMetroDistanceM: (value: number | undefined) => void;
  maxMetroWalkMin: number | undefined;
  setMaxMetroWalkMin: (value: number | undefined) => void;
  minTransitScore: number | undefined;
  setMinTransitScore: (value: number | undefined) => void;
  metroLinesCsv: string;
  setMetroLinesCsv: (value: string) => void;
  metroStopIdsCsv: string;
  setMetroStopIdsCsv: (value: string) => void;
  transitModesCsv: string;
  setTransitModesCsv: (value: string) => void;
  transitMatchMode: "any" | "all";
  setTransitMatchMode: (value: "any" | "all") => void;
  currentPage: number;
  currentCount: number;
  onReset: () => void;
  onChangePageToFirst: () => void;
};

export function ListingFiltersPanel(props: ListingFiltersPanelProps) {
  return (
    <Card withBorder radius="md" p="md" bg="white">
      <Grid gutter="sm">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <TextInput
            label="Lokalita / text"
            placeholder="Praha, Brno, Vinohrady..."
            value={props.q}
            onChange={(event) => {
              props.onChangePageToFirst();
              props.setQ(event.currentTarget.value);
            }}
            leftSection={<IconSearch size={16} />}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 2 }}>
          <Select
            label="Nabídka"
            data={offerTypeOptions}
            value={props.offerType}
            onChange={(value) => {
              props.onChangePageToFirst();
              props.setOfferType(value ?? "");
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 2 }}>
          <Select
            label="Typ"
            data={propertyTypeOptions}
            value={props.propertyType}
            onChange={(value) => {
              props.onChangePageToFirst();
              props.setPropertyType(value ?? "");
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 2 }}>
          <TextInput
            label="Dispozice"
            placeholder="např. 2+kk"
            value={props.disposition}
            onChange={(event) => {
              props.onChangePageToFirst();
              props.setDisposition(event.currentTarget.value);
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 2 }}>
          <Select
            label="Řazení"
            data={sortOptions}
            value={props.sort}
            onChange={(value) => {
              props.onChangePageToFirst();
              props.setSort(value ?? "last_seen_desc");
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 2 }}>
          <NumberInput
            label="Cena od"
            thousandSeparator=" "
            allowNegative={false}
            value={props.minPrice}
            onChange={(value) => {
              props.onChangePageToFirst();
              props.setMinPrice(typeof value === "number" ? value : undefined);
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 2 }}>
          <NumberInput
            label="Cena do"
            thousandSeparator=" "
            allowNegative={false}
            value={props.maxPrice}
            onChange={(value) => {
              props.onChangePageToFirst();
              props.setMaxPrice(typeof value === "number" ? value : undefined);
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 2 }}>
          <NumberInput
            label="Plocha od (m2)"
            allowNegative={false}
            value={props.minFloorArea}
            onChange={(value) => {
              props.onChangePageToFirst();
              props.setMinFloorArea(typeof value === "number" ? value : undefined);
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 2 }}>
          <NumberInput
            label="Plocha do (m2)"
            allowNegative={false}
            value={props.maxFloorArea}
            onChange={(value) => {
              props.onChangePageToFirst();
              props.setMaxFloorArea(typeof value === "number" ? value : undefined);
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 2 }}>
          <Checkbox
            mt={34}
            label="Pouze u metra"
            checked={props.nearMetro}
            onChange={(event) => {
              props.onChangePageToFirst();
              props.setNearMetro(event.currentTarget.checked);
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 2 }}>
          <NumberInput
            label="Metro do (m)"
            allowNegative={false}
            value={props.maxMetroDistanceM}
            onChange={(value) => {
              props.onChangePageToFirst();
              props.setMaxMetroDistanceM(typeof value === "number" ? value : undefined);
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 2 }}>
          <NumberInput
            label="Metro do (min)"
            allowNegative={false}
            value={props.maxMetroWalkMin}
            onChange={(value) => {
              props.onChangePageToFirst();
              props.setMaxMetroWalkMin(typeof value === "number" ? value : undefined);
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 2 }}>
          <NumberInput
            label="Transit score od"
            allowNegative={false}
            min={0}
            max={100}
            value={props.minTransitScore}
            onChange={(value) => {
              props.onChangePageToFirst();
              props.setMinTransitScore(typeof value === "number" ? value : undefined);
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 4 }}>
          <TextInput
            label="Linky metra (CSV)"
            placeholder="A,B,C"
            value={props.metroLinesCsv}
            onChange={(event) => {
              props.onChangePageToFirst();
              props.setMetroLinesCsv(event.currentTarget.value);
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 4 }}>
          <TextInput
            label="Stanice metra (UUID CSV)"
            placeholder="id1,id2"
            value={props.metroStopIdsCsv}
            onChange={(event) => {
              props.onChangePageToFirst();
              props.setMetroStopIdsCsv(event.currentTarget.value);
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 3 }}>
          <TextInput
            label="Režimy dopravy (CSV)"
            placeholder="metro,tram,bus,train"
            value={props.transitModesCsv}
            onChange={(event) => {
              props.onChangePageToFirst();
              props.setTransitModesCsv(event.currentTarget.value);
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 3 }}>
          <Select
            label="Transit match"
            data={transitMatchOptions}
            value={props.transitMatchMode}
            onChange={(value) => {
              props.onChangePageToFirst();
              props.setTransitMatchMode((value as "any" | "all") ?? "any");
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <Group gap="sm" mt="xl">
            <Button variant="default" onClick={props.onReset}>
              Reset filtrů
            </Button>
            <Text size="sm" c="dimmed">
              Strana {props.currentPage} · {props.currentCount} výsledků
            </Text>
          </Group>
        </Grid.Col>
      </Grid>
    </Card>
  );
}
