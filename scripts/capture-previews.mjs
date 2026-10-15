import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";

if (process.env.CI !== "true" || process.env.CONFIRM_DEMO_SEED !== "create-demo-in-empty-database") {
  throw new Error("Preview capture only runs in the disposable CI environment.");
}
const base = "http://127.0.0.1:3000";
const output = "ui-previews";
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000"],
  { stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, AUTH_URL: base } });
let browser;
const evidence = [];
try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(base + "/api/auth/providers")).ok) { ready = true; break; } } catch {}
    await delay(1000);
  }
  assert(ready, "Preview server did not become ready");
  browser = await chromium.launch({ headless: true });
  async function context() {
    return browser.newContext({ viewport: { width: 1600, height: 1080 }, deviceScaleFactor: 1, locale: "zh-CN", timezoneId: "Asia/Shanghai" });
  }
  async function capture(page, name, path) {
    console.log("Capturing " + name + " at " + path);
    const errors = [];
    const onError = error => errors.push(error.message);
    page.on("pageerror", onError);
    const response = await page.goto(base + path);
    assert.equal(response.status(), 200, path);
    await page.locator("h1").first().waitFor();
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: output + "/" + name + ".png", fullPage: false, animations: "disabled" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + " overflows");
    assert.equal(errors.length, 0, JSON.stringify(errors));
    page.off("pageerror", onError);
    evidence.push({ file: name + ".png", path, actualBrowserScreenshot: true, data: "synthetic CI demo only", viewport: page.viewportSize() });
  }
  async function login(page, email, destination) {
    await page.goto(base + "/zh/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(process.env.ADMIN_SEED_PASSWORD);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.waitForURL(base + destination);
    await page.locator("h1").first().waitFor();
  }
  const adminContext = await context();
  const admin = await adminContext.newPage();
  await capture(admin, "01-login", "/zh/login");
  await login(admin, process.env.ADMIN_SEED_EMAIL, "/zh/admin");
  for (const [name, path] of [
    ["02-admin-overview", "/zh/admin"],
    ["03-admin-applications", "/zh/admin?tab=applications"],
    ["04-admin-students", "/zh/admin?tab=students"],
    ["05-admin-schedule", "/zh/admin?tab=schedule"],
    ["06-admin-attendance", "/zh/admin?tab=attendance"],
    ["07-admin-teachers", "/zh/admin?tab=teacher-accounts"]
  ]) await capture(admin, name, path);
  const teacherContext = await context();
  const teacher = await teacherContext.newPage();
  await login(teacher, "teacher@example.com", "/zh/portal/teacher");
  await capture(teacher, "08-teacher-portal", "/zh/portal/teacher");
  const studentContext = await context();
  const student = await studentContext.newPage();
  await login(student, "student@example.com", "/zh/portal/student");
  await capture(student, "09-student-portal", "/zh/portal/student");
  await student.setViewportSize({ width: 393, height: 852 });
  await capture(student, "10-mobile-student", "/zh/portal/student");
  await writeFile(output + "/evidence.json", JSON.stringify({ generatedAt: new Date().toISOString(), browser: "Playwright Chromium", realRuntime: true, usesProductionData: false, evidence }, null, 2));
  console.log("Captured " + evidence.length + " real runtime screenshots with synthetic data.");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
