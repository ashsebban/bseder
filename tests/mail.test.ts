import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

function setEmailEnvironment(t: TestContext, apiKey?: string) {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.RESEND_FROM;
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
  if (apiKey !== undefined) process.env.RESEND_API_KEY = apiKey;

  t.after(() => {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
    if (previousFrom === undefined) delete process.env.RESEND_FROM;
    else process.env.RESEND_FROM = previousFrom;
  });
}

test("mail module imports without runtime email credentials", async (t) => {
  setEmailEnvironment(t);

  const mail = await import("../src/lib/mail");

  assert.equal(typeof mail.sendPasswordResetEmail, "function");
});

test("sending without an email API key fails before contacting Resend", async (t) => {
  setEmailEnvironment(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected external request");
  });
  const { sendPasswordResetEmail } = await import("../src/lib/mail");

  await assert.rejects(
    sendPasswordResetEmail("user@example.com", "https://example.com/reset"),
    /RESEND_API_KEY is required/,
  );
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("password reset email sends the requested recipient and link", async (t) => {
  setEmailEnvironment(t, "re_test_key");
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ id: "email-id" }),
  );
  const { sendPasswordResetEmail } = await import("../src/lib/mail");

  await sendPasswordResetEmail("user@example.com", "https://example.com/reset?token=test");

  assert.equal(fetchMock.mock.callCount(), 1);
  const [url, options] = fetchMock.mock.calls[0].arguments as unknown as [string, RequestInit];
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(new Headers(options.headers).get("authorization"), "Bearer re_test_key");
  const payload = JSON.parse(options.body as string);
  assert.equal(payload.to, "user@example.com");
  assert.equal(payload.from, "B'Seder <noreply@beseder.app>");
  assert.equal(payload.subject, "Reset your B'Seder password");
  assert.match(payload.html, /https:\/\/example\.com\/reset\?token=test/);
});

test("a rejected email is reported as a send failure", async (t) => {
  setEmailEnvironment(t, "re_test_key");
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { name: "validation_error", message: "Sender domain is not verified" },
      { status: 422 },
    ),
  );
  const { sendPasswordResetEmail } = await import("../src/lib/mail");

  await assert.rejects(
    sendPasswordResetEmail("user@example.com", "https://example.com/reset"),
    /Failed to send password reset email: Sender domain is not verified/,
  );
});
