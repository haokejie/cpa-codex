// 与 src-tauri/src/config.rs AppConfig 对应
export type AppConfig = {
  autostart_enabled: boolean;
};

// 与 src-tauri/src/db.rs Account 对应
export type Account = {
  account_key: string;
  server: string;
  last_login_at: number;
  remember_password: boolean;
  has_password: boolean;
};

// 通用命令返回值
export type CommandResult = { ok: boolean };

// 与 src-tauri/src/commands.rs LoginPayload 对应
export type LoginPayload = {
  password: string;
  server: string;
  remember_password?: boolean;
};
