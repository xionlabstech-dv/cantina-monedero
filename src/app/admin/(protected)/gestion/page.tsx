"use client";

import { useState } from "react";
import { TasaBcvTab } from "./TasaBcvTab";
import { RecargasTab } from "./RecargasTab";
import { PersonasTab } from "./PersonasTab";

const tabs = [
  { id: "tasa", label: "Tasa BCV" },
  { id: "recargas", label: "Recargas" },
  { id: "personas", label: "Personas" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function GestionPage() {
  const [tab, setTab] = useState<TabId>("tasa");

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="text-xl font-bold text-ink">Gestión</h1>

      <div className="flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id
                ? "border-accent text-accent"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tasa" && <TasaBcvTab />}
      {tab === "recargas" && <RecargasTab />}
      {tab === "personas" && <PersonasTab />}
    </div>
  );
}
