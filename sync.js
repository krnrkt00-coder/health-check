const TABLE = "health_shared_state";
const ROW_ID = 1;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function getEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

async function supabaseFetch(path, options = {}) {
  const url = `${getEnv("SUPABASE_URL")}/rest/v1/${path}`;
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  return res;
}

async function readState() {
  const res = await supabaseFetch(`${TABLE}?id=eq.${ROW_ID}&select=people,records,updated_at`);
  if (!res.ok) throw new Error(`Supabase read failed: ${res.status}`);
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  return row || null;
}

async function writeState(people, records) {
  const body = {
    id: ROW_ID,
    people: Array.isArray(people) ? people : [],
    records: Array.isArray(records) ? records : [],
    updated_at: new Date().toISOString(),
  };
  const res = await supabaseFetch(`${TABLE}?onConflict=id`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
  });
  if (!res.ok) throw new Error(`Supabase write failed: ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : body;
}

module.exports = async (req, res) => {
  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      return json(res, 500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    if (req.method === "GET") {
      const row = await readState();
      if (!row) {
        return json(res, 200, {
          people: ["佐藤", "鈴木", "高橋", "田中"],
          records: [],
          updatedAt: null,
        });
      }
      return json(res, 200, {
        people: Array.isArray(row.people) ? row.people : [],
        records: Array.isArray(row.records) ? row.records : [],
        updatedAt: row.updated_at || null,
      });
    }

    if (req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString("utf8") || "{}";
      const body = JSON.parse(raw);
      const row = await writeState(body.people, body.records);
      return json(res, 200, {
        ok: true,
        updatedAt: row.updated_at || null,
      });
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method Not Allowed" });
  } catch (error) {
    return json(res, 500, { error: error.message || "Internal Server Error" });
  }
};
