-- Parser provenance fields for deterministic + optional LLM enrichment traceability.

ALTER TABLE public.listing_parse_results
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS enrichment_source text NULL;

CREATE INDEX IF NOT EXISTS listing_parse_results_enrichment_idx
  ON public.listing_parse_results (enrichment_source, parsed_at DESC)
  WHERE enrichment_source IS NOT NULL;
