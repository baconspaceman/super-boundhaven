// Waitlist form: client-side validation + JSON POST. No backend exists yet, so a missing
// endpoint is reported honestly as "sign-ups aren't connected yet" instead of faking success.
const ENDPOINT: string = import.meta.env.VITE_WAITLIST_URL ?? `${import.meta.env.BASE_URL}api/waitlist`;

// Deliberately simple: something@something.tld, no whitespace. The server must re-validate.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface WaitlistPayload {
  email: string;
  displayName?: string;
  consent: true;
  source: 'site';
}

export type SubmitResult =
  | { kind: 'ok' }
  | { kind: 'not-connected' }
  | { kind: 'rejected'; message: string }
  | { kind: 'error'; message: string };

export function validate(email: string, name: string, consent: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  const e = email.trim();
  if (!e) errors.email = 'Enter your email address.';
  else if (e.length > 254 || !EMAIL_RE.test(e)) errors.email = 'That email address looks incomplete. Check it and try again.';
  if (name.trim().length > 32) errors.name = 'Display names can be up to 32 characters.';
  if (!consent) errors.consent = 'Please tick the box so we know you are happy for us to store your email.';
  return errors;
}

export async function submitWaitlist(p: WaitlistPayload): Promise<SubmitResult> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(p),
    });
  } catch {
    // Network failure or CORS block: indistinguishable from "no endpoint" for a static site.
    return { kind: 'not-connected' };
  }
  if (res.status === 404 || res.status === 405 || res.status === 501) return { kind: 'not-connected' };
  const type = res.headers.get('content-type') ?? '';
  if (res.ok) {
    // A dev/static server that answers every path with index.html is not a real endpoint.
    if (!type.includes('json')) return { kind: 'not-connected' };
    return { kind: 'ok' };
  }
  if (res.status === 400 || res.status === 409 || res.status === 422) {
    let message = 'The sign-up was not accepted. Please check your details.';
    try {
      const j = (await res.json()) as { error?: unknown; message?: unknown };
      const m = typeof j.error === 'string' ? j.error : typeof j.message === 'string' ? j.message : '';
      if (m) message = m.slice(0, 200);
    } catch {
      /* keep default */
    }
    return { kind: 'rejected', message };
  }
  if (res.status === 429) return { kind: 'error', message: 'Too many attempts. Please wait a minute and try again.' };
  return { kind: 'error', message: 'Something went wrong on our side. Please try again later.' };
}

export function initWaitlist(): void {
  const form = document.getElementById('waitlist-form') as HTMLFormElement | null;
  if (!form) return;
  const email = form.elements.namedItem('email') as HTMLInputElement;
  const name = form.elements.namedItem('displayName') as HTMLInputElement;
  const consent = form.elements.namedItem('consent') as HTMLInputElement;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const status = document.getElementById('waitlist-status')!;
  const errEls: Record<string, HTMLElement> = {
    email: document.getElementById('err-email')!,
    name: document.getElementById('err-name')!,
    consent: document.getElementById('err-consent')!,
  };
  const inputs: Record<string, HTMLInputElement> = { email, name, consent };

  const setStatus = (kind: 'idle' | 'busy' | 'ok' | 'info' | 'error', text: string) => {
    status.dataset.kind = kind;
    status.textContent = text;
    status.hidden = kind === 'idle';
  };

  const showErrors = (errors: Record<string, string>) => {
    for (const key of Object.keys(errEls)) {
      const msg = errors[key] ?? '';
      errEls[key].textContent = msg;
      errEls[key].hidden = !msg;
      if (msg) inputs[key].setAttribute('aria-invalid', 'true');
      else inputs[key].removeAttribute('aria-invalid');
    }
  };

  // Clear a field's error as soon as it becomes valid.
  form.addEventListener('input', () => {
    if (!form.dataset.touched) return;
    showErrors(validate(email.value, name.value, consent.checked));
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    form.dataset.touched = '1';
    const errors = validate(email.value, name.value, consent.checked);
    showErrors(errors);
    const first = (['email', 'name', 'consent'] as const).find((k) => errors[k]);
    if (first) {
      setStatus('error', 'Please fix the highlighted field and try again.');
      inputs[first].focus();
      return;
    }
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    setStatus('busy', 'Sending...');
    const payload: WaitlistPayload = { email: email.value.trim(), consent: true, source: 'site' };
    if (name.value.trim()) payload.displayName = name.value.trim();
    const result = await submitWaitlist(payload);
    button.disabled = false;
    button.removeAttribute('aria-busy');
    switch (result.kind) {
      case 'ok':
        setStatus('ok', 'You are on the list. We will only email you Super BoundHaven news. Thank you!');
        form.reset();
        delete form.dataset.touched;
        showErrors({});
        break;
      case 'not-connected':
        setStatus(
          'info',
          "Sign-ups aren't connected yet. Nothing was saved or sent. The waitlist backend is still being built, so please check back soon.",
        );
        break;
      case 'rejected':
      case 'error':
        setStatus('error', result.message);
        break;
    }
  });
}
