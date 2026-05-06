"use client";

import { useState, useMemo } from "react";
import {
  type ModelDef,
  type ModelGroup,
  MODELS,
  GROUP_LABELS,
  GROUP_COLORS,
} from "@/features/dbvis/schema-data";
import { ModelCard } from "@/features/dbvis/components/model-card";

type Tab = "models" | "relations" | "computed";

const GROUP_ORDER: ModelGroup[] = ["auth", "calendar", "goals", "assignments", "admin"];

export function SchemaVisualizer() {
  const [activeTab, setActiveTab] = useState<Tab>("models");
  const [search, setSearch] = useState("");

  const filteredModels = useMemo(() => {
    if (!search.trim()) return MODELS;
    const q = search.toLowerCase();
    return MODELS.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.table.toLowerCase().includes(q) ||
        m.fields.some(
          (f) => f.name.toLowerCase().includes(q) || f.dbColumn.toLowerCase().includes(q),
        ),
    );
  }, [search]);

  // All FK edges across all models
  const allRelations = useMemo(
    () =>
      MODELS.flatMap((model) =>
        model.fields
          .filter((f) => f.fk)
          .map((f) => ({
            fromModel: model.name,
            fromField: f.dbColumn,
            toModel: f.fk!.toModel,
            toField: f.fk!.toField,
            onDelete: f.fk!.onDelete,
            group: model.group,
          })),
      ).sort((a, b) => a.fromModel.localeCompare(b.fromModel) || a.fromField.localeCompare(b.fromField)),
    [],
  );

  // All computed-only field annotations
  const allComputed = useMemo(
    () =>
      MODELS.flatMap((model) =>
        (model.computedOnlyFields ?? []).map((cf) => ({
          model: model.name,
          group: model.group,
          ...cf,
        })),
      ),
    [],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-[1600px] px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🗄️</span>
              <div>
                <h1 className="text-lg font-bold text-gray-900">DB Visualizer</h1>
                <p className="text-xs text-gray-500">
                  {MODELS.length} models · {MODELS.reduce((n, m) => n + m.fields.length, 0)} columns ·{" "}
                  {allRelations.length} FK relations
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1 text-sm">
              {(["models", "relations", "computed"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                    activeTab === tab
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "models" ? "Models" : tab === "relations" ? "Relations" : "Computed Fields"}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "models" && (
            <div className="mt-3">
              <input
                type="search"
                placeholder="Search models or columns…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-sm rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-6 py-8">
        {/* ── Models tab ───────────────────────────────────────────────────────── */}
        {activeTab === "models" && (
          <div className="space-y-10">
            {GROUP_ORDER.map((group) => {
              const models = filteredModels.filter((m) => m.group === group);
              if (models.length === 0) return null;
              const colors = GROUP_COLORS[group];
              return (
                <section key={group}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${colors.badge}`}>
                      {GROUP_LABELS[group]}
                    </span>
                    <span className="text-xs text-gray-400">{models.length} model{models.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {models.map((model) => (
                      <ModelCard key={model.name} model={model} />
                    ))}
                  </div>
                </section>
              );
            })}
            {filteredModels.length === 0 && (
              <p className="text-center text-sm text-gray-400">No models match "{search}"</p>
            )}
          </div>
        )}

        {/* ── Relations tab ────────────────────────────────────────────────────── */}
        {activeTab === "relations" && (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50 px-6 py-3">
              <h2 className="font-semibold text-gray-700">All Foreign Key Relations ({allRelations.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                    <th className="px-4 py-2.5 text-left font-semibold">From Model</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Column</th>
                    <th className="px-4 py-2.5 text-center font-semibold">→</th>
                    <th className="px-4 py-2.5 text-left font-semibold">To Model</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Field</th>
                    <th className="px-4 py-2.5 text-left font-semibold">On Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allRelations.map((rel, i) => {
                    const fromColors = GROUP_COLORS[rel.group];
                    const toModel = MODELS.find((m) => m.name === rel.toModel);
                    const toColors = toModel ? GROUP_COLORS[toModel.group] : GROUP_COLORS.auth;
                    return (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${fromColors.badge}`}>
                            {rel.fromModel}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <code className="text-xs text-gray-700">{rel.fromField}</code>
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-400">→</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toColors.badge}`}>
                            {rel.toModel}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <code className="text-xs text-gray-700">{rel.toField}</code>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                              rel.onDelete === "Cascade"
                                ? "bg-red-50 text-red-600"
                                : rel.onDelete === "SetNull"
                                ? "bg-amber-50 text-amber-600"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {rel.onDelete}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Computed Fields tab ──────────────────────────────────────────────── */}
        {activeTab === "computed" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              <strong>What "computed" means:</strong> These fields exist in the TypeScript types used throughout the app
              but are <em>not</em> stored as columns in the database. They are derived at runtime from other tables,
              computed by application logic, or generated per request session and discarded.
            </div>

            {GROUP_ORDER.map((group) => {
              const fields = allComputed.filter((cf) => cf.group === group);
              if (fields.length === 0) return null;
              const colors = GROUP_COLORS[group];
              return (
                <section key={group}>
                  <div className={`mb-2 rounded-xl px-3 py-1.5 text-xs font-bold ${colors.badge} inline-block`}>
                    {GROUP_LABELS[group]}
                  </div>
                  <div className="space-y-3">
                    {fields.map((cf, i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-amber-200 bg-white px-5 py-4"
                      >
                        <div className="flex items-baseline gap-3">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${colors.badge}`}>
                            {cf.model}
                          </span>
                          <code className="text-sm font-semibold text-gray-800">{cf.name}</code>
                          <span className="text-xs text-gray-400 italic">{cf.tsType}</span>
                          <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            IN-APP ONLY
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-gray-600 leading-relaxed">{cf.explanation}</p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}

            {allComputed.length === 0 && (
              <p className="text-center text-sm text-gray-400">No computed fields annotated.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
