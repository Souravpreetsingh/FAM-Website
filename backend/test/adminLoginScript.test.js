/**
 * Behavioural test for public/admin/js/login.js.
 *
 * The bug this guards: on a failed login the client threw only body.message.
 * For a validation failure the server sets message to the literal string
 * "Validation failed" and puts the actual reason in body.errors, so a login
 * with a typo'd or empty email told the owner nothing about what to fix. The
 * browser console showed a bare 400 and the page said "Validation failed".
 *
 * The script is an IIFE, so it is executed in a vm with a stubbed DOM and the
 * submit handler is driven for real. Asserting on strings alone would not catch
 * this: the old code did contain the word "message".
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', '..', 'public', 'admin', 'js', 'login.js');
const code = fs.readFileSync(SRC, 'utf8');

/** Runs login.js and returns a driver for the captured form handler. */
function mount({ email = '', password = '', response } = {}) {
  const log = { fetches: [], navigatedTo: null, user: null };

  const els = {
    loginForm: { addEventListener: (evt, fn) => { els.loginForm.handler = fn; } },
    loginError: { hidden: true, textContent: '' },
    loginBtn: { disabled: false, textContent: 'Sign in' },
    email: { value: email },
    password: { value: password },
  };

  // The script does `window.location.href = ...`, which mutates the object
  // returned by the getter rather than assigning to `location` itself, so the
  // getter has to hand back one stable object to observe.
  const location = { href: '' };

  const context = {
    document: { getElementById: (id) => els[id] },
    window: {
      AdminAuth: { setUser: (u) => { log.user = u; } },
      location,
    },
    fetch: (url, opts) => {
      log.fetches.push({ url, opts, body: JSON.parse(opts.body) });
      return Promise.resolve(response);
    },
    setTimeout,
    console,
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'login.js' });

  return {
    log,
    els,
    get navigatedTo() { return location.href; },
    /** Fires submit and lets the promise chain settle. */
    async submit() {
      els.loginForm.handler({ preventDefault() {} });
      for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
    },
  };
}

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

test('a validation failure shows the field error, not "Validation failed"', async () => {
  const d = mount({
    email: 'not-an-email',
    password: 'secret',
    response: jsonResponse(400, {
      success: false,
      message: 'Validation failed',
      errors: [{ field: 'email', message: 'Please provide a valid email' }],
    }),
  });
  await d.submit();
  assert.strictEqual(d.els.loginError.hidden, false, 'the error must be visible');
  assert.strictEqual(d.els.loginError.textContent, 'Please provide a valid email');
  assert.ok(
    !d.els.loginError.textContent.includes('Validation failed'),
    'the generic server message must not be what the owner reads'
  );
});

test('several field errors are joined into one readable line', async () => {
  const d = mount({
    // Both fields are filled, so the request really is sent and the server's
    // multi-error response is what gets rendered.
    email: 'owner@fam.test',
    password: 'secret',
    response: jsonResponse(400, {
      success: false,
      message: 'Validation failed',
      errors: [
        { field: 'email', message: 'Please provide a valid email' },
        { field: 'password', message: 'Password is required' },
      ],
    }),
  });
  await d.submit();
  assert.strictEqual(d.log.fetches.length, 1, 'the request must have been sent');
  const text = d.els.loginError.textContent;
  assert.ok(text.includes('Please provide a valid email'), text);
  assert.ok(text.includes('Password is required'), text);
});

test('a bad password still shows the server message', async () => {
  const d = mount({
    email: 'owner@fam.test',
    password: 'wrong',
    response: jsonResponse(401, { success: false, message: 'Invalid email or password' }),
  });
  await d.submit();
  assert.strictEqual(d.els.loginError.textContent, 'Invalid email or password');
});

test('a non-JSON failure response does not produce an empty error', async () => {
  const d = mount({
    email: 'owner@fam.test',
    password: 'secret',
    response: { ok: false, status: 500, json: () => Promise.reject(new Error('bad json')) },
  });
  await d.submit();
  assert.ok(d.els.loginError.textContent.length > 0, 'must still say something');
  assert.strictEqual(d.els.loginError.hidden, false);
});

test('an empty form is caught before any request is sent', async () => {
  const d = mount({ email: '', password: '' });
  await d.submit();
  assert.strictEqual(d.log.fetches.length, 0, 'no pointless round trip for an empty form');
  assert.strictEqual(d.els.loginError.textContent, 'Enter your email and password.');
  assert.strictEqual(d.els.loginBtn.disabled, false, 'the button must stay usable');
});

test('the password is sent verbatim, never trimmed', async () => {
  // Trimming a password is a classic way to lock people out: leading and
  // trailing spaces are legal characters, and silently stripping them turns a
  // correct password into "Invalid email or password". Only the email is
  // normalised.
  const d = mount({
    email: 'owner@fam.test',
    password: '  spaces matter  ',
    response: jsonResponse(200, { success: true, data: { user: { role: 'admin' } } }),
  });
  await d.submit();
  assert.strictEqual(d.log.fetches.length, 1);
  assert.strictEqual(d.log.fetches[0].body.password, '  spaces matter  ');
});

test('a successful login stores the user and moves on', async () => {
  const d = mount({
    email: '  owner@fam.test  ',
    password: 'secret',
    response: jsonResponse(200, { success: true, data: { user: { role: 'admin' } } }),
  });
  await d.submit();
  assert.strictEqual(d.log.fetches.length, 1);
  assert.deepStrictEqual(d.log.fetches[0].body, { email: 'owner@fam.test', password: 'secret' });
  assert.deepStrictEqual(d.log.user, { role: 'admin' });
  assert.strictEqual(d.navigatedTo, '/admin/index.html');
  assert.strictEqual(d.els.loginError.hidden, true, 'no error on success');
});

test('the request uses cookies and never puts the password anywhere else', async () => {
  const d = mount({
    email: 'owner@fam.test',
    password: 'secret',
    response: jsonResponse(200, { success: true, data: { user: { role: 'admin' } } }),
  });
  await d.submit();
  const call = d.log.fetches[0];
  assert.strictEqual(call.opts.credentials, 'include');
  assert.strictEqual(call.opts.method, 'POST');
  assert.strictEqual(call.url, '/api/v1/admin/login');
  assert.deepStrictEqual(Object.keys(call.opts).sort(), ['body', 'credentials', 'headers', 'method']);
});

test('a failed attempt re-enables the button so a retry is possible', async () => {
  const d = mount({
    email: 'owner@fam.test',
    password: 'wrong',
    response: jsonResponse(401, { success: false, message: 'Invalid email or password' }),
  });
  await d.submit();
  assert.strictEqual(d.els.loginBtn.disabled, false);
  assert.strictEqual(d.els.loginBtn.textContent, 'Sign in');
});
