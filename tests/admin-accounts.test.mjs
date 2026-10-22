import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const source = readFileSync(new URL('../supabase/functions/senai-admin/index.ts', import.meta.url), 'utf8');
function setup({ role = 'ADM', status = 'ATIVO', validToken = true, createError = null, targetRole = 'ALUNO', adminCount = 2, updateError = null } = {}) {
  const created = [], audits = [], updated = [], profiles = [];
  let handler;
  const db = {
    auth: {
      getUser: async () => validToken ? { data: { user: { id: 'actor' } } } : { data: {}, error: {} },
      admin: {
        getUserById: async () => ({ data: { user: { user_metadata: { custom: 'kept' }, app_metadata: { provider: 'email' } } } }),
        updateUserById: async (id, attrs) => { updated.push({ id, attrs }); return { error: updateError }; },
        listUsers: async () => ({ data: { users: [{ id: 'listed-user', email: 'maria@example.com' }] } }),
        createUser: async (attrs) => {
        created.push(attrs);
        return createError ? { data: {}, error: createError } : { data: { user: { id: 'new-user' } } };
      } }
    },
    from(table) {
      if (table === 'admin_audit') return { insert: async (row) => { audits.push(row); return {}; } };
      return {
        upsert: async (row) => { profiles.push(row); return {}; },
        selected: null,
        select() { return this; }, eq(_key, value) { this.selected = value; return this; },
        single() { return Promise.resolve({ data: { role: this.selected === 'actor' ? role : targetRole, status } }); },
        order() { return this; }, limit: async () => ({ data: [{ id: 'listed-user', full_name: 'Maria', role: 'ALUNO', serie: '2º ano' }] }),
        then(resolve) { resolve({ count: adminCount }); }
      };
    }
  };
  vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\r?\n/, '')), {
    Deno: { env: { get: () => 'server-only' }, serve: (fn) => { handler = fn; } },
    createClient: () => db, Response, console: { error() {} }
  });
  const send = (body, authorization = 'Bearer valid-token') => handler({
    method: 'POST', headers: new Headers(authorization ? { authorization } : {}), json: async () => body
  });
  return { send, created, audits, updated, profiles };
}
const account = { action: 'create', full_name: '  Maria Silva  ', email: '  MARIA@example.com ', password: 'senha-teste-123', role: 'ALUNO', serie: ' 2º ano ' };

test('aluno recebe nome, e-mail normalizado, série e metadados confiáveis', async () => {
  const { send, created, audits, profiles } = setup();
  const response = await send(account);
  assert.equal(response.status, 201);
  assert.deepEqual(JSON.parse(JSON.stringify(created[0])), {
    email: 'maria@example.com', password: account.password, email_confirm: true,
    user_metadata: { full_name: 'Maria Silva', display_name: 'Maria Silva', serie: '2º ano' }, app_metadata: { role: 'ALUNO' }
  });
  assert.equal(audits.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(profiles[0])), { id: 'new-user', full_name: 'Maria Silva', role: 'ALUNO', status: 'ATIVO', serie: '2º ano' });
  assert.ok(!JSON.stringify(audits).includes(account.password));
  assert.ok(!(await response.text()).includes(account.password));
});
for (const role of ['ADM', 'PROFESSOR']) {
  test(`${role} cria conta sem série e ignora série enviada`, async () => {
    const { send, created } = setup();
    assert.equal((await send({ ...account, role })).status, 201);
    assert.equal(created[0].user_metadata.serie, null);
    assert.equal(created[0].app_metadata.role, role);
  });
}
for (const attrs of [{ role: 'ALUNO' }, { role: 'PROFESSOR' }, { status: 'BLOQUEADO' }, { validToken: false }]) {
  test(`impede criação sem ADM ativo: ${JSON.stringify(attrs)}`, async () => {
    const { send, created } = setup(attrs);
    const response = await send(account);
    assert.ok([401, 403].includes(response.status));
    assert.equal(created.length, 0);
  });
}
test('requisição sem sessão é recusada', async () => {
  const { send, created } = setup();
  assert.equal((await send(account, '')).status, 401);
  assert.equal(created.length, 0);
});
for (const override of [{ serie: null }, { serie: ' ' }, { role: 'ROOT' }, { full_name: ' ' }, { email: 'sem-email' }, { password: 'curta' }]) {
  test(`valida formulário no servidor: ${JSON.stringify(override)}`, async () => {
    const { send, created } = setup();
    assert.equal((await send({ ...account, ...override })).status, 400);
    assert.equal(created.length, 0);
  });
}
test('e-mail duplicado retorna erro e não registra sucesso', async () => {
  const { send, audits } = setup({ createError: { code: 'email_exists' } });
  const response = await send(account);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Já existe/);
  assert.equal(audits.length, 0);
});

