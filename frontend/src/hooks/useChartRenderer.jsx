import React from 'react';
import { BarChart3, LineChart, PieChart, ScatterChart, CircleDot } from 'lucide-react';

export const CHART_TYPES = [
  { value: 'bar', label: 'Barres', icon: BarChart3 },
  { value: 'line', label: 'Lignes', icon: LineChart },
  { value: 'pie', label: 'Circulaire', icon: PieChart },
  { value: 'scatter', label: 'Nuage', icon: ScatterChart },
  { value: 'bubble', label: 'Bulles', icon: CircleDot },
];

export const useChartRenderer = () => {
  const truncate = (text, max = 15) => (!text ? '' : text.length > max ? `${text.slice(0, max)}...` : text);
  const isNumeric = (val) => (val !== null && val !== undefined && val !== '' && !Number.isNaN(Number(val)));

  const getNumericColumns = (result) => 
    (result?.columns || []).filter(col => 
      result.data.some(row => isNumeric(row[col]))
    );

  const getDefaultConfig = (result) => {
    const cols = result?.columns || [];
    const numCols = getNumericColumns(result);
    return {
      type: 'bar',
      xColumn: cols.find(c => !numCols.includes(c)) || cols[0],
      yColumn: numCols[0] || cols[1],
      zColumn: numCols[1] || numCols[0], // Pour la taille des bulles
      open: false
    };
  };

  const renderChart = (config, result) => {
    const { type, xColumn, yColumn, zColumn } = config;
    const data = result.data;
    const w = 600, h = 220, p = 40;

    if (type === 'bar') {
      const max = Math.max(...data.map(r => Number(r[yColumn]) || 0), 1);
      return (
        <div className="mini-chart-container" style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '200px', padding: '10px', borderBottom: '1px solid #eee', overflowX: 'auto' }}>
          {data.slice(0, 15).map((row, i) => (
            <div key={i} style={{ flex: 1, minWidth: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ height: `${(Number(row[yColumn]) / max) * 150}px`, width: '100%', background: 'linear-gradient(to top, #0d5395, #38bdf8)', borderRadius: '4px' }} title={`${row[xColumn]}: ${row[yColumn]}`} />
              <span style={{ fontSize: '10px', marginTop: '5px', whiteSpace: 'nowrap' }}>{truncate(row[xColumn])}</span>
            </div>
          ))}
        </div>
      );
    }

    if (type === 'scatter' || type === 'bubble') {
      const maxX = Math.max(...data.map(r => Number(r[xColumn]) || 0), 1);
      const maxY = Math.max(...data.map(r => Number(r[yColumn]) || 0), 1);
      const maxZ = Math.max(...data.map(r => Number(r[zColumn]) || 0), 1);

      return (
        <svg viewBox={`0 0 ${w} ${h}`} className="chart-svg">
          <line x1={p} y1={h-p} x2={w-p} y2={h-p} stroke="#ccc" strokeWidth="1" />
          <line x1={p} y1={p} x2={p} y2={h-p} stroke="#ccc" strokeWidth="1" />
          {data.map((row, i) => {
            const cx = p + ((isNumeric(row[xColumn]) ? Number(row[xColumn]) : i * (maxX/data.length)) / maxX) * (w - p * 2);
            const cy = h - p - (Number(row[yColumn]) / maxY) * (h - p * 2);
            const r = type === 'bubble' ? (Number(row[zColumn]) / maxZ) * 25 + 5 : 6;
            return (
              <circle key={i} cx={cx} cy={cy} r={r} fill="#38bdf8" fillOpacity="0.6" stroke="#0d5395">
                <title>{`${row[xColumn]} | Y: ${row[yColumn]} ${type === 'bubble' ? '| Taille: ' + row[zColumn] : ''}`}</title>
              </circle>
            );
          })}
        </svg>
      );
    }

    if (type === 'line') {
      const maxY = Math.max(...data.map(r => Number(r[yColumn]) || 0), 1);
      const points = data.map((row, i) => ({
        x: p + (i * (w - p * 2)) / (data.length - 1),
        y: h - p - (Number(row[yColumn]) / maxY) * (h - p * 2)
      }));
      const d = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
      return (
        <svg viewBox={`0 0 ${w} ${h}`} className="chart-svg">
          <path d={d} fill="none" stroke="#0d5395" strokeWidth="3" />
          {points.map((pt, i) => <circle key={i} cx={pt.x} cy={pt.y} r="4" fill="#0d5395" />)}
        </svg>
      );
    }

    return <div className="chart-empty">Type non supporté</div>;
  };

  return { getNumericColumns, getDefaultConfig, renderChart, CHART_TYPES };
};