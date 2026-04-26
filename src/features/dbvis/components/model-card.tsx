import { type ModelDef, GROUP_COLORS } from "@/features/dbvis/schema-data";

interface ModelCardProps {
  model: ModelDef;
}

export function ModelCard({ model }: ModelCardProps) {
  const colors = GROUP_COLORS[model.group];
  const fkFields = model.fields.filter((f) => f.fk);
  const computedFields = model.fields.filter((f) => f.computed);
  const computedOnlyCount = model.computedOnlyFields?.length ?? 0;

  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className={`${colors.header} px-4 py-3`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-sm font-bold">{model.name}</span>
            {model.softDelete && (
              <span className="ml-2 rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                soft-delete
              </span>
            )}
          </div>
          <code className="shrink-0 rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-mono text-gray-700">
            {model.table}
          </code>
        </div>
        <div className="mt-1 flex gap-2 text-[11px] text-gray-600">
          <span>{model.fields.length} cols</span>
          {fkFields.length > 0 && <span>· {fkFields.length} FK{fkFields.length !== 1 ? "s" : ""}</span>}
          {computedOnlyCount > 0 && <span>· {computedOnlyCount} in-app only</span>}
        </div>
        {model.notes && (
          <p className="mt-1.5 text-[11px] leading-snug text-gray-600">{model.notes}</p>
        )}
      </div>

      {/* Fields table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-white/40">
              <th className="px-3 py-1.5 text-left font-semibold text-gray-500">Column</th>
              <th className="px-3 py-1.5 text-left font-semibold text-gray-500">Type</th>
              <th className="px-3 py-1.5 text-left font-semibold text-gray-500">DB</th>
              <th className="px-3 py-1.5 text-left font-semibold text-gray-500">Null</th>
              <th className="px-3 py-1.5 text-left font-semibold text-gray-500">Default / Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {model.fields.map((field) => (
              <tr key={field.name} className="bg-white/30 hover:bg-white/60 transition-colors">
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1">
                    {field.isId && (
                      <span title="Primary key" className="text-[10px] text-amber-500 font-bold">PK</span>
                    )}
                    <code className="font-mono text-gray-800">{field.dbColumn !== field.name ? field.dbColumn : field.name}</code>
                    {field.dbColumn !== field.name && (
                      <span className="text-[10px] text-gray-400">({field.name})</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  {field.fk ? (
                    <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-700">
                      → {field.fk.toModel}
                    </span>
                  ) : (
                    <span className="text-gray-600">{field.type}</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-gray-500">
                  {field.dbType ?? "—"}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {field.optional ? (
                    <span className="text-gray-400">✓</span>
                  ) : (
                    <span className="font-semibold text-gray-700">✗</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-gray-500 max-w-[200px]">
                  {field.fk ? (
                    <span className="text-[10px] text-gray-400">onDelete: {field.fk.onDelete}</span>
                  ) : field.defaultValue ? (
                    <code className="text-[10px] text-gray-600">{field.defaultValue}</code>
                  ) : field.note ? (
                    <span className="text-[10px]">{field.note}</span>
                  ) : null}
                  {field.defaultValue && field.note ? (
                    <span className="ml-1 text-[10px] text-gray-400">— {field.note}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* In-app only fields */}
      {model.computedOnlyFields && model.computedOnlyFields.length > 0 && (
        <div className="border-t border-dashed border-amber-300 bg-amber-50/60 px-4 py-2">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            In-app only (not in DB)
          </p>
          <div className="space-y-1">
            {model.computedOnlyFields.map((cf) => (
              <div key={cf.name} className="flex items-baseline gap-2">
                <code className="shrink-0 text-[11px] font-semibold text-amber-800">{cf.name}</code>
                <span className="text-[10px] text-gray-500 italic">{cf.tsType}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relations */}
      {model.relations.length > 0 && (
        <div className="border-t border-gray-200 bg-white/20 px-4 py-2">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Relations</p>
          <div className="flex flex-wrap gap-1">
            {model.relations.map((r) => (
              <span
                key={r.name}
                className="rounded bg-white/70 border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600"
              >
                {r.name}: {r.isList ? `${r.toModel}[]` : r.toModel}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
