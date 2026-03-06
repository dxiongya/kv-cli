interface KvGroups {
  grouped: Record<string, number>;
  ungrouped: string[];
}

interface Kv {
  (name: string): string;
  init(password: string): void;
  unlock(password?: string): boolean;
  changePassword(oldPassword: string, newPassword: string): number;
  isInitialized(): boolean;
  isUnlocked(): boolean;
  set(name: string, value: string): void;
  get(name: string): string;
  list(prefix?: string): string[];
  rm(name: string): void;
  rmGroup(prefix: string): number;
  groups(): KvGroups;
  env(prefix: string): Record<string, string>;
}

export declare const kv: Kv;
