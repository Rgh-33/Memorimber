-- Extend the per-device history without rewriting already applied migrations.
alter table public.push_notification_deliveries
  drop constraint push_notification_deliveries_notification_type_check,
  add constraint push_notification_deliveries_notification_type_check
    check (notification_type in ('harvest', 'anniversary', 'daily'));
