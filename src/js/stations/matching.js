/**
 * Compares the source and query strings based on specific fuzzy match criteria.
 * The criteria are alternatives, so a query that fails one criterion may still
 * produce a partial match through a later criterion. In session handling, a
 * partial match asks the matching station to repeat; only a perfect match
 * advances the contact.
 *
 * @param {string} source - The source string to compare against.
 * @param {string} query - The query string to compare with the source.
 * @returns {string} - "perfect", "partial", or "none" based on the match.
 */
export function compareStrings(source, query) {
  // Check for perfect match
  if (source === query) {
    // console.log("Perfect");
    return 'perfect';
  }
  // Check Criterion 1 (Start of String Match)
  if (criterion1(source, query)) {
    // console.log("Partial: Criterion 1");
    return 'partial';
  }
  // Check Criterion 2 (Middle or End of String Match)
  if (criterion2(source, query)) {
    // console.log("Partial: Criterion 2");
    return 'partial';
  }
  // Check Criterion 3 (Off by One Character)
  if (criterion3(source, query)) {
    // console.log("Partial: Criterion 3");
    return 'partial';
  }
  // Check Criterion 4 (Source is a Prefix of Query)
  if (criterion4(source, query)) {
    // console.log("Partial: Criterion 4");
    return 'partial';
  }
  // Check Criterion 5 (Partial Match with Two Initial Characters Matching and One Off-by-One)
  if (criterion5(source, query)) {
    // console.log("Partial: Criterion 5");
    return 'partial';
  }
  // If none of the criteria are met
  // console.log("None");
  return 'none';

  /**
   * Criterion 1: Start of String Match
   *
   * - **Conditions:**
   *   - Match of **1 character minimum**.
   *   - Query string **may not contain incorrect characters**.
   *   - Must match **at the start** of the source string.
   *
   * - **Examples:**
   *   - Source: "ABC", Query: "A"   => partial
   *   - Source: "ABC", Query: "Z"   => none
   *   - Source: "ABC", Query: "AX"  => none
   *
   * @param {string} source
   * @param {string} query
   * @returns {boolean}
   */
  function criterion1(source, query) {
    // The query length must be at least 1 and not exceed the source length
    if (query.length >= 1 && query.length <= source.length) {
      // Check each character in the query against the source
      for (let i = 0; i < query.length; i++) {
        if (source[i] !== query[i]) {
          return false; // Mismatch found
        }
      }
      return true; // All characters match at the start
    }
    return false;
  }

  /**
   * Criterion 2: Middle or End of String Match
   *
   * - **Conditions:**
   *   - Match of **2 consecutive characters minimum**.
   *   - Must match **in the middle or end** of the source string (not at the very start).
   *
   * - **Examples:**
   *   - Source: "ABC", Query: "BC" => partial
   *   - Source: "ABC", Query: "B"  => none
   *
   * @param {string} source
   * @param {string} query
   * @returns {boolean}
   */
  function criterion2(source, query) {
    // The query length must be at least 2 and not exceed the source length
    if (query.length >= 2 && query.length <= source.length) {
      // Start from index 1 to avoid matching at the start of the source string
      for (let i = 1; i <= source.length - query.length; i++) {
        const substr = source.substring(i, i + query.length);
        if (substr === query) {
          return true; // Found a match in the middle or end
        }
      }
    }
    return false;
  }

  /**
   * Criterion 3: Off by One Character
   *
   * - **Conditions:**
   *   - Match of **3 characters minimum** with the **4th character allowed to be off**.
   *   - At least **3 characters must match exactly**.
   *
   * - **Examples:**
   *   - Source: "ABCDE", Query: "BCZE" => partial
   *   - Source: "ABCDE", Query: "BCE"  => none
   *   - Source: "ABCDE", Query: "ABXD" => partial
   *
   * @param {string} source
   * @param {string} query
   * @returns {boolean}
   */
  function criterion3(source, query) {
    // The query length must be at least 4 and not exceed the source length
    if (query.length >= 4 && query.length <= source.length) {
      // Iterate through the source string to find potential matches
      for (let i = 0; i <= source.length - query.length; i++) {
        const substr = source.substring(i, i + query.length);
        let mismatches = 0;
        // Compare each character in the query with the substring
        for (let j = 0; j < query.length; j++) {
          if (substr[j] !== query[j]) {
            mismatches++;
            if (mismatches > 1) {
              break; // More than one mismatch, move to next substring
            }
          }
        }
        // Check if at least 3 characters match exactly
        if (mismatches <= 1 && query.length - mismatches >= 3) {
          return true; // Criteria met
        }
      }
    }
    return false;
  }

  /**
   * Criterion 4: Source is a Prefix of Query
   *
   * - **Conditions:**
   *   - The **source string matches the beginning** of the query string exactly.
   *   - The match must **cover the entire source string**.
   *   - The **query string may have additional characters** at the end.
   *
   * - **Examples:**
   *   - Source: "ABC", Query: "ABCD"  => partial
   *   - Source: "ABC", Query: "ABCDE" => partial
   *   - Source: "ABC", Query: "ABCX"  => partial
   *
   * @param {string} source
   * @param {string} query
   * @returns {boolean}
   */
  function criterion4(source, query) {
    // The source must be non-empty and shorter than the query
    if (source.length >= 1 && query.length > source.length) {
      // Check if the source matches the start of the query
      for (let i = 0; i < source.length; i++) {
        if (source[i] !== query[i]) {
          return false; // Mismatch found
        }
      }
      return true; // Source is a prefix of query
    }
    return false;
  }

  /**
   * Criterion 5: Partial Match with Two Initial Characters Matching and One Off-by-One
   *
   * - **Conditions:**
   *   - The query length must be at least 3.
   *   - The first two characters of the query must match the first two characters of the source exactly.
   *   - The third character in the query can differ from the source by one character.
   *   - Matches are checked specifically at the start of the source string.
   *
   * - **Examples:**
   *   - Source: "AB6ZZ", Query: "ABX"
   *     => 'A' matches 'A', 'B' matches 'B', and 'X' vs '6' is allowed as one mismatch.
   *     => returns true for partial.
   *
   * @param {string} source
   * @param {string} query
   * @returns {boolean}
   */
  function criterion5(source, query) {
    // The query must have at least 3 characters
    if (query.length < 3) {
      return false;
    }

    // Check if source has at least the length of the query
    if (source.length < query.length) {
      return false;
    }

    // Compare the first three characters:
    // First two must match exactly
    if (source[0] !== query[0] || source[1] !== query[1]) {
      return false;
    }

    // The third character can differ by one character (off-by-one)
    let mismatches = 0;
    for (let i = 0; i < query.length; i++) {
      if (source[i] !== query[i]) {
        mismatches++;
        if (mismatches > 1) {
          return false;
        }
      }
    }

    return true;
  }
}

