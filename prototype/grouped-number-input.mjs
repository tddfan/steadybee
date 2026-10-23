const selector = 'input[data-grouped-number]';

function digitsBefore(value, position) {
  return value.slice(0, position).replace(/,/g, '').length;
}

function caretForDigitCount(value, count) {
  if (count <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== ',') seen += 1;
    if (seen >= count) return index + 1;
  }
  return value.length;
}

export function formatGroupedNumberInput(input) {
  if (!input?.matches?.(selector)) return;
  const original = input.value;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const leftCount = start === null ? original.length : digitsBefore(original, start);
  const rightCount = end === null ? leftCount : digitsBefore(original, end);
  let clean = original.replace(/,/g, '').replace(/[^\d.]/g, '');
  const decimal = clean.indexOf('.');
  if (decimal !== -1) clean = `${clean.slice(0, decimal + 1)}${clean.slice(decimal + 1).replace(/\./g, '')}`;
  let [whole, fraction] = clean.split('.');
  whole = (whole || '').replace(/^0+(?=\d)/, '');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = decimal === -1 ? grouped : `${grouped || '0'}.${fraction ?? ''}`;
  if (formatted === original) return;
  input.value = formatted;
  if (start !== null && end !== null && document.activeElement === input) {
    input.setSelectionRange(caretForDigitCount(formatted, leftCount), caretForDigitCount(formatted, rightCount));
  }
}

export function enableGroupedNumberInput(input) {
  if (!input) return input;
  input.dataset.groupedNumber = 'true';
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.spellcheck = false;
  formatGroupedNumberInput(input);
  return input;
}

export function groupedNumberValue(input) {
  const value = String(input?.value ?? '').replace(/,/g, '').trim();
  return value === '' ? NaN : Number(value);
}

export function formatGroupedNumberInputs(root = document) {
  root.querySelectorAll?.(selector).forEach(formatGroupedNumberInput);
  if (root.matches?.(selector)) formatGroupedNumberInput(root);
}

// Capture before form-level input handlers parse the value.
document.addEventListener('input', event => {
  if (event.target?.matches?.(selector)) formatGroupedNumberInput(event.target);
}, true);

formatGroupedNumberInputs();
