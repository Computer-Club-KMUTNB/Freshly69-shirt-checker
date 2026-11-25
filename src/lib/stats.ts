// Turns the raw get_stats() rows into the numbers shown on the overview page. Pure → unit-tested.

export interface StatsRow {
  faculty: string;
  gender: "M" | "F" | "U";
  size: string;
  received: boolean;
  n: number;
}

export interface RawStats {
  rows: StatsRow[];
  given_by_size: { faculty: string; size: string; n: number }[];
  hourly: { hour: string; n: number }[];
  pending_scans: number;
  issues: { issue_type: string; n: number; resolved: number }[];
}

export interface Tally {
  total: number;
  received: number;
  remaining: number;
}

const tally = (rows: StatsRow[]): Tally => {
  const total = rows.reduce((a, r) => a + r.n, 0);
  const received = rows.filter((r) => r.received).reduce((a, r) => a + r.n, 0);
  return { total, received, remaining: total - received };
};

function groupBy(rows: StatsRow[], key: (r: StatsRow) => string, order: string[]) {
  const keys = [...new Set([...order.filter((k) => rows.some((r) => key(r) === k)), ...rows.map(key)])];
  return keys.map((k) => ({ key: k, ...tally(rows.filter((r) => key(r) === k)) }));
}

/** faculty = null → whole university. */
export function summarize(raw: RawStats, faculty: string | null, facultyOrder: string[], sizeOrder: string[]) {
  const rows = faculty ? raw.rows.filter((r) => r.faculty === faculty) : raw.rows;
  const remainingRows = rows.filter((r) => !r.received);
  return {
    all: tally(rows),
    byGender: groupBy(rows, (r) => r.gender, ["M", "F", "U"]),
    bySize: groupBy(rows, (r) => r.size, sizeOrder),
    byFaculty: groupBy(raw.rows, (r) => r.faculty, facultyOrder),
    remainingByGenderSize: groupBy(remainingRows, (r) => `${r.gender}|${r.size}`, []).map((g) => ({
      gender: g.key.split("|")[0],
      size: g.key.split("|")[1],
      n: g.total,
    })),
  };
}
