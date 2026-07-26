/* V2.6: 登录/注册/登出 */
(function () {
  let isRegisterMode = false;
  // 默认登录模式
  document.addEventListener('DOMContentLoaded', () => {
    setMode(false);
  });
  // 立即调用
  if (document.readyState !== 'loading') setMode(false);

  function getClient() {
    return window.supabaseClient;
  }

  function setMode(register) {
    isRegisterMode = register;
    document.getElementById('login-submit-text').textContent = register ? '创建账号' : '登 录';
    document.getElementById('login-toggle-text').textContent = register ? '已经有账号?' : '还没账号?';
    document.getElementById('login-toggle-link').textContent = register ? '去登录' : '去注册';
    document.getElementById('login-password').setAttribute('autocomplete', register ? 'new-password' : 'current-password');
  }

  async function submit() {
    const client = getClient();
    if (!client) { toast('云端未配置,先离线用'); return; }
    const email = document.getElementById('login-email').value.trim();
    const pwd = document.getElementById('login-password').value;
    if (!email || !pwd) { toast('请填邮箱和密码'); return; }
    if (pwd.length < 6) { toast('密码至少 6 位'); return; }
    const btn = document.getElementById('btn-login-submit');
    btn.disabled = true;
    try {
      let result;
      if (isRegisterMode) {
        result = await client.auth.signUp({ email, password: pwd });
        if (result.error) { toast('注册失败:' + result.error.message); return; }
        if (result.data?.user && !result.data?.session) {
          toast('注册成功!请到邮箱点确认链接');
          return;
        }
        toast('注册成功!');
      } else {
        result = await client.auth.signInWithPassword({ email, password: pwd });
        if (result.error) { toast('登录失败:' + result.error.message); return; }
        toast('登录成功!');
      }
      // session 会被 onAuthStateChange 监听到,自动跳转
    } catch (e) {
      toast('出错了:' + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function signInWithGoogle() {
    const client = getClient();
    if (!client) { toast('云端未配置,先离线用'); return; }
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) { toast('Google 登录失败:' + error.message); return; }
      // 会跳转到 Google,回来后 onAuthStateChange 触发
    } catch (e) {
      toast('出错了:' + e.message);
    }
  }

  async function signOut() {
    const client = getClient();
    if (!client) return;
    await client.auth.signOut();
    toast('已登出');
  }

  async function changePassword(newPassword) {
    const client = getClient();
    if (!client) return { error: { message: '云端未配置' } };
    if (!newPassword || newPassword.length < 6) {
      return { error: { message: '密码至少 6 位' } };
    }
    return await client.auth.updateUser({ password: newPassword });
  }

  async function deleteAccount() {
    const client = getClient();
    if (!client) return { error: { message: '云端未配置' } };
    return await client.rpc('delete_user_account');
  }

  async function resetPassword(email) {
    const client = getClient();
    if (!client) return { error: { message: '云端未配置' } };
    if (!email) return { error: { message: '请填邮箱' } };
    return await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
  }

  async function getCurrentUser() {
    const client = getClient();
    if (!client) return null;
    const { data } = await client.auth.getUser();
    return data?.user || null;
  }

  function bindLoginUI() {
    document.getElementById('btn-login-submit').addEventListener('click', submit);
    document.getElementById('btn-google-login').addEventListener('click', signInWithGoogle);
    document.getElementById('login-toggle-link').addEventListener('click', () => setMode(!isRegisterMode));
    document.getElementById('login-skip').addEventListener('click', () => {
      // 离线模式:直接进首页
      enterAppOffline();
    });
    // Enter 提交
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    // 忘记密码
    document.getElementById('login-forgot').addEventListener('click', async () => {
      const email = document.getElementById('login-email').value.trim();
      if (!email) { toast('请先填邮箱'); return; }
      const { error } = await resetPassword(email);
      if (error) { toast('发送失败:' + error.message); return; }
      toast('重置链接已发到 ' + email + ',请查收');
    });
  }

  // 暴露给 app.js / sync.js
  window.JDAuth = {
    submit, signInWithGoogle, signOut, getCurrentUser, setMode, bindLoginUI,
    changePassword, deleteAccount, resetPassword,
  };
})();
