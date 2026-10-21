import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../senai-auth.js', import.meta.url), 'utf8');
async function setup(t, role = 'ADM', options = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://smartclass.test' });
  t.after(() => dom.window.close());
  const { window } = dom, calls = [];
  const profile = options.missingProfile ? null : { id: 'actor', role, status: 'ATIVO', full_name: 'Conta teste', serie: role === 'ALUNO' ? '2º ano' : null };
  const client = {
    auth: {
      signOut: async () => ({}), signInWithPassword: async () => ({}),
      getUser: async () => ({ data: { user: { id: 'actor', email: 'adm@example.com', user_metadata: { role: 'ADM' } } } })
    },
    from: () => ({ select() { return this; }, eq() { return this; }, order() { return this; }, single: async () => ({ data: profile }), limit: async () => ({ data: [] }) }),
    functions: { invoke: async (_name, { body }) => {
      calls.push(body);
      if (body.action === 'list') return { data: { users: [{ ...profile, full_name: '<img src=x onerror=alert(1)>' }] } };
      if (options.createError) return { error: { context: { json: async () => ({ error: options.createError }) } } };
      return { data: { ok: true } };
    } }
  };
  window.supabase = { createClient: () => client };
  window.eval(script);
  await window.senaiAuth.start(() => {}, {}, () => {});
  const $ = (id) => window.document.getElementById(id);
  $('senai-email').value = 'adm@example.com';
  $('senai-password').value = 'senha-de-teste';
  $('senai-login-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  await settle();
  return { window, $, calls, settle };
}
test('formulário exclusivo do ADM e lista trata nomes como texto', async (t) => {
  const { $, calls } = await setup(t);
  assert.equal($('gestao-contas').hidden, false);
  assert.ok(calls.some((c) => c.action === 'list'));
  assert.match($('contas-lista').textContent, /<img/);
  assert.equal($('contas-lista').querySelector('img'), null);
});
for (const role of ['ALUNO', 'PROFESSOR']) {
  test(`${role} vê seu perfil e não acessa gestão`, async (t) => {
    const { $, calls } = await setup(t, role);
    assert.equal($('gestao-contas').hidden, true);
    assert.equal($('aba-btn-config').hidden, true);
    assert.match($('conta-tipo').textContent, role === 'ALUNO' ? /Aluno/ : /Professor/);
    assert.equal($('conta-serie-item').hidden, role !== 'ALUNO');
    assert.equal(calls.length, 0);
  });
}
test('série só é visível e obrigatória para aluno', async (t) => {
  const { $, window } = await setup(t);
  assert.equal($('nova-serie').required, true);
  $('nova-serie').value = '2º ano';
  for (const role of ['PROFESSOR', 'ADM', 'ALUNO']) {
    $('novo-perfil').value = role;
    $('novo-perfil').dispatchEvent(new window.Event('change'));
    assert.equal($('nova-serie-campo').hidden, role !== 'ALUNO');
    assert.equal($('nova-serie').required, role === 'ALUNO');
    assert.equal($('nova-serie').disabled, role !== 'ALUNO');
    assert.equal($('nova-serie').value, '');
  }
});
for (const role of ['ADM', 'ALUNO', 'PROFESSOR']) {
  test(`envia criação de ${role} e limpa senha após sucesso`, async (t) => {
    const { $, calls, window, settle } = await setup(t);
    $('novo-nome').value = 'Maria Silva';
    $('novo-email').value = 'maria@example.com';
    $('novo-perfil').value = role;
    $('novo-perfil').dispatchEvent(new window.Event('change'));
    $('nova-serie').value = role === 'ALUNO' ? '2º ano' : '';
    $('nova-senha').value = 'senha-de-teste-123';
    $('criar-conta-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    await settle();
    const request = calls.find((c) => c.action === 'create');
    assert.ok(request);
    assert.equal(request.role, role);
    assert.equal(request.serie, role === 'ALUNO' ? '2º ano' : null);
    assert.equal(request.full_name, 'Maria Silva');
    assert.equal($('nova-senha').value, '');
    assert.equal($('criar-conta-status').dataset.tipo, 'sucesso');
    assert.equal($('btn-criar-conta').disabled, false);
  });
}
test('erro do servidor aparece sem perder nome e e-mail', async (t) => {
  const { $, window, settle } = await setup(t, 'ADM', { createError: 'Já existe uma conta com este e-mail' });
  $('novo-nome').value = 'Maria'; $('novo-email').value = 'maria@example.com';
  $('nova-serie').value = '2º ano'; $('nova-senha').value = 'senha-de-teste';
  $('criar-conta-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
  await settle();
  assert.match($('criar-conta-status').textContent, /Já existe/);
  assert.equal($('novo-nome').value, 'Maria');
  assert.equal($('nova-senha').value, '');
  assert.equal($('btn-criar-conta').disabled, false);
});
test('perfil ausente não aceita user_metadata ADM como autorização', async (t) => {
  const { $, calls } = await setup(t, 'ADM', { missingProfile: true });
  assert.equal($('gestao-contas').hidden, true);
  assert.match($('senai-status').textContent, /validar seu perfil/);
  assert.equal(calls.length, 0);
});
