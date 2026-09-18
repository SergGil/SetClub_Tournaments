import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { sideNames, sideScore } from '@/features/matches/format';
import type { Match } from '@/features/matches/types';
import { useTheme } from '@/hooks/use-theme';
import type { BracketNode, BracketTree } from '@/lib/playoff-bracket-tree';

const BOX_WIDTH = 140;
const BOX_HEIGHT = 44;
const COL_GAP = 28;
const ROW_GAP = 14;
// Room for the round-label row (1/4, 1/2, Фінал…) above the match boxes - every y-coordinate
// below is shifted down by this much (mirrors LABEL_HEIGHT in the web TournamentBracket).
const LABEL_HEIGHT = 18;
const BRONZE_LABEL_HEIGHT = 16;

function MatchBox({ match, borderColor, winBg }: { match: Match; borderColor: string; winBg: string }) {
  return (
    <View style={[styles.box, { borderColor }]}>
      {(['A', 'B'] as const).map((side) => (
        <View
          key={side}
          style={[
            styles.boxSide,
            side === 'A' && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor },
            match.winnerSide === side && { backgroundColor: winBg },
          ]}>
          <ThemedText type="small" style={styles.boxName} numberOfLines={1}>
            {sideNames(match, side)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.boxScore}>
            {sideScore(match, side)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/**
 * Mobile twin of TournamentBracket (src/components/tournament-bracket.tsx on
 * the web) - same box-coordinates-from-tree-shape approach (leaf round
 * evenly spaced, each later round's box centered on its resolved children),
 * react-native-svg <Path> connectors instead of DOM <svg>, and a horizontal
 * ScrollView instead of overflow-x-auto for whatever size bracket a real
 * tournament has on a narrow phone screen.
 */
export function BracketView({ tree }: { tree: BracketTree }) {
  const theme = useTheme();

  const yById = new Map<string, number>();
  const shallow = tree.columns[0];
  shallow.nodes.forEach((node, i) => {
    yById.set(node.match.id, i * (BOX_HEIGHT + ROW_GAP) + BOX_HEIGHT / 2);
  });
  for (let c = 1; c < tree.columns.length; c++) {
    for (const node of tree.columns[c].nodes) {
      const childYs = [node.sideA.source, node.sideB.source]
        .filter((s): s is BracketNode => s !== null)
        .map((s) => yById.get(s.match.id)!);
      const y =
        childYs.length > 0
          ? childYs.reduce((a, b) => a + b, 0) / childYs.length
          : yById.size * (BOX_HEIGHT + ROW_GAP) + BOX_HEIGHT / 2;
      yById.set(node.match.id, y);
    }
  }

  const bronzeY = tree.bronze ? Math.max(...Array.from(yById.values())) + BOX_HEIGHT + ROW_GAP : 0;
  const maxY = Math.max(...Array.from(yById.values()), bronzeY || 0);
  const totalHeight = maxY + BOX_HEIGHT / 2 + 8 + LABEL_HEIGHT + (tree.bronze ? BRONZE_LABEL_HEIGHT : 0);
  const totalWidth = (tree.columns.length - 1) * (BOX_WIDTH + COL_GAP) + BOX_WIDTH + 8;

  const winBg = theme.backgroundSelected;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingBottom: 8 }}>
      <View style={{ width: totalWidth, height: totalHeight }}>
        {tree.columns.map((col, ci) => (
          <ThemedText
            key={col.round}
            type="small"
            themeColor="textSecondary"
            style={[styles.roundLabel, { left: ci * (BOX_WIDTH + COL_GAP), width: BOX_WIDTH }]}>
            {col.round}
          </ThemedText>
        ))}

        <Svg style={StyleSheet.absoluteFill} width={totalWidth} height={totalHeight}>
          {tree.columns.slice(1).map((col, ci) =>
            col.nodes.map((node) => {
              const x = (ci + 1) * (BOX_WIDTH + COL_GAP);
              const nodeY = yById.get(node.match.id)! + LABEL_HEIGHT;
              return [node.sideA.source, node.sideB.source]
                .filter((s): s is BracketNode => s !== null)
                .map((source) => {
                  const childY = yById.get(source.match.id)! + LABEL_HEIGHT;
                  const childRight = ci * (BOX_WIDTH + COL_GAP) + BOX_WIDTH;
                  const midX = childRight + COL_GAP / 2;
                  return (
                    <Path
                      key={`${node.match.id}-${source.match.id}`}
                      d={`M${childRight},${childY} H${midX} V${nodeY} H${x}`}
                      fill="none"
                      stroke={theme.backgroundSelected}
                      strokeWidth={2}
                    />
                  );
                });
            }),
          )}
        </Svg>

        {tree.columns.map((col, ci) => (
          <View key={col.round}>
            {col.nodes.map((node) => (
              <View
                key={node.match.id}
                style={{
                  position: 'absolute',
                  left: ci * (BOX_WIDTH + COL_GAP),
                  top: yById.get(node.match.id)! - BOX_HEIGHT / 2 + LABEL_HEIGHT,
                  width: BOX_WIDTH,
                }}>
                <MatchBox match={node.match} borderColor={theme.backgroundSelected} winBg={winBg} />
              </View>
            ))}
          </View>
        ))}

        {tree.bronze && (
          <View
            style={{
              position: 'absolute',
              left: (tree.columns.length - 1) * (BOX_WIDTH + COL_GAP),
              top: bronzeY - BOX_HEIGHT / 2 + LABEL_HEIGHT,
              width: BOX_WIDTH,
            }}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.bronzeLabel}>
              За 3 місце
            </ThemedText>
            <MatchBox match={tree.bronze} borderColor={theme.backgroundSelected} winBg={winBg} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  roundLabel: { position: 'absolute', top: 0, fontSize: 10, textTransform: 'uppercase' },
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, overflow: 'hidden', height: BOX_HEIGHT },
  boxSide: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, gap: 4 },
  boxName: { flex: 1, fontSize: 11 },
  boxScore: { fontSize: 11 },
  bronzeLabel: { fontSize: 10, textTransform: 'uppercase', marginBottom: 2 },
});
