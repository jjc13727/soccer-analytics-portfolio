// StatsBomb's standard position taxonomy (position_id 1-25) mapped to a top-down
// pitch layout: x=0 is the team's own goal line, x=100 the opponent's goal line,
// y spans 0 (one touchline) to 100 (the other). Coordinates are hand-tuned template
// slots (the same approach JLA-style tactics boards use), not literal tracking data.

export const POSITION_COORDS: Record<number, { x: number; y: number }> = {
  1: { x: 6, y: 50 }, // Goalkeeper
  2: { x: 22, y: 85 }, // Right Back
  3: { x: 18, y: 65 }, // Right Center Back
  4: { x: 15, y: 50 }, // Center Back
  5: { x: 18, y: 35 }, // Left Center Back
  6: { x: 22, y: 15 }, // Left Back
  7: { x: 34, y: 88 }, // Right Wing Back
  8: { x: 34, y: 12 }, // Left Wing Back
  9: { x: 36, y: 66 }, // Right Defensive Midfield
  10: { x: 33, y: 50 }, // Center Defensive Midfield
  11: { x: 36, y: 34 }, // Left Defensive Midfield
  12: { x: 56, y: 87 }, // Right Midfield
  13: { x: 50, y: 66 }, // Right Center Midfield
  14: { x: 48, y: 50 }, // Center Midfield
  15: { x: 50, y: 34 }, // Left Center Midfield
  16: { x: 56, y: 13 }, // Left Midfield
  17: { x: 76, y: 84 }, // Right Wing
  18: { x: 65, y: 63 }, // Right Attacking Midfield
  19: { x: 62, y: 50 }, // Center Attacking Midfield
  20: { x: 65, y: 37 }, // Left Attacking Midfield
  21: { x: 76, y: 16 }, // Left Wing
  22: { x: 86, y: 63 }, // Right Center Forward
  23: { x: 90, y: 50 }, // Center Forward
  24: { x: 86, y: 37 }, // Left Center Forward
  25: { x: 80, y: 50 }, // Secondary Striker
};

export const POSITION_NAMES: Record<number, string> = {
  1: "Goalkeeper", 2: "Right Back", 3: "Right Center Back", 4: "Center Back",
  5: "Left Center Back", 6: "Left Back", 7: "Right Wing Back", 8: "Left Wing Back",
  9: "Right Defensive Mid", 10: "Center Defensive Mid", 11: "Left Defensive Mid",
  12: "Right Midfield", 13: "Right Center Mid", 14: "Center Midfield",
  15: "Left Center Mid", 16: "Left Midfield", 17: "Right Wing",
  18: "Right Attacking Mid", 19: "Center Attacking Mid", 20: "Left Attacking Mid",
  21: "Left Wing", 22: "Right Center Forward", 23: "Center Forward",
  24: "Left Center Forward", 25: "Secondary Striker",
};

// Formation templates for building a blank/custom board (not tied to real match data).
// Each is an ordered list of 11 position_ids that make sense for that shape.
export const FORMATION_TEMPLATES: Record<string, number[]> = {
  "4-4-2": [1, 2, 3, 5, 6, 12, 10, 14, 16, 22, 24],
  "4-3-3": [1, 2, 3, 5, 6, 9, 14, 11, 17, 23, 21],
  "4-2-3-1": [1, 2, 3, 5, 6, 9, 11, 18, 19, 20, 23],
  "4-1-4-1": [1, 2, 3, 5, 6, 10, 12, 13, 15, 16, 23],
  "4-3-1-2": [1, 2, 3, 5, 6, 9, 10, 11, 19, 22, 24],
  "3-5-2": [1, 3, 4, 5, 7, 9, 14, 11, 8, 22, 24],
  "3-4-3": [1, 3, 4, 5, 7, 10, 14, 8, 17, 23, 21],
  "5-3-2": [1, 2, 3, 4, 5, 6, 10, 14, 11, 22, 24],
  "4-5-1": [1, 2, 3, 5, 6, 12, 9, 14, 11, 16, 23],
};

export function formationCodeToLabel(code: number | string | null): string {
  if (!code) return "Unknown";
  const digits = String(code).split("").join("-");
  return digits;
}
