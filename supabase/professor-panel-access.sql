-- Professores ativos podem operar o painel, sem ganhar permissões de
-- administração de contas (profiles, admin_audit e access_logs permanecem ADM).
CREATE SCHEMA IF NOT EXISTS app_private;
CREATE OR REPLACE FUNCTION app_private.can_operate_panel()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND status = 'ATIVO'
      AND role IN ('ADM', 'PROFESSOR')
  );
$function$;

REVOKE ALL ON FUNCTION app_private.can_operate_panel() FROM PUBLIC, anon, authenticated;

DO $block$
DECLARE
  target_table text;
  action text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'automation_rules', 'device_commands', 'devices', 'public_metrics',
    'rooms', 'sensor_readings', 'sensors', 'site_content',
    'site_settings', 'system_events'
  ] LOOP
    -- O projeto pode não usar todas as tabelas da lista.
    IF to_regclass('public.' || target_table) IS NULL THEN
      CONTINUE;
    END IF;
    FOR action IN SELECT unnest(ARRAY['select', 'insert', 'update', 'delete']) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', target_table || '_admin_' || action, target_table);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', target_table || '_operator_' || action, target_table);
      IF action = 'insert' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT app_private.can_operate_panel()))',
          target_table || '_operator_insert', target_table
        );
      ELSIF action = 'update' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT app_private.can_operate_panel())) WITH CHECK ((SELECT app_private.can_operate_panel()))',
          target_table || '_operator_update', target_table
        );
      ELSE
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR %s TO authenticated USING ((SELECT app_private.can_operate_panel()))',
          target_table || '_operator_' || action, target_table, upper(action)
        );
      END IF;
    END LOOP;
  END LOOP;
END $block$;
