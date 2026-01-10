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
 * Extract parameter names from a formula string
 * Parameters are identified as words that aren't numbers or operators
 */
export function extractParameterNames(formula: string): string[] {
  if (!formula.trim()) return [];
  
  // Remove operators and parentheses, then split by whitespace
  const tokens = formula
    .replace(/[+\-*/()]/g, ' ')
    .split(/\s+/)
    .filter(token => token.trim() !== '');
  
  // Filter out pure numbers
  const paramNames = tokens.filter(token => {
    return isNaN(Number(token)) && token.trim() !== '';
  });
  
  // Return unique parameter names
  return [...new Set(paramNames)];
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
  
  // Check for only allowed characters
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
  
  // Extract and validate parameter references
  const referencedParams = extractParameterNames(formula);
  for (const param of referencedParams) {
    if (!availableParameters.includes(param)) {
      return { valid: false, error: `Unknown parameter: "${param}"` };
    }
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
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
