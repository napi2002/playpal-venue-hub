-- Legacy migration superseded by 20260122130000_replace_schema.sql.
-- Kept as a no-op to avoid conflicts with the current schema.
do $$
begin
  raise notice 'Skipping legacy migration 20260120123000 (schema already replaced).';
end
$$;
