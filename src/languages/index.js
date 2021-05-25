export const LANGUAGES = {};

export function addLanguage(languageDefinition) {
  var id = languageDefinition.id;
  if (!id) {
    throw new Error(`language definition missing an 'id' attribute`);
  }
  if (LANGUAGES[id]) {
    throw new Error(`language ${id} has already been added.`);
  }
  if (!languageDefinition.name) {
    throw new Error(`language definition for ${id} is missing a 'name' attribute.`);
  }
  if (!languageDefinition.parse) {
    throw new Error(`language definition for ${id} is missing a 'parse' function.`);
  }

  if (!languageDefinition.getExceptionMessage) {
    languageDefinition.getExceptionMessage = function(e) {
      return e || "Parser error";
    };
  }

  LANGUAGES[id] = languageDefinition;
  return languageDefinition;
}

export function getLanguage(languageId) {
  if (!LANGUAGES[languageId]) {
    console.warn('Trying to get language', languageId, 'but it hasn\'t been added yet');
  }
  return LANGUAGES[languageId];
}

export function removeLanguage(languageId) {
  delete LANGUAGES[languageId];
}

export function getLanguages() {
  return Object.values(LANGUAGES);
}