const edit = { ...account, action: 'update', user_id: '11111111-1111-4111-8111-111111111111' };
test('edição altera email, nome, perfil e série sem perder outros metadados', async () => {
  const { send, updated, audits } = setup();
  assert.equal((await send(edit)).status, 200);
  const changes = updated[0].attrs;
  assert.equal(changes.email, 'maria@example.com');
  assert.equal(changes.user_metadata.full_name, 'Maria Silva');
  assert.equal(changes.user_metadata.custom, 'kept');
  assert.equal(changes.user_metadata.serie, '2º ano');
  assert.equal(changes.app_metadata.role, 'ALUNO');
  assert.equal(changes.app_metadata.provider, 'email');
  assert.equal(changes.password, account.password);
  assert.ok(!JSON.stringify(audits).includes(account.password));
});
test('senha vazia na edição mantém a senha existente', async () => {
  const { send, updated } = setup();
  assert.equal((await send({ ...edit, password: '' })).status, 200);
  assert.ok(!('password' in updated[0].attrs));
});
for (const role of ['ADM', 'PROFESSOR']) {
  test(`edição para ${role} remove a série`, async () => {
    const { send, updated } = setup();
    assert.equal((await send({ ...edit, role })).status, 200);
    assert.equal(updated[0].attrs.user_metadata.serie, null);
  });
}
test('não rebaixa o último administrador ativo', async () => {
  const { send, updated } = setup({ targetRole: 'ADM', adminCount: 1 });
  const response = await send(edit);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /último ADM/);
  assert.equal(updated.length, 0);
});
for (const override of [{ serie: '' }, { email: 'invalido' }, { password: '123' }, { full_name: '' }, { role: 'ROOT' }]) {
  test(`recusa edição inválida: ${JSON.stringify(override)}`, async () => {
    const { send, updated } = setup();
    assert.equal((await send({ ...edit, ...override })).status, 400);
    assert.equal(updated.length, 0);
  });
}
for (const role of ['ALUNO', 'PROFESSOR']) {
  test(`${role} não pode editar usuários`, async () => {
    const { send, updated } = setup({ role });
    assert.equal((await send(edit)).status, 403);
    assert.equal(updated.length, 0);
  });
}
test('listagem inclui e-mail sem retornar metadados de autenticação', async () => {
  const { send } = setup();
  const response = await send({ action: 'list' });
  assert.equal(response.status, 200);
  const { users } = await response.json();
  assert.equal(users[0].email, 'maria@example.com');
  assert.ok(!('app_metadata' in users[0]));
});
test('falha ao atualizar Auth não anuncia sucesso nem executa gravação separada no perfil', async () => {
  const { send, audits } = setup({ updateError: { code: 'email_exists' } });
  const response = await send(edit);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Já existe/);
  assert.equal(audits.length, 0);
});

test('alteração legada de perfil também sincroniza app_metadata', async () => {
  const { send, updated } = setup({ targetRole: 'ADM' });
  assert.equal((await send({ action: 'set_role', user_id: edit.user_id, role: 'ALUNO', serie: '2º ano' })).status, 200);
  assert.equal(updated[0].attrs.app_metadata.role, 'ALUNO');
  assert.equal(updated[0].attrs.user_metadata.serie, '2º ano');
});
