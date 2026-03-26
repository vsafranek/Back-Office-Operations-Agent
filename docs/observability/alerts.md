# Alerting Baseline

## Core alerts
- `agent_error_rate > 5%` over 15 minutes.
- `workflow_timeout_rate > 3%` over 30 minutes.
- `azure_proxy_retry_rate > 10%` over 10 minutes.
- `daily_market_monitor_missing_run` if no run in last 26 hours.

## Suggested destinations
- Primary: Slack operations channel.
- Secondary: email to on-call mailbox.

## Run identifiers
Include `run_id` or `run_ref` in every alert to speed up incident triage.
