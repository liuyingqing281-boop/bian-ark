import bcrypt from "bcryptjs";

// 密码规则（docs/08 §3.0，注册与重置同规、前后端一致）：
// 长度 8–64；大写字母/小写字母/数字/特殊符号四类字符至少含 3 类；不含空白字符
export function validatePassword(password: string): boolean {
  if (typeof password !== "string" || password.length < 8 || password.length > 64) return false;
  if (/\s/.test(password)) return false;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  return classes >= 3;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function checkPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
