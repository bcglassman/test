/** Minimal Directus REST client. The SDK would work too; this keeps deps to one. */

export class Directus {
  constructor(url) {
    this.url = url.replace(/\/$/, '');
    this.token = null;
  }

  async login(email, password) {
    const data = await this.request('POST', '/auth/login', { email, password }, { auth: false });
    this.token = data.access_token;
    return this.token;
  }

  async request(method, path, body, { auth = true, allowStatus = [] } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(`${this.url}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 204) return null;

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      if (allowStatus.includes(response.status)) return { __status: response.status, ...payload };
      const detail = payload?.errors?.[0]?.message ?? text;
      throw new Error(`${method} ${path} → ${response.status}: ${detail}`);
    }
    return payload?.data ?? payload;
  }

  get(path)          { return this.request('GET', path); }
  post(path, body)   { return this.request('POST', path, body); }
  patch(path, body)  { return this.request('PATCH', path, body); }
}
