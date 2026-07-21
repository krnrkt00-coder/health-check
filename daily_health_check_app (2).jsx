import React, { useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, CheckCircle2, Plus, Search, ShieldAlert, Trash2, Users } from "lucide-react";

const STORAGE_KEY = "daily-health-check-app-v1";

const DEFAULT_PEOPLE = [
  "佐藤",
  "鈴木",
  "高橋",
  "田中",
];

const initialForm = {
  person: DEFAULT_PEOPLE[0],
  date: new Date().toISOString().slice(0, 10),
  temperature: "",
  symptoms: [],
  otherSymptom: "",
  note: "",
};

const symptomOptions = [
  "発熱",
  "せき",
  "のどの痛み",
  "だるさ",
  "頭痛",
  "腹痛",
  "下痢",
  "吐き気",
];

function loadState() {
  if (typeof window === "undefined") {
    return { people: DEFAULT_PEOPLE, records: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { people: DEFAULT_PEOPLE, records: [] };
    const parsed = JSON.parse(raw);
    return {
      people: Array.isArray(parsed.people) && parsed.people.length ? parsed.people : DEFAULT_PEOPLE,
      records: Array.isArray(parsed.records) ? parsed.records : [],
    };
  } catch {
    return { people: DEFAULT_PEOPLE, records: [] };
  }
}

function normalizeTemp(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isAbnormal(record) {
  const temp = normalizeTemp(record.temperature);
  const symptomCount = (record.symptoms?.length || 0) + (record.otherSymptom ? 1 : 0);
  return (temp !== null && temp >= 37.5) || symptomCount > 0;
}

function formatRecordLabel(record) {
  const symptomText = [...(record.symptoms || []), record.otherSymptom].filter(Boolean).join("、");
  if (!symptomText) return "異常なし";
  return symptomText;
}

function StatCard({ icon: Icon, label, value, tone = "default" }) {
  const toneClass =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-slate-50 text-slate-700 ring-slate-200";

  return (
    <div className={`rounded-2xl ring-1 p-4 shadow-sm ${toneClass}`}>
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-white/70 p-2 ring-1 ring-black/5">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-medium opacity-80">{label}</div>
          <div className="text-2xl font-bold leading-tight">{value}</div>
        </div>
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded border-slate-300" />
      <span>{label}</span>
    </label>
  );
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage errors
    }
  }, [state]);

  const records = state.records;
  const people = state.people;

  const visibleRecords = useMemo(() => {
    return records
      .filter((r) => (!dateFilter ? true : r.date === dateFilter))
      .filter((r) => {
        const text = `${r.person} ${r.date} ${r.temperature} ${formatRecordLabel(r)} ${r.note}`.toLowerCase();
        return text.includes(search.toLowerCase());
      })
      .sort((a, b) => `${b.date} ${b.createdAt}`.localeCompare(`${a.date} ${a.createdAt}`));
  }, [records, dateFilter, search]);

  const dailyPeople = people;
  const dailyRecords = records.filter((r) => r.date === selectedDate);
  const completedCount = dailyPeople.filter((p) => dailyRecords.some((r) => r.person === p)).length;
  const abnormalCount = dailyRecords.filter(isAbnormal).length;
  const missingPeople = dailyPeople.filter((p) => !dailyRecords.some((r) => r.person === p));

  const tempValue = normalizeTemp(form.temperature);
  const previewAbnormal = (tempValue !== null && tempValue >= 37.5) || form.symptoms.length > 0 || !!form.otherSymptom;

  function addPerson() {
    const name = window.prompt("追加する名前を入力してください");
    const trimmed = name?.trim();
    if (!trimmed) return;
    if (state.people.includes(trimmed)) return;
    setState((prev) => ({ ...prev, people: [...prev.people, trimmed] }));
    setForm((prev) => ({ ...prev, person: trimmed }));
  }

  function removePerson(name) {
    if (!window.confirm(`${name} を一覧から削除しますか？`)) return;
    setState((prev) => ({
      people: prev.people.filter((p) => p !== name),
      records: prev.records.filter((r) => r.person !== name),
    }));
    if (form.person === name) {
      setForm((prev) => ({ ...prev, person: state.people.find((p) => p !== name) || "" }));
    }
  }

  function submitForm(e) {
    e.preventDefault();
    if (!form.person) return;

    const nextRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      person: form.person,
      date: form.date,
      temperature: form.temperature,
      symptoms: form.symptoms,
      otherSymptom: form.otherSymptom.trim(),
      note: form.note.trim(),
      createdAt: new Date().toISOString(),
    };

    setState((prev) => {
      const filtered = prev.records.filter(
        (r) => !(r.person === nextRecord.person && r.date === nextRecord.date)
      );
      return { ...prev, records: [nextRecord, ...filtered] };
    });

    setSelectedDate(form.date);
    setForm({
      person: form.person,
      date: form.date,
      temperature: "",
      symptoms: [],
      otherSymptom: "",
      note: "",
    });
  }

  function toggleSymptom(symptom) {
    setForm((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter((s) => s !== symptom)
        : [...prev.symptoms, symptom],
    }));
  }

  function deleteRecord(id) {
    setState((prev) => ({ ...prev, records: prev.records.filter((r) => r.id !== id) }));
  }

  function resetAll() {
    if (!window.confirm("すべての記録を削除しますか？")) return;
    setState({ people: [...DEFAULT_PEOPLE], records: [] });
    setForm(initialForm);
    setSearch("");
    setDateFilter(new Date().toISOString().slice(0, 10));
    setSelectedDate(new Date().toISOString().slice(0, 10));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-white/90 ring-1 ring-white/15">
                <Activity className="h-4 w-4" />
                毎日の健康チェック
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">複数人で使える健康チェックアプリ</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/75 sm:text-base">
                名前ごとの入力・日付別の一覧・異常値の確認を1画面で管理できます。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addPerson}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
              >
                <Plus className="h-4 w-4" />
                人を追加
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
              >
                <Trash2 className="h-4 w-4" />
                全削除
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <StatCard icon={Users} label="登録人数" value={people.length} />
          <StatCard icon={CheckCircle2} label={`${selectedDate} の記録済み`} value={`${completedCount}/${dailyPeople.length}`} tone="good" />
          <StatCard icon={ShieldAlert} label="注意が必要な件数" value={abnormalCount} tone="warn" />
          <StatCard icon={CalendarDays} label="未入力人数" value={missingPeople.length} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">入力フォーム</h2>
                <p className="text-sm text-slate-500">1人ずつ記録すると自動で上書きされます。</p>
              </div>
              <div className={`rounded-full px-3 py-1 text-xs font-semibold ${previewAbnormal ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                {previewAbnormal ? "注意あり" : "異常なし"}
              </div>
            </div>

            <form onSubmit={submitForm} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">名前</span>
                  <select
                    value={form.person}
                    onChange={(e) => setForm((prev) => ({ ...prev, person: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none ring-0 focus:border-slate-500"
                  >
                    {people.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">日付</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none ring-0 focus:border-slate-500"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">体温（℃）</span>
                  <input
                    type="number"
                    step="0.1"
                    min="34"
                    max="42"
                    inputMode="decimal"
                    placeholder="例: 36.6"
                    value={form.temperature}
                    onChange={(e) => setForm((prev) => ({ ...prev, temperature: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none ring-0 focus:border-slate-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">備考</span>
                  <input
                    type="text"
                    placeholder="連絡事項があれば入力"
                    value={form.note}
                    onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none ring-0 focus:border-slate-500"
                  />
                </label>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">症状</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {symptomOptions.map((symptom) => (
                    <Checkbox
                      key={symptom}
                      label={symptom}
                      checked={form.symptoms.includes(symptom)}
                      onChange={() => toggleSymptom(symptom)}
                    />
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">その他の症状</span>
                <input
                  type="text"
                  placeholder="自由記述"
                  value={form.otherSymptom}
                  onChange={(e) => setForm((prev) => ({ ...prev, otherSymptom: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none ring-0 focus:border-slate-500"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  登録する
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...initialForm,
                      person: prev.person,
                      date: prev.date,
                    }))
                  }
                  className="rounded-2xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  クリア
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">登録メンバー</h2>
                <p className="text-sm text-slate-500">個人の削除もできます。</p>
              </div>
            </div>

            <div className="space-y-2">
              {people.map((person) => {
                const latest = records.filter((r) => r.person === person).sort((a, b) => `${b.date} ${b.createdAt}`.localeCompare(`${a.date} ${a.createdAt}`))[0];
                return (
                  <div key={person} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                    <div>
                      <div className="font-semibold">{person}</div>
                      <div className="text-sm text-slate-500">
                        {latest ? `${latest.date} / ${latest.temperature || "-"}℃ / ${formatRecordLabel(latest)}` : "まだ記録なし"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePerson(person)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      削除
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-700">未入力者</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {missingPeople.length ? (
                  missingPeople.map((p) => (
                    <span key={p} className="rounded-full bg-white px-3 py-1 text-sm text-slate-700 ring-1 ring-slate-200">
                      {p}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">すべて入力済みです。</span>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-bold">記録一覧</h2>
              <p className="text-sm text-slate-500">日付とキーワードで絞り込みできます。</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="検索..."
                  className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-10 pr-4 outline-none focus:border-slate-500"
                />
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">日付</th>
                  <th className="px-4 py-3 font-semibold">名前</th>
                  <th className="px-4 py-3 font-semibold">体温</th>
                  <th className="px-4 py-3 font-semibold">症状</th>
                  <th className="px-4 py-3 font-semibold">備考</th>
                  <th className="px-4 py-3 font-semibold">判定</th>
                  <th className="px-4 py-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visibleRecords.length ? (
                  visibleRecords.map((record) => {
                    const abnormal = isAbnormal(record);
                    return (
                      <tr key={record.id} className="align-top">
                        <td className="px-4 py-3 whitespace-nowrap">{record.date}</td>
                        <td className="px-4 py-3 font-medium">{record.person}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{record.temperature ? `${record.temperature} ℃` : "-"}</td>
                        <td className="px-4 py-3">{formatRecordLabel(record)}</td>
                        <td className="px-4 py-3">{record.note || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${abnormal ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                            {abnormal ? "注意" : "正常"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => deleteRecord(record.id)}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      条件に一致する記録がありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