// function runCompareStringTestCase(source, query, expectedResult) {
//   const result = compareStrings(source, query);
//   const passed = result === expectedResult;
//   console.log(`Source: "${source}", Query: "${query}" => Expected: "${expectedResult}", Got: "${result}" - ${passed ? "PASSED" : "FAILED"}`);
// }
//
// const testCases = [
//   // Expected values describe the aggregate result across every criterion,
//   // even when an example appears in a criterion-specific section.
//
//   // Perfect matches
//   {source: "ABC", query: "ABC", expected: "perfect"},
//   {source: "", query: "", expected: "perfect"},
//   {source: "A", query: "A", expected: "perfect"},
//
//   // Criterion 1 - Start of string match
//   {source: "ABC", query: "A", expected: "partial"},
//   {source: "ABC", query: "AB", expected: "partial"},
//   {source: "ABC", query: "AX", expected: "none"},
//   {source: "ABC", query: "ABX", expected: "partial"}, // Criterion 5
//   {source: "ABC", query: "Z", expected: "none"},
//   {source: "ABC", query: "", expected: "none"},
//   {source: "ABCDE", query: "ABC", expected: "partial"},
//   {source: "ABCDE", query: "ABCD", expected: "partial"},
//
//   // Criterion 2 - Middle or End of String
//   {source: "ABC", query: "BC", expected: "partial"},
//   {source: "ABCDE", query: "CD", expected: "partial"},
//   {source: "ABCDE", query: "DE", expected: "partial"},
//   {source: "ABCDE", query: "AB", expected: "partial"}, // Criterion 1
//   {source: "ABCDE", query: "B", expected: "none"},
//   {source: "ABCDE", query: "E", expected: "none"},
//   {source: "ABCDE", query: "ABCDE", expected: "perfect"},
//   {source: "ABCDE", query: "XYZ", expected: "none"},
//   {source: "ABCDE", query: "BCD", expected: "partial"},
//   {source: "ABCDE", query: "BCDE", expected: "partial"},
//
//   // Criterion 3 - Off by one character
//   {source: "ABCDE", query: "BCZE", expected: "partial"},
//   {source: "ABCDE", query: "BCE", expected: "none"},
//   {source: "ABCDE", query: "ABXD", expected: "partial"},
//   {source: "ABCDE", query: "ABXY", expected: "none"},
//   {source: "ABCDE", query: "ABCDE", expected: "perfect"},
//   {source: "ABCDE", query: "ABCXE", expected: "partial"},
//   {source: "ABCDE", query: "ABCDF", expected: "partial"},
//   {source: "ABCDE", query: "ABCD", expected: "partial"},
//   {source: "ABCDE", query: "ABXDE", expected: "partial"},
//   {source: "ABCDE", query: "ABXXE", expected: "none"},
//
//   // Criterion 4 - Source is Prefix of Query
//   {source: "ABC", query: "ABCD", expected: "partial"},
//   {source: "ABC", query: "ABCDE", expected: "partial"},
//   {source: "ABC", query: "ABCX", expected: "partial"},
//   {source: "ABC", query: "ABCDX", expected: "partial"},
//   {source: "AB", query: "ABCD", expected: "partial"},
//   {source: "", query: "A", expected: "none"},
//   {source: "ABC", query: "ABC", expected: "perfect"},
//
//   // Edge cases
//   {source: "ABCDE", query: "ABCDEFX", expected: "partial"}, // Criterion 4
//   {source: "ABCDE", query: "ABCDEF", expected: "partial"},
//   {source: "ABCD", query: "ABCDE", expected: "partial"},
//   {source: "ABCCDE", query: "ABXDE", expected: "none"},
//   {source: "ABCD", query: "ABXY", expected: "none"},
//   {source: "ABCDE", query: "ABC", expected: "partial"},
//   {source: "ABCDE", query: "ABCD", expected: "partial"},
//   {source: "", query: "", expected: "perfect"},
//   {source: "", query: "AB", expected: "none"},
//   {source: "A", query: "A", expected: "perfect"},
//   {source: "A", query: "AB", expected: "partial"},
//   {source: "A", query: "B", expected: "none"},
// ];

// for (const testCase of testCases) {
//     runCompareStringTestCase(testCase.source, testCase.query, testCase.expected);
// }
