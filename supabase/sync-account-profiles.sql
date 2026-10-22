-- Execute após account-profiles.sql. A edição administrativa atualiza
-- Auth e o perfil pelo mesmo fluxo do servidor.
CREATE SCHEMA IF NOT EXISTS app_private;
CREATE OR REPLACE FUNCTION app_private.sync_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE account_role text;
BEGIN
  SELECT role INTO account_role FROM public.profiles WHERE id = new.id;
  IF NOT FOUND THEN RETURN new; END IF;
  -- Nunca usa user_metadata para decidir permissões. Preserva o perfil legado
  -- quando ainda não há role em app_metadata.
  IF new.raw_app_meta_data->>'role' IN ('ADM','ALUNO','PROFESSOR') THEN
    account_role := new.raw_app_meta_data->>'role';
  END IF;
  UPDATE public.profiles SET
    full_name = coalesce(new.raw_user_meta_data->>'full_name', full_name),
    role = account_role,
    serie = CASE WHEN account_role = 'ALUNO' THEN
      CASE WHEN new.raw_user_meta_data ? 'serie'
        THEN nullif(btrim(new.raw_user_meta_data->>'serie'), '') ELSE serie END
      ELSE NULL END,
    updated_at = now()
  WHERE id = new.id;
  RETURN new;
END $function$;
REVOKE ALL ON FUNCTION app_private.sync_user_profile() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER on_auth_user_profile_updated
AFTER UPDATE OF raw_user_meta_data, raw_app_meta_data ON auth.users
FOR EACH ROW
WHEN (old.raw_user_meta_data IS DISTINCT FROM new.raw_user_meta_data
   OR old.raw_app_meta_data IS DISTINCT FROM new.raw_app_meta_data)
EXECUTE FUNCTION app_private.sync_user_profile();
