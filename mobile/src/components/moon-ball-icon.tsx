import Svg, { Circle, Path } from 'react-native-svg';

/**
 * A tennis ball that doubles as a moon: round outline, one tennis seam on the
 * left, and a filled crescent on the right - the "Blue Moon" badges
 * (docs/ACHIEVEMENTS.md). Same geometry as the web twin
 * (src/components/moon-ball-icon.tsx), drawn with react-native-svg.
 */
export function MoonBallIcon({ size = 14, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.6} />
      <Path d="M5.8 5.8C9 8.7 9 15.3 5.8 18.2" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M12 3A9 9 0 0 1 12 21A5 9 0 0 0 12 3Z" fill={color} />
    </Svg>
  );
}
