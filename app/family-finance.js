// An illustrative yearly family capacity in the game's CNY-2025 money basis.
// Class and surviving parents affect what the birth family can contribute;
// this is a game parameter, not an observed household income or benefit rate.
export function familyBudget(life) {
  const parents = [life.family?.mother, life.family?.father].filter(person => person?.alive).length;
  if (!parents) return 0;
  const fraction = { 1: .06, 2: .13, 3: .32, 4: .7, 5: 1.4 }[life.classRank] ?? .32;
  const income = Math.max(0, Number(life.profile?.typicalIncome) || 0);
  return Math.round(income * fraction * (.55 + .225 * parents));
}
