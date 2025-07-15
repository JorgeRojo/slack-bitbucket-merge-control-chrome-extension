function normalizeText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function determineMergeStatus(messageText, allowedPhrases, disallowedPhrases, exceptionPhrases) {
  const normalizedMessageText = normalizeText(messageText);

  const currentAllowedPhrases = allowedPhrases.map(phrase => normalizeText(phrase));
  const currentDisallowedPhrases = disallowedPhrases.map(phrase => normalizeText(phrase));
  const currentExceptionPhrases = exceptionPhrases.map(phrase => normalizeText(phrase));

  let status = "unknown";

  if (currentExceptionPhrases.some(keyword => normalizedMessageText.includes(keyword))) {
    status = "exception";
  } else if (currentDisallowedPhrases.some(keyword => normalizedMessageText.includes(keyword))) {
    status = "disallowed";
  } else if (currentAllowedPhrases.some(keyword => normalizedMessageText.includes(keyword))) {
    status = "allowed";
  }

  return status;
}

export { normalizeText, determineMergeStatus };
