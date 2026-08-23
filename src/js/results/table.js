/**
 * Inserts a new row at the top of a specified HTML table body with provided data.
 *
 * @param {string} tableName - The ID of the HTML table element.
 * @param {number} index - A numeric index or sequence number.
 * @param {string} callsign - The callsign or identifier to display.
 * @param {string} wpm - The words per minute speed (and Farnsworth spacing) to display.
 * @param {number} attempts - The number of attempts to record.
 * @param {number} totalTime - The total time taken, displayed to two decimal places.
 * @param {string|null} [extra=null] - Optional additional information to include in a fifth cell.
 */
export function addTableRow(
  tableName,
  index,
  callsign,
  wpm,
  attempts,
  totalTime,
  extra = null
) {
  const table = document
    .getElementById(tableName)
    .getElementsByTagName('tbody')[0];

  // Create a new row at the top
  const newRow = table.insertRow(0);

  // Add cells and populate them
  newRow.insertCell(0).textContent = index;
  newRow.insertCell(1).textContent = callsign;
  newRow.insertCell(2).textContent = wpm;
  newRow.insertCell(3).textContent = attempts;
  newRow.insertCell(4).textContent = totalTime.toFixed(2);
  if (extra) {
    newRow.insertCell(5).innerHTML = extra;
  }

  // Update the summary row at the bottom
  updateSummaryRow(tableName, extra);
}

/**
 * Removes all rows from the specified table body.
 *
 * @param {string} tableName - The ID of the HTML table element.
 */
export function clearTable(tableName) {
  const tableBody = document
    .getElementById(tableName)
    .getElementsByTagName('tbody')[0];

  // Clear all rows in the table body
  while (tableBody.firstChild) {
    tableBody.removeChild(tableBody.firstChild);
  }
}

/**
 * Computes totals and averages for the current rows (excluding the very first row),
 * and inserts/updates a summary row at the bottom. If there are fewer than 2 data rows,
 * no summary row is shown.
 *
 * @param {string} tableName - The ID of the HTML table element.
 * @param {string|null} [extra=null] - Optional additional information to include in a fifth cell.
 */
function updateSummaryRow(tableName, extra = null) {
  const table = document.getElementById(tableName);
  const tableBody = table.getElementsByTagName('tbody')[0];

  // Remove any existing summary row
  const existingSummary = document.getElementById(tableName + '-summary');
  if (existingSummary) {
    existingSummary.remove();
  }

  // Gather row data
  let rows = Array.from(tableBody.rows);

  // If fewer than 2 rows, no summary row is meaningful
  // (we can't compute averages if we skip the first row and end up with nothing)
  if (rows.length < 2) {
    return;
  }

  const wpmValues = []; // Will store WPM strings
  const attemptsList = []; // Will store numeric attempts
  const timeList = []; // Will store total times

  for (const row of rows) {
    // WPM in cell[2], Attempts in cell[3], Time in cell[4]
    const wpmVal = row.cells[2].textContent;
    const attemptsVal = parseInt(row.cells[3].textContent, 10);
    const timeVal = parseFloat(row.cells[4].textContent);

    wpmValues.push(wpmVal);
    attemptsList.push(attemptsVal);
    timeList.push(timeVal);
  }

  const rowCount = rows.length;

  // --- Compute average attempts
  const sumAttempts = attemptsList.reduce((a, b) => a + b, 0);
  const avgAttempts = sumAttempts / rowCount;

  // --- Compute average total time
  const sumTime = timeList.reduce((a, b) => a + b, 0);
  const avgTime = sumTime / rowCount;

  // --- Compute average WPM (check if we have slashes)
  const hasSlash = wpmValues.some((val) => val.includes('/'));
  let finalWpm;

  if (hasSlash) {
    // Treat all as slash. If a row does not have '/', treat like "xx/xx"
    let sumWpm1 = 0;
    let sumWpm2 = 0;
    for (const val of wpmValues) {
      if (val.includes('/')) {
        const [part1, part2] = val.split('/');
        sumWpm1 += parseInt(part1, 10);
        sumWpm2 += parseInt(part2, 10);
      } else {
        const num = parseInt(val, 10);
        sumWpm1 += num;
        sumWpm2 += num;
      }
    }
    const avgWpm1 = sumWpm1 / rowCount;
    const avgWpm2 = sumWpm2 / rowCount;
    // Round or format as desired; here we use integers
    finalWpm = avgWpm1.toFixed(1) + ' / ' + avgWpm2.toFixed(1);
  } else {
    // All are single WPM
    const sumWpm = wpmValues.reduce((sum, val) => sum + parseInt(val, 10), 0);
    const avgWpm = sumWpm / rowCount;
    finalWpm = avgWpm.toFixed(1).toString();
  }

  // --- Insert the new summary row at the bottom
  const summaryRow = tableBody.insertRow(-1);
  summaryRow.id = tableName + '-summary';

  // Make everything in the summary row bold; add " total" to avgTime
  summaryRow.insertCell(0).innerHTML = ``;
  summaryRow.insertCell(1).innerHTML = `<strong>Avg</strong>`;
  summaryRow.insertCell(2).innerHTML = `<strong>${finalWpm}</strong>`;
  summaryRow.insertCell(3).innerHTML =
    `<strong>${avgAttempts.toFixed(1)}</strong>`;
  summaryRow.insertCell(4).innerHTML = `<strong>${avgTime.toFixed(2)}</strong>`;
  summaryRow.insertCell(5).innerHTML = ``;
}
