import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const source = readFileSync(new URL('../supabase/functions/senai-admin/index.ts', import.meta.url), 'utf8');
function setup({ role = 'ADM', status = 'ATIVO', validToken = true, createError = null } = {}) {
  const created = [], audits = [];
  let handler;
  const db = {
    auth: {
      getUser: async () => validToken ? { data: { user: { id: 'actor' } } } : { data: {}, error: {} },
      admin: { createUser: async (attrs) => {
        created.push(attrs);
        return createError ? { data: {}, error: createError } : { data: { user: { id: 'new-user' } } };
      } }
    },
    from(table) {
      if (table === 'admin_audit') return { insert: async (row) => { audits.push(row); return {}; } };
      return { select() { return this; }, eq() { return this; }, single: async () => ({ data: { role, status } }) };
    }
  };
  vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\n/, '')), {
    Deno: { env: { get: () => 'server-only' }, serve: (fn) => { handler = fn; } },
    createClient: () => db, Response, console: { error() {} }
  });
  const send = (body, authorization = 'Bearer valid-token') => handler({
    method: 'POST', headers: new Headers(authorization ? { authorization } : {}), json: async () => body
  });
  return { send, created, audits };
}
const account = { action: 'create', full_name: '  Maria Silva  ', email: '  MARIA@example.com ', password: 'senha-teste-123', role: 'ALUNO', serie: ' 2º ano ' };

test('aluno recebe nome, e-mail normalizado, série e metadados confiáveis', async () => {
  const { send, created, audits } = setup();
  const response = await send(account);
  assert.equal(response.status, 201);
  assert.deepEqual(JSON.parse(JSON.stringify(created[0])), {
    email: 'maria@example.com', password: account.password, email_confirm: true,
    user_metadata: { full_name: 'Maria Silva', serie: '2º ano' }, app_metadata: { role: 'ALUNO' }
  });
  assert.equal(audits.length, 1);
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
