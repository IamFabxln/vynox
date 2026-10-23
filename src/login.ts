import '../css/vynox.css';
import { auth } from './auth.ts';

document.addEventListener('DOMContentLoaded', async () => {
  // Check if already logged in
  const user = await auth.checkSession();
  if (user) {
    window.location.href = '/html/dash.html';
    return;
  }

  const tabLogin = document.getElementById('tab-login') as HTMLButtonElement;
  const tabRegister = document.getElementById('tab-register') as HTMLButtonElement;
  const formLogin = document.getElementById('form-login') as HTMLFormElement;
  const formRegister = document.getElementById('form-register') as HTMLFormElement;
  const errorAlert = document.getElementById('error-alert') as HTMLDivElement;
  const errorText = document.getElementById('error-text') as HTMLParagraphElement;
  const submitLoginBtn = document.getElementById('btn-submit-login') as HTMLButtonElement;
  const submitRegisterBtn = document.getElementById('btn-submit-register') as HTMLButtonElement;

  function showError(msg: string) {
    errorText.textContent = msg;
    errorAlert.classList.remove('hidden');
    errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideError() {
    errorAlert.classList.add('hidden');
    errorText.textContent = '';
  }

  // Tab switching
  tabLogin.addEventListener('click', () => {
    hideError();
    tabLogin.classList.add('bg-[#28231E]', 'text-amber-400', 'border-amber-500/40', 'shadow-sm');
    tabLogin.classList.remove('text-[#8F867C]', 'border-transparent');
    tabRegister.classList.remove('bg-[#28231E]', 'text-amber-400', 'border-amber-500/40', 'shadow-sm');
    tabRegister.classList.add('text-[#8F867C]', 'border-transparent');
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
  });

  tabRegister.addEventListener('click', () => {
    hideError();
    tabRegister.classList.add('bg-[#28231E]', 'text-amber-400', 'border-amber-500/40', 'shadow-sm');
    tabRegister.classList.remove('text-[#8F867C]', 'border-transparent');
    tabLogin.classList.remove('bg-[#28231E]', 'text-amber-400', 'border-amber-500/40', 'shadow-sm');
    tabLogin.classList.add('text-[#8F867C]', 'border-transparent');
    formRegister.classList.remove('hidden');
    formLogin.classList.add('hidden');
  });


  // Handle Login submission
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const email = (document.getElementById('login-email') as HTMLInputElement).value;
    const password = (document.getElementById('login-password') as HTMLInputElement).value;

    if (!email || !password) {
      showError('Por favor ingresa tu correo y contraseña.');
      return;
    }

    submitLoginBtn.disabled = true;
    submitLoginBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      Verificando credenciales...
    `;

    const res = await auth.login(email, password);
    submitLoginBtn.disabled = false;
    submitLoginBtn.innerHTML = 'Iniciar Sesión';

    if (res.success) {
      window.location.href = '/html/dash.html';
    } else {
      showError(res.error || 'Credenciales inválidas.');
    }
  });

  // Handle Register submission
  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const name = (document.getElementById('reg-name') as HTMLInputElement).value;
    const email = (document.getElementById('reg-email') as HTMLInputElement).value;
    const password = (document.getElementById('reg-password') as HTMLInputElement).value;
    const confirmPassword = (document.getElementById('reg-confirm-password') as HTMLInputElement).value;

    if (!name || name.trim().length < 2) {
      showError('Ingresa un nombre de usuario válido (mínimo 2 letras).');
      return;
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      showError('Por favor ingresa una dirección de correo válida.');
      return;
    }
    if (!password || password.length < 6) {
      showError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      showError('Las contraseñas no coinciden.');
      return;
    }

    submitRegisterBtn.disabled = true;
    submitRegisterBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      Creando tu cuenta...
    `;

    const res = await auth.register(name, email, password);
    submitRegisterBtn.disabled = false;
    submitRegisterBtn.innerHTML = 'Crear Cuenta';

    if (res.success) {
      window.location.href = '/html/dash.html';
    } else {
      showError(res.error || 'No se pudo crear la cuenta.');
    }
  });
});
