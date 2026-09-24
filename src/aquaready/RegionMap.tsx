import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import type { Severity } from '../services/aquaready';
import type { IsabelaLgu } from '../data/isabelaMunicipalities';
import { SEVERITY_WORD } from './Visuals';

export interface LguRow {
  lgu: IsabelaLgu;
  score: number;
  severity: Severity;
  priority: number;
  months: number | null;
}

const HEX: Record<Severity, string> = { low: '#10b981', moderate: '#f59e0b', high: '#f43f5e' };

export function RegionMap({
  rows,
  selected,
  onSelect,
  isDark = false,
}: {
  rows: LguRow[];
  selected: string;
  onSelect: (name: string) => void;
  isDark?: boolean;
}) {
  return (
    <div className="h-full min-h-[380px] w-full rounded-xl overflow-hidden border border-slate-200 isolate relative z-0">
      <MapContainer center={[16.95, 121.95]} zoom={9} scrollWheelZoom={false} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {rows.map((r) => (
          <CircleMarker
            key={r.lgu.name}
            center={r.lgu.coordinates}
            radius={5 + Math.sqrt(r.lgu.population2020) / 45}
            pathOptions={{
              color: r.lgu.name === selected ? '#0284c7' : isDark ? '#090d16' : '#ffffff',
              weight: r.lgu.name === selected ? 3.5 : 1.5,
              fillColor: HEX[r.severity],
              fillOpacity: r.lgu.name === selected ? 1 : 0.85,
            }}
            eventHandlers={{ click: () => onSelect(r.lgu.name) }}
          >
            <Tooltip>
              <strong>{r.lgu.name}</strong>: {SEVERITY_WORD[r.severity]} ({r.score.toFixed(2)})
              <br />
              {r.lgu.population2020.toLocaleString()} residents{r.lgu.coastal ? ' (coastal)' : ''}
              <br />
              {r.months === null ? 'No dry spell in forecast' : r.months === 0 ? 'Dry spell active' : `Dry spell in ~${r.months} mo`}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
