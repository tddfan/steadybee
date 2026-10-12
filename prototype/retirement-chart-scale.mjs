// Round chart labels without changing any modelled amounts.
export function chartScale(max, min = 0) {
  const roughStep = Math.max(1, max - min) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 2.5, 5, 10].find(value => value * magnitude >= roughStep) * magnitude;
  const ceiling = Math.ceil(max / step) * step;
  const floor = min < -step / 2 ? Math.floor(min / step) * step : min;
  const firstTick = Math.ceil(floor / step) * step;
  const tickCount = Math.min(8, Math.round((ceiling - firstTick) / step) + 1);
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const value = firstTick + index * step;
    return Math.abs(value) < step / 100 ? 0 : value;
  });
  return { ceiling, floor, ticks };
}
