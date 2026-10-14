export function buildInquiryScopeParams(
  effectivePhone?: string | null,
  activeMode?: string,
): Record<string, string> {
  return {
    ...(effectivePhone ? { salesperson_phone: effectivePhone } : {}),
    ...(activeMode ? { mode: activeMode } : {}),
  };
}
