// بيانات التطبيق: key/value لكل بيزنس ومتجر ومنتج وطلبية (نفس شكل App Data تاع تسيير).
// FileStore للخدمة المحلية؛ TassyirAppDataStore يكتب في App Data تاع تسيير بلا ما يبدّل الباقي.
import fs from 'node:fs/promises';
import path from 'node:path';

export class MemoryStore {
  constructor() {
    this.m = new Map();
  }
  k(scope, key) {
    return `${scope}::${key}`;
  }
  async get(scope, key) {
    return this.m.has(this.k(scope, key)) ? structuredClone(this.m.get(this.k(scope, key))) : null;
  }
  async set(scope, key, value) {
    this.m.set(this.k(scope, key), structuredClone(value));
  }
  async list(scope, prefix = '') {
    const out = [];
    for (const [k, v] of this.m) {
      const [s, key] = k.split('::');
      if (s === scope && key.startsWith(prefix)) out.push({ key, value: structuredClone(v) });
    }
    return out;
  }
}

export class FileStore extends MemoryStore {
  constructor(file) {
    super();
    this.file = file;
    this.loaded = false;
  }
  async load() {
    if (this.loaded) return;
    try {
      this.m = new Map(Object.entries(JSON.parse(await fs.readFile(this.file, 'utf8'))));
    } catch {
      this.m = new Map();
    }
    this.loaded = true;
  }
  async get(scope, key) {
    await this.load();
    return super.get(scope, key);
  }
  async list(scope, prefix) {
    await this.load();
    return super.list(scope, prefix);
  }
  async set(scope, key, value) {
    await this.load();
    await super.set(scope, key, value);
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(Object.fromEntries(this.m)));
  }
}

export class TassyirAppDataStore {
  // scope: business | store:<id> | product:<id> | order:<id>
  constructor(client) {
    this.client = client;
  }
  async get(scope, key) {
    return this.client.appData('GET', scope, key);
  }
  async set(scope, key, value) {
    return this.client.appData('PUT', scope, key, value);
  }
  async list(scope, prefix = '') {
    return this.client.appData('LIST', scope, prefix);
  }
}
