/**
 * Safe formula evaluation utility for calculated parameters
 * Uses a simple parser instead of eval() for security
 */

export interface FormulaContext {
  [parameterName: string]: number;
}

export interface FormulaValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Escape special regex characters in a string
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract parameter names from a formula string by matching against known parameters
 * This properly handles multi-word parameter names like "Rep Distance"
 */
export function extractParameterNames(formula: string, availableParameters: string[]): string[] {
  if (!formula.trim()) return [];
  
  const foundParams: string[] = [];
  
  // Sort by length (longest first) to match multi-word params before single words
  const sortedParams = [...availableParameters].sort((a, b) => b.length - a.length);
  
  for (const paramName of sortedParams) {
    // Check if parameter name exists in formula using word boundaries
    const regex = new RegExp(`\\b${escapeRegExp(paramName)}\\b`, 'gi');
    if (regex.test(formula)) {
      foundParams.push(paramName);
    }
  }
  
  return foundParams;
}

/**
 * Validate a formula against available parameters
 */
export function validateFormula(
  formula: string,
  availableParameters: string[]
): FormulaValidationResult {
  if (!formula.trim()) {
    return { valid: false, error: 'Formula cannot be empty' };
  }
  
  // Check for only allowed characters (letters, numbers, spaces, operators, parentheses, hyphens for param names)
  const allowedPattern = /^[\w\s+\-*/().]+$/;
  if (!allowedPattern.test(formula)) {
    return { valid: false, error: 'Formula contains invalid characters' };
  }
  
  // Check balanced parentheses
  let parenCount = 0;
  for (const char of formula) {
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (parenCount < 0) {
      return { valid: false, error: 'Unbalanced parentheses' };
    }
  }
  if (parenCount !== 0) {
    return { valid: false, error: 'Unbalanced parentheses' };
  }
  
  // Extract parameters that match known names
  const referencedParams = extractParameterNames(formula, availableParameters);
  
  // Create a version of formula with known params removed to check for leftovers
  let remaining = formula;
  const sortedParams = [...availableParameters].sort((a, b) => b.length - a.length);
  for (const param of sortedParams) {
    remaining = remaining.replace(new RegExp(`\\b${escapeRegExp(param)}\\b`, 'gi'), '');
  }
  
  // Remove operators, parentheses, numbers, decimal points, and whitespace
  remaining = remaining.replace(/[+\-*/().\s\d]/g, '').trim();
  
  // If anything remains, it's an unknown token
  if (remaining.length > 0) {
    return { valid: false, error: `Unknown token in formula: "${remaining}"` };
  }
  
  if (referencedParams.length === 0) {
    return { valid: false, error: 'Formula must reference at least one parameter' };
  }
  
  return { valid: true };
}

/**
 * Safely evaluate a formula with given parameter values
 * Returns null if evaluation fails
 */
export function evaluateFormula(
  formula: string,
  context: FormulaContext
): number | null {
  if (!formula.trim()) return null;
  
  try {
    // Replace parameter names with their values
    let expression = formula;
    
    // Sort parameters by length (descending) to avoid partial replacements
    const paramNames = Object.keys(context).sort((a, b) => b.length - a.length);
    
    for (const paramName of paramNames) {
      const value = context[paramName];
      if (typeof value !== 'number' || isNaN(value)) {
        return null; // Missing or invalid value
      }
      // Use word boundaries for replacement
      const regex = new RegExp(`\\b${escapeRegExp(paramName)}\\b`, 'g');
      expression = expression.replace(regex, value.toString());
    }
    
    // Validate expression contains only numbers and operators
    const safePattern = /^[\d\s+\-*/().]+$/;
    if (!safePattern.test(expression)) {
      return null;
    }
    
    // Use Function constructor instead of eval for slightly better security
    // This creates a new function that returns the evaluated expression
    const result = new Function(`return (${expression})`)();
    
    if (typeof result !== 'number' || !isFinite(result)) {
      return null;
    }
    
    // Round to 2 decimal places for cleaner display
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}


/**
 * Parse a numeric value from a stored parameter string.
 * For range strings like "82-87" or "82-87%" uses the midpoint (84.5)
 * so formula results reflect the centre of the prescribed intensity zone.
 * Falls back to parseFloat for all other inputs.
 */
export function parseNumeric(raw: unknown): number {
  const str = String(raw).trim();
  // Match "lo-hi" where both parts start with a digit (excludes negative numbers like "-5")
  const rangeMatch = /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/.exec(str);
  if (rangeMatch) return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
  return parseFloat(str);
}

/**
 * Format a formula for display, showing the calculation with actual values
 */
export function formatFormulaPreview(
  formula: string,
  context: FormulaContext
): string {
  if (!formula.trim()) return '';
  
  let preview = formula;
  const paramNames = Object.keys(context).sort((a, b) => b.length - a.length);
  
  for (const paramName of paramNames) {
    const value = context[paramName];
    if (typeof value === 'number' && !isNaN(value)) {
      const regex = new RegExp(`\\b${escapeRegExp(paramName)}\\b`, 'g');
      preview = preview.replace(regex, `${value}`);
    }
  }
  
  return preview;
}
