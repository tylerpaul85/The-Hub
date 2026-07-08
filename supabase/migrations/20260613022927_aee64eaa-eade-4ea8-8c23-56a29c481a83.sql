
REVOKE EXECUTE ON FUNCTION public.send_scorecard_weekly_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_scorecard_weekly_reminders() TO service_role;
