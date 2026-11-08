import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";

import middleware from "../middleware";

const secret = "middleware-regression-test-secret";

async function withAuthEnvironment(
  values: Record<string, string | undefined>,
  run: () => Promise<void>,
) {
  const names = ["AUTH_SECRET", "NEXTAUTH_SECRET", "AUTH_URL", "NEXTAUTH_URL"];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) {
      const value = values[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await run();
  } finally {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

async function authenticatedRequest(url: string, secure: boolean) {
  const cookieName = `${secure ? "__Secure-" : ""}authjs.session-token`;
  const token = await encode({
    secret,
    salt: cookieName,
    token: { id: "test-user", isAdmin: false, onboardingComplete: true },
  });
  return new NextRequest(url, { headers: { cookie: `${cookieName}=${token}` } });
}

test("middleware accepts an Auth.js secure session cookie over HTTPS", async () => {
  await withAuthEnvironment({ AUTH_SECRET: secret }, async () => {
    const request = await authenticatedRequest("https://beseder.example/planner", true);
    const response = await middleware(request);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  });
});

test("middleware accepts the development session cookie over HTTP", async () => {
  await withAuthEnvironment({ AUTH_SECRET: secret }, async () => {
    const request = await authenticatedRequest("http://localhost:3000/planner", false);
    const response = await middleware(request);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  });
});

test("middleware follows the configured Auth.js origin behind an HTTP proxy", async () => {
  for (const name of ["AUTH_URL", "NEXTAUTH_URL"]) {
    await withAuthEnvironment({ AUTH_SECRET: secret, [name]: "https://beseder.example" }, async () => {
      const request = await authenticatedRequest("http://internal:3000/planner", true);
      const response = await middleware(request);
      assert.equal(response.headers.get("x-middleware-next"), "1", name);
    });
  }
});

test("middleware supports the NEXTAUTH_SECRET alias used by NextAuth", async () => {
  await withAuthEnvironment({ NEXTAUTH_SECRET: secret }, async () => {
    const request = await authenticatedRequest("http://localhost:3000/planner", false);
    const response = await middleware(request);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  });
});

test("middleware still redirects requests without a session to sign in", async () => {
  await withAuthEnvironment({ AUTH_SECRET: secret }, async () => {
    const response = await middleware(new NextRequest("https://beseder.example/planner"));
    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get("location"),
      "https://beseder.example/auth/sign-in?callbackUrl=%2Fplanner",
    );
  });
});
