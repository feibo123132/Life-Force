"use strict";

(() => {
  // Public client environment ID shared with JIEYOU 存钱罐.
  const env = "jieyou-3gr01mvob9ad92de";
  const byId = id => document.getElementById(id);
  const dialog = byId("account");
  const illustration = dialog.querySelector(".account-art");
  const artworks = [
    { src: "./assets/account-harvest.png", alt: "鲸歌女仆捧着刚收获的蔬菜" },
    { src: "./assets/account-watering.png", alt: "鲸歌女仆给蔬菜浇水" },
    { src: "./assets/account-digging.png", alt: "鲸歌女仆用铲子挖地" },
  ];
  let previousArtwork;
  const title = byId("account-title");
  const loginTitle = title.textContent;
  const form = byId("account-form");
  const fields = byId("account-fields");
  const session = byId("account-session");
  const email = byId("account-email");
  const code = byId("account-code");
  const password = byId("account-password");
  const newPassword = byId("account-new-password");
  const confirmPassword = byId("account-confirm-password");
  const send = byId("account-send");
  const submit = byId("account-submit");
  const signOut = byId("account-sign-out");
  const status = byId("account-status");
  const modes = [...dialog.querySelectorAll("[data-mode]")];
  let mode = "code";
  let busy = false;
  let checkingSession = false;
  let promptedForLogin = false;
  let operationCount = 0;
  let authPromise;
  let verification;
  let resendAt = 0;
  let countdownTimer;
  let cloudApp;
  let financeSession;

  function getAuth() {
    authPromise ??= new Promise((resolve, reject) => {
      const sdk = document.createElement("script");
      sdk.src = "./assets/vendor/cloudbase-2.25.3.js";
      sdk.onload = resolve;
      sdk.onerror = () => reject(new Error("SDK load failed"));
      document.head.append(sdk);
    }).then(() => {
      cloudApp = window.cloudbase.init({ env, endPointMode: "GATEWAY", persistence: "local" });
      const auth = cloudApp.auth();
      auth.onLoginStateChanged?.(event => {
        if (event?.data?.eventType) refreshSession();
      })?.catch(() => {});
      return auth;
    })
      .catch(error => {
        authPromise = undefined;
        throw error;
      });
    return authPromise;
  }

  function showStatus(message = "", isError = false) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
    status.hidden = !message;
  }

  function checkResult(result) {
    if (result?.error) throw result.error;
    return result;
  }

  async function run(operation, failureMessage) {
    if (busy) return;
    operationCount++;
    busy = fields.disabled = signOut.disabled = true;
    showStatus("请稍候…");
    try {
      await operation(await getAuth());
    } catch (error) {
      const detail = [error?.code, error?.message, error?.error_description].filter(Boolean).join(" ");
      const unavailable = /sdk load|network|timeout|timed out|failed to fetch|非法来源|invalid origin/i.test(detail);
      showStatus(unavailable ? "暂时无法连接账号服务，请稍后重试。" : failureMessage, true);
    } finally {
      busy = fields.disabled = signOut.disabled = false;
    }
  }

  function clearSecrets() {
    code.value = password.value = newPassword.value = confirmPassword.value = "";
  }

  function selectMode(nextMode) {
    mode = dialog.dataset.mode = nextMode;
    for (const button of modes) button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    byId("account-verification").hidden = code.disabled = mode === "password";
    byId("account-password-section").hidden = password.disabled = mode !== "password";
    byId("account-setup").hidden = newPassword.disabled = confirmPassword.disabled = mode !== "setup";
    submit.textContent = mode === "setup" ? "确认设置密码" : "确认登录";
    clearSecrets();
    showStatus();
  }

  function showSession(login, verifiedEmail = "") {
    const user = login?.user;
    const address = user?.email || user?.emailAddress || verifiedEmail || user?.username || "";
    const uid = user?.uid || user?.id;
    const active = Boolean(uid && address && !login.isAnonymous && !user.isAnonymous);
    form.hidden = active;
    session.hidden = !active;
    byId("account-identity").textContent = active ? address : "";
    const separator = address.lastIndexOf("@");
    const name = separator < 0 ? address : address.slice(0, separator);
    const domain = separator < 0 ? "" : address.slice(separator + 1);
    byId("account-tool-email").textContent = active ? `${name.slice(0, Math.min(6, name.length - 1))}…${domain}` : "";
    byId("account-tool-status").hidden = !active;
    byId("player-login-status").hidden = !active;
    title.textContent = active ? "我的账号" : loginTitle;
    if (active) promptedForLogin = false;
    forestSave.connect(active ? uid : undefined, async request => {
      const { result } = await cloudApp.callFunction({ name: "forest-save-sync", data: request }, undefined, { timeout: 12000 });
      return result;
    });
    const financeAccount = active ? address.trim().toLowerCase() : "";
    if (financeAccount !== (financeSession?.account ?? "") || (active && uid !== financeSession?.uid)) {
      financeSession = financeAccount ? { account: financeAccount, uid, checkedAt: 0, pending: false } : undefined;
      byId("account-finance-status").textContent = "";
    }
    if (active) void forestSave.sync().then(refreshFinanceLink);
    return active;
  }

  async function refreshFinanceLink() {
    const current = financeSession;
    if (!current || !forestSave.ready() || current.pending || document.hidden || Date.now() - current.checkedAt < 5_000) return;
    current.pending = true;
    current.checkedAt = Date.now();
    const status = byId("account-finance-status");
    try {
      const { result } = await cloudApp.callFunction({ name: "forest-finance-link", data: {} }, undefined, { timeout: 8000 });
      if (financeSession !== current) return;
      if (!result?.ok || typeof result.date !== "string" || typeof result.recorded !== "boolean" || typeof result.happy !== "boolean" || !applyFinanceLink(result)) {
        status.textContent = "存钱罐联动暂不可用，稍后会自动重试。";
        return;
      }
      status.textContent = result.recorded ? "已同步今天的存钱罐记账状态。" : "等存钱罐同步今天的记账记录。";
    } catch {
      if (financeSession === current) status.textContent = "存钱罐联动暂不可用，稍后会自动重试。";
    } finally {
      current.pending = false;
    }
  }

  window.addEventListener("focus", refreshFinanceLink);
  document.addEventListener("visibilitychange", refreshFinanceLink);
  setInterval(refreshFinanceLink, 60_000);

  function updateResend() {
    const remaining = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
    send.disabled = remaining > 0;
    send.textContent = remaining ? `${remaining} 秒` : "发送";
    clearTimeout(countdownTimer);
    if (remaining) countdownTimer = setTimeout(updateResend, 1000);
  }

  function enteredEmail() {
    const address = email.value.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return address;
    showStatus("请输入有效的邮箱地址。", true);
    email.focus();
    return "";
  }

  function signInWithPassword(auth, address, secret) {
    const signIn = auth.signInWithPassword ?? auth.signIn;
    return signIn.call(auth, { email: address, username: address, password: secret });
  }

  async function readLoginState(auth) {
    if (auth.hasLoginState?.() === null) return null;
    const login = await auth.getLoginState();
    // The SDK also returns null if a token refresh fails while credentials are still stored.
    if (!login && auth.hasLoginState?.()) throw new Error("Session check failed");
    return login;
  }

  function openAccountDialog() {
    if (dialog.open) return;
    const choices = artworks.filter(artwork => artwork !== previousArtwork);
    const artwork = choices[Math.floor(Math.random() * choices.length)];
    illustration.src = artwork.src;
    illustration.alt = artwork.alt;
    previousArtwork = artwork;
    dialog.showModal();
  }

  async function refreshSession() {
    if (busy || checkingSession || document.hidden) return;
    const operationAtStart = operationCount;
    checkingSession = true;
    try {
      const auth = await getAuth();
      if (operationAtStart !== operationCount) return;
      const cached = auth.hasLoginState?.();
      if (cached && session.hidden) showSession(cached);
      if (!navigator.onLine) return;
      const login = await readLoginState(auth);
      if (operationAtStart !== operationCount) return;
      const wasLoggedIn = !session.hidden;
      if (showSession(login) || promptedForLogin) return;
      promptedForLogin = true;
      if (wasLoggedIn) showStatus("登录已失效，请重新登录。", true);
      openAccountDialog();
    } catch {
      // A connection failure is retried on the next check.
    } finally {
      checkingSession = false;
    }
  }

  byId("open-account").addEventListener("click", () => {
    openAccountDialog();
    run(async auth => {
      const login = await readLoginState(auth);
      promptedForLogin = !showSession(login);
      showStatus();
    }, "无法读取登录状态，请重试。");
  });
  dialog.addEventListener("close", clearSecrets);
  for (const button of modes) {
    button.addEventListener("click", () => selectMode(button.dataset.mode));
  }

  send.addEventListener("click", () => {
    const address = enteredEmail();
    if (!address || resendAt > Date.now()) return;
    run(async auth => {
      const info = checkResult(await auth.getVerification({ email: address }));
      if (!info?.verification_id) throw new Error("Missing verification context");
      verification = { address, info };
      resendAt = Date.now() + 60_000;
      updateResend();
      showStatus("验证码已发送，请查看邮箱。");
    }, "验证码发送失败，请检查邮箱地址或稍后重试。");
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (busy) return;
    const address = enteredEmail();
    if (!address) return;
    if (mode !== "password" && verification?.address !== address) {
      showStatus("请先为这个邮箱发送验证码。", true);
      return;
    }
    if (mode === "setup" && newPassword.value !== confirmPassword.value) {
      showStatus("两次输入的密码不一致。", true);
      confirmPassword.focus();
      return;
    }
    const verificationCode = code.value;
    const secret = mode === "setup" ? newPassword.value : password.value;
    const verificationInfo = verification?.info;
    const failureMessage = {
      code: "登录失败，请检查验证码是否正确或已过期。",
      password: "登录失败，请检查邮箱和密码。忘记密码可用「设置密码」。",
      setup: "设置密码失败，请检查验证码和密码后重试。",
    }[mode];
    run(async auth => {
      let passwordUpdated = false;
      if (mode === "setup") {
        const verified = checkResult(await auth.verify({
          verification_id: verificationInfo.verification_id,
          verification_code: verificationCode,
        }));
        if (!verified?.verification_token) throw new Error("Missing verification token");
        checkResult(await auth.resetPassword({ email: address, new_password: secret, verification_token: verified.verification_token }));
        passwordUpdated = true;
        verification = undefined;
      }
      try {
        const result = mode === "code"
          ? await auth.signInWithEmail({ email: address, verificationCode, verificationInfo })
          : await signInWithPassword(auth, address, secret);
        checkResult(result);
        if (!showSession(await auth.getLoginState(), address)) throw new Error("Missing login session");
      } catch (error) {
        if (!passwordUpdated) throw error;
        selectMode("password");
        showStatus("密码已更新，请用新密码登录。", true);
        return;
      }
      verification = undefined;
      clearSecrets();
      showStatus(passwordUpdated ? "密码已更新并登录。" : "登录成功。");
    }, failureMessage);
  });

  signOut.addEventListener("click", () => {
    run(async auth => {
      checkResult(await auth.signOut());
      verification = undefined;
      showSession(null);
      promptedForLogin = true;
      selectMode("code");
      showStatus("已退出登录。");
    }, "退出登录失败，请稍后重试。");
  });

  window.addEventListener("focus", refreshSession);
  window.addEventListener("online", refreshSession);
  document.addEventListener("visibilitychange", refreshSession);
  setInterval(refreshSession, 30_000);
  refreshSession();
})();
