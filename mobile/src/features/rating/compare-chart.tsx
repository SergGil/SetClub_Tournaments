import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';

import type { RatingHistoryPoint } from './types';

const WIDTH = 320;
const HEIGHT = 140;
const PADDING = { top: 10, right: 8, bottom: 6, left: 8 };

// Explicit UTC extraction, not toLocaleDateString - asOfDate is a UTC
// midnight timestamp (same reasoning as the web RatingCompareChart's own
// dateLabel, src/components/rating-compare-chart.tsx).
function dateLabel(epochMs: number): string {
  const d = new Date(epochMs);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = String(d.getUTCFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
}

/**
 * Two-series rating-over-time line chart for the mobile compare screen -
 * hand-rolled SVG, same technique and layout as the web equivalent
 * (RatingCompareChart, src/components/rating-compare-chart.tsx): two
 * overlaid polylines (solid for A, dashed for B) plus a filled circle on
 * each series' last point, and 4 evenly-spaced date labels below.
 */
export function RatingCompareChart({
  seriesA,
  seriesB,
  colorA,
  colorB,
}: {
  seriesA: RatingHistoryPoint[];
  seriesB: RatingHistoryPoint[];
  colorA: string;
  colorB: string;
}) {
  const all = [...seriesA, ...seriesB];
  if (all.length < 2) return null;

  const dates = all.map((p) => new Date(p.asOfDate).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateSpan = Math.max(1, maxDate - minDate);

  const ratings = all.map((p) => p.rating);
  const minY = Math.min(...ratings);
  const ySpan = Math.max(1, Math.max(...ratings) - minY);

  const innerW = WIDTH - PADDING.left - PADDING.right;
  const innerH = HEIGHT - PADDING.top - PADDING.bottom;
  const xAt = (date: number) => PADDING.left + ((date - minDate) / dateSpan) * innerW;
  const yAt = (value: number) => PADDING.top + innerH - ((value - minY) / ySpan) * innerH;

  const pointsFor = (series: RatingHistoryPoint[]) =>
    series.map((p) => `${xAt(new Date(p.asOfDate).getTime())},${yAt(p.rating)}`).join(' ');
  const lastPoint = (series: RatingHistoryPoint[]) => {
    const p = series[series.length - 1];
    return { cx: xAt(new Date(p.asOfDate).getTime()), cy: yAt(p.rating) };
  };

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {seriesA.length >= 2 && (
          <>
            <Polyline points={pointsFor(seriesA)} fill="none" stroke={colorA} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <Circle {...lastPoint(seriesA)} r={3} fill={colorA} />
          </>
        )}
        {seriesB.length >= 2 && (
          <>
            <Polyline
              points={pointsFor(seriesB)}
              fill="none"
              stroke={colorB}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="5,3"
            />
            <Circle {...lastPoint(seriesB)} r={3} fill={colorB} />
          </>
        )}
      </Svg>
      <View style={styles.dateRow}>
        {[0, 1 / 3, 2 / 3, 1].map((fraction) => (
          <ThemedText key={fraction} type="small" themeColor="textSecondary" style={styles.dateLabel}>
            {dateLabel(minDate + dateSpan * fraction)}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dateLabel: { fontSize: 10 },
});
