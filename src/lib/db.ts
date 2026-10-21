import mysql from "mysql2/promise";

// one pool for the whole process, same job the supabase client factory did.
// dateStrings keeps DATE/DATETIME as "yyyy-mm-dd" strings, which is the shape
// the mappers already expect from postgrest.
export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "subhavivaham",
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});

export async function q<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const [rows] = await pool.execute(sql, params as never[]);
  return rows as T[];
}

export async function q1<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

export async function run(sql: string, params: unknown[] = []) {
  const [result] = await pool.execute(sql, params as never[]);
  return result;
}

// multi-statement work that must be atomic (e.g. registration writing several
// rows) goes through a checked-out connection instead of the shared pool.
export async function tx<T>(
  fn: (client: {
    q: typeof q;
    q1: typeof q1;
    run: typeof run;
  }) => Promise<T>
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const client = {
      q: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
        const [rows] = await conn.execute(sql, params as never[]);
        return rows as R[];
      },
      q1: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
        const [rows] = await conn.execute(sql, params as never[]);
        return ((rows as R[])[0] ?? null) as R | null;
      },
      run: async (sql: string, params: unknown[] = []) => {
        const [result] = await conn.execute(sql, params as never[]);
        return result;
      },
    };
    const result = await fn(client);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
