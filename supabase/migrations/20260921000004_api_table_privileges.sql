-- PostgreSQL table privileges are required in addition to row-level policies.
-- RLS remains enabled and controls which records each user can access.
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
