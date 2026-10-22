-- Execute este arquivo no SQL Editor do Supabase.
-- Ele instala o gatilho de criação e recupera as contas que já existem em
-- Authentication, mas ainda não existem em public.profiles.
CREATE SCHEMA IF NOT EXISTS app_private;

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

REVOKE ALL ON FUNCTION app_private.create_user_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_profile_created ON auth.users;
CREATE TRIGGER on_auth_user_profile_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION app_private.create_user_profile();

-- Corrige o desencontro histórico: contas em auth.users sem perfil não
-- apareceriam no site, pois o login exige o respectivo registro em profiles.
INSERT INTO public.profiles (id, full_name, role, status, serie)
SELECT
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'display_name', ''),
  CASE WHEN u.raw_app_meta_data->>'role' IN ('ADM', 'PROFESSOR')
    THEN u.raw_app_meta_data->>'role' ELSE 'ALUNO' END,
  'ATIVO',
  CASE WHEN coalesce(u.raw_app_meta_data->>'role', 'ALUNO') = 'ALUNO'
    THEN nullif(btrim(u.raw_user_meta_data->>'serie'), '') ELSE NULL END
FROM auth.users AS u
ON CONFLICT (id) DO NOTHING;

-- O navegador só precisa ler o próprio perfil. Esta política é necessária
-- quando RLS estiver habilitada em public.profiles.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.profiles TO authenticated;
DROP POLICY IF EXISTS "profiles_read_own" ON public.profiles;
CREATE POLICY "profiles_read_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());
