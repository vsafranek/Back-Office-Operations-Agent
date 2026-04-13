-- Portal-only cleanup: remove legacy back-office schema objects not used by real estate portal.

-- Legacy analytics/reporting views/functions
DROP VIEW IF EXISTS public.vw_deal_sales_detail;
DROP VIEW IF EXISTS public.vw_lead_pipeline_summary;
DROP VIEW IF EXISTS public.vw_leads_vs_sales_6m;
DROP VIEW IF EXISTS public.vw_new_clients_q1;
DROP FUNCTION IF EXISTS public.fn_missing_reconstruction_data();
DROP FUNCTION IF EXISTS public.list_user_ids_for_email(text);

-- Legacy back-office tables (agent, CRM, workflows, email/calendar)
DROP TABLE IF EXISTS public.scheduled_task_run_notifications CASCADE;
DROP TABLE IF EXISTS public.user_scheduled_agent_tasks CASCADE;
DROP TABLE IF EXISTS public.agent_trace_events CASCADE;
DROP TABLE IF EXISTS public.conversation_messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.outbound_email_event_leads CASCADE;
DROP TABLE IF EXISTS public.outbound_email_events CASCADE;
DROP TABLE IF EXISTS public.user_integration_settings CASCADE;
DROP TABLE IF EXISTS public.user_data_browser_presets CASCADE;
DROP TABLE IF EXISTS public.user_ui_preferences CASCADE;
DROP TABLE IF EXISTS public.user_market_listing_finds CASCADE;

DROP TABLE IF EXISTS public.workflow_runs CASCADE;
DROP TABLE IF EXISTS public.agent_runs CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.calendar_slots CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.deals CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.properties CASCADE;
DROP TABLE IF EXISTS public.data_quality_issues CASCADE;
DROP TABLE IF EXISTS public.market_listings CASCADE;
