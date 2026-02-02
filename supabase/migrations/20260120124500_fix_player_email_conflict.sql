-- Legacy migration already covered by 20260122130000_replace_schema.sql.
do $$
begin
  raise notice 'Skipping legacy migration 20260120124500 (schema already replaced).';
end $$;
