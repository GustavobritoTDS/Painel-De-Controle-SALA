-- Perfis criados na mesma transação da conta Auth.
-- app_metadata só pode ser definido por operações administrativas no servidor.
CREATE OR REPLACE FUNCTION app_private.create_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  account_role text := CASE
    WHEN new.raw_app_meta_data->>'role' IN ('ADM', 'PROFESSOR')
      THEN new.raw_app_meta_data->>'role'
    ELSE 'ALUNO'
  END;
BEGIN
  INSERT INTO public.profiles (id, full_name, role, status, serie)
  VALUES (
    new.id, coalesce(new.raw_user_meta_data->>'full_name', ''),
    account_role, 'ATIVO',
    CASE WHEN account_role = 'ALUNO'
      THEN nullif(btrim(new.raw_user_meta_data->>'serie'), '') ELSE NULL END
  ) ON CONFLICT (id) DO NOTHING;
  RETURN new;
END $function$;
